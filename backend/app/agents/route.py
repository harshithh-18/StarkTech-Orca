"""Route Optimization Agent — golden query #5.

Owner: E · Phase: P3 · Type: Tool (A* / graph search)

Least-risk sea path from A to B over the forecast sea-state grid.

> **Built only after the golden path was complete.** Four flawless queries beat five shaky
> ones, and this is the most seductive feature in the backlog — see docs/ROADMAP.md
> "Scope discipline".

## The method

Build a coarse lat/lon grid over the bounding box of the two points, cost each cell by
forecast wave height, mark land impassable, then A* with a geodesic heuristic.

**Cost is evaluated at estimated time of arrival**, not at departure. A route costed
entirely on departure conditions will happily sail into weather that arrives four hours
later — which is precisely the mistake a route planner exists to prevent.

## What it does not do

It does not know about shipping lanes, draft, fuel, or your vessel. It answers one
question — *which way across this water is roughest* — and the answer is advisory. The
verdict on whether to sail at all still comes from ``services.risk_rules``.
"""

from __future__ import annotations

import heapq
import itertools
import logging
import math
from datetime import datetime, timedelta, timezone

from app.schemas.response import Evidence, Location

logger = logging.getLogger(__name__)

NAME = "route"

# Grid resolution. ~0.1° ≈ 11 km: fine enough to route around a headland, coarse enough
# that A* stays well under a second and the marine API stays within its quota.
GRID_STEP_DEG = 0.1

# Hard ceiling on grid size. A Kakinada→Mumbai request would otherwise build a grid with
# tens of thousands of cells and hammer the forecast API.
MAX_GRID_CELLS = 400

# Coordinates per request. Sized between two real limits: a whole grid in one URL overruns
# the server's URI limit (414 at ~900 points), while many small batches trip its
# concurrency limit (429). 200 keeps a 400-cell grid to two requests.
GRID_BATCH_SIZE = 200

# Open-Meteo rejects bursts with "too many concurrent requests", so the batches are
# throttled rather than fired all at once.
MAX_CONCURRENT_BATCHES = 2

# Typical small mechanised fishing boat, used to estimate arrival time per cell.
CRUISE_SPEED_KMH = 18.0

# How strongly wave height dominates distance. At 4.0 a 2 m sea makes a cell cost about
# three times its length, so the route detours around rough water but will not take an
# absurdly long way round to avoid a mild swell.
WAVE_COST_WEIGHT = 4.0

SOURCE = "Open-Meteo Marine (route cost grid)"
ATTRIBUTION = "Weather data by Open-Meteo.com (CC BY 4.0)"


class RouteUnavailable(Exception):
    """No navigable path could be built. Carries the reason for the trace step."""


# The last route computed per session. The response contract is frozen and has no field
# for geometry, so the map fetches the line from /api/layers/route_line instead — and
# recomputing it there would mean a second A* run over a second forecast fetch.
_recent: dict[str, dict] = {}
_RECENT_LIMIT = 32


def remember(session_id: str, geojson: dict) -> None:
    """Store this session's route for the layers endpoint to serve."""
    if len(_recent) >= _RECENT_LIMIT:
        # Bounded: a long demo must not leak every route it ever drew.
        _recent.pop(next(iter(_recent)))
    _recent[session_id] = geojson


def recall(session_id: str) -> dict | None:
    """The most recent route for a session, if it has one."""
    return _recent.get(session_id)


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance. Used as the A* heuristic, so it must never overestimate."""
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def _build_grid(origin: Location, destination: Location) -> tuple[list[float], list[float]]:
    """Lat/lon axes spanning both points with a margin, capped at MAX_GRID_CELLS."""
    margin = GRID_STEP_DEG * 4
    lat_min = min(origin.lat, destination.lat) - margin
    lat_max = max(origin.lat, destination.lat) + margin
    lon_min = min(origin.lon, destination.lon) - margin
    lon_max = max(origin.lon, destination.lon) + margin

    step = GRID_STEP_DEG
    while ((lat_max - lat_min) / step + 1) * ((lon_max - lon_min) / step + 1) > MAX_GRID_CELLS:
        step *= 1.5

    lats = [lat_min + i * step for i in range(int((lat_max - lat_min) / step) + 1)]
    lons = [lon_min + i * step for i in range(int((lon_max - lon_min) / step) + 1)]
    return lats, lons


async def _wave_grid(lats: list[float], lons: list[float]) -> dict[tuple[int, int], float | None]:
    """Peak wave height per cell. ``None`` means land (or no data) — impassable.

    One bulk request: the marine endpoint accepts comma-separated coordinates, so the
    whole grid costs a single round trip rather than one per cell.
    """
    import asyncio

    from app.adapters.base import AdapterError, fetch_with_cascade, get_json
    from app.adapters.open_meteo_marine import BASE_URL, CACHE_TTL
    from app.services.cache import cache_key

    points = [(i, j) for i in range(len(lats)) for j in range(len(lons))]

    limiter = asyncio.Semaphore(MAX_CONCURRENT_BATCHES)

    async def fetch_batch(batch: list[tuple[int, int]]) -> list[dict]:
        params = {
            "latitude": ",".join(f"{lats[i]:.4f}" for i, _ in batch),
            "longitude": ",".join(f"{lons[j]:.4f}" for _, j in batch),
            "hourly": "wave_height",
            "forecast_days": 2,
            "timezone": "UTC",
        }
        key = cache_key("route_wave_grid", params)
        async with limiter:
            result = await fetch_with_cascade(
                key, lambda: get_json(BASE_URL, params), CACHE_TTL, SOURCE
            )
        payload = result.payload
        return payload if isinstance(payload, list) else [payload]

    # Batched, not one request: a whole grid of comma-separated coordinates overruns the
    # URL length limit and the server answers 414 rather than truncating. Concurrency is
    # capped because the other failure mode is a 429 burst limit.
    batches = [points[i : i + GRID_BATCH_SIZE] for i in range(0, len(points), GRID_BATCH_SIZE)]
    try:
        responses = await asyncio.gather(*(fetch_batch(batch) for batch in batches))
    except AdapterError as exc:
        raise RouteUnavailable(f"could not fetch the sea-state grid: {exc}") from exc

    cells = [cell for batch in responses for cell in batch]
    if len(cells) != len(points):
        raise RouteUnavailable(
            f"sea-state grid came back incomplete ({len(cells)} of {len(points)} cells)"
        )

    grid: dict[tuple[int, int], float | None] = {}
    for (i, j), cell in zip(points, cells):
        series = (cell.get("hourly") or {}).get("wave_height") or []
        # Hourly values, so index ≈ hours ahead — used below to cost by arrival time.
        values = [v for v in series if v is not None]
        grid[(i, j)] = None if not values else max(values)
        grid[("series", i, j)] = series  # type: ignore[index]

    return grid


def _cost_at_arrival(series: list, hours_ahead: float, fallback: float) -> float:
    """Wave height at the hour the boat would actually arrive.

    Costing every cell on departure conditions is the classic route-planner bug: the path
    sails straight into weather that had not arrived yet when the route was drawn.
    """
    if not series:
        return fallback
    index = max(0, min(len(series) - 1, round(hours_ahead)))
    value = series[index]
    if value is None:
        # Nearest non-null hour, rather than treating a gap as flat calm.
        for offset in range(1, len(series)):
            for probe in (index - offset, index + offset):
                if 0 <= probe < len(series) and series[probe] is not None:
                    return float(series[probe])
        return fallback
    return float(value)


async def plan_route(
    origin: Location, destination: Location, departure_time: str | None = None
) -> dict:
    """Least-risk path over a wave-height cost grid.

    Returns {'geojson', 'evidence', 'distance_km', 'max_wave_m', 'hours'}.
    """
    lats, lons = _build_grid(origin, destination)
    if len(lats) < 2 or len(lons) < 2:
        raise RouteUnavailable("origin and destination are too close to plan a route")

    grid = await _wave_grid(lats, lons)

    def nearest_cell(location: Location) -> tuple[int, int]:
        i = min(range(len(lats)), key=lambda k: abs(lats[k] - location.lat))
        j = min(range(len(lons)), key=lambda k: abs(lons[k] - location.lon))
        return i, j

    start, goal = nearest_cell(origin), nearest_cell(destination)

    navigable = {k for k, v in grid.items() if isinstance(k, tuple) and len(k) == 2 and v is not None}
    if start not in navigable:
        raise RouteUnavailable(
            f"{origin.name or 'the start point'} is not on navigable water"
        )
    if goal not in navigable:
        raise RouteUnavailable(
            f"{destination.name or 'the destination'} is not on navigable water"
        )

    # ── A* ────────────────────────────────────────────────────────────────
    def heuristic(cell: tuple[int, int]) -> float:
        return _haversine_km((lats[cell[0]], lons[cell[1]]), (lats[goal[0]], lons[goal[1]]))

    open_set: list[tuple[float, float, tuple[int, int]]] = [(heuristic(start), 0.0, start)]
    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    best_cost = {start: 0.0}
    elapsed_hours = {start: 0.0}

    neighbours = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]

    while open_set:
        _, cost_so_far, current = heapq.heappop(open_set)
        if current == goal:
            break
        if cost_so_far > best_cost.get(current, math.inf):
            continue

        for di, dj in neighbours:
            neighbour = (current[0] + di, current[1] + dj)
            if neighbour not in navigable:
                continue  # land, or outside the grid

            leg_km = _haversine_km(
                (lats[current[0]], lons[current[1]]),
                (lats[neighbour[0]], lons[neighbour[1]]),
            )
            hours = elapsed_hours[current] + leg_km / CRUISE_SPEED_KMH
            wave = _cost_at_arrival(
                grid.get(("series", neighbour[0], neighbour[1]), []),  # type: ignore[arg-type]
                hours,
                grid[neighbour] or 0.0,
            )

            step_cost = leg_km * (1.0 + WAVE_COST_WEIGHT * wave)
            new_cost = cost_so_far + step_cost

            if new_cost < best_cost.get(neighbour, math.inf):
                best_cost[neighbour] = new_cost
                elapsed_hours[neighbour] = hours
                came_from[neighbour] = current
                heapq.heappush(open_set, (new_cost + heuristic(neighbour), new_cost, neighbour))

    if goal not in came_from and goal != start:
        raise RouteUnavailable(
            "no navigable path exists between these points on the forecast grid — "
            "land may block every route at this resolution"
        )

    # ── Walk the path back ────────────────────────────────────────────────
    path = [goal]
    while path[-1] != start:
        path.append(came_from[path[-1]])
    path.reverse()

    coordinates = [[lons[j], lats[i]] for i, j in path]
    distance_km = sum(
        _haversine_km((lats[a[0]], lons[a[1]]), (lats[b[0]], lons[b[1]]))
        for a, b in itertools.pairwise(path)
    )
    waves = [grid[cell] for cell in path if grid.get(cell) is not None]
    max_wave = max(waves) if waves else 0.0
    hours = distance_km / CRUISE_SPEED_KMH

    depart = (
        datetime.fromisoformat(departure_time)
        if departure_time
        else datetime.now(timezone.utc)
    )

    logger.info(
        "route: %d cells, %.0f km, peak wave %.2f m, ~%.1f h",
        len(path), distance_km, max_wave, hours,
    )

    evidence = [
        Evidence(field="route_distance", value=round(distance_km, 1), unit="km",
                 source=SOURCE, location=origin),
        Evidence(field="route_max_wave_height", value=round(max_wave, 2), unit="m",
                 source=SOURCE, time=depart + timedelta(hours=hours), location=destination),
        Evidence(field="route_duration", value=round(hours, 1), unit="h",
                 source=f"estimated at {CRUISE_SPEED_KMH:g} km/h cruising speed",
                 location=origin),
    ]

    return {
        "geojson": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coordinates},
                    "properties": {
                        "distance_km": round(distance_km, 1),
                        "max_wave_m": round(max_wave, 2),
                        "hours": round(hours, 1),
                        "source": SOURCE,
                        "method": (
                            "A* over a forecast wave-height grid, cost evaluated at "
                            "estimated time of arrival per cell"
                        ),
                    },
                }
            ],
        },
        "evidence": evidence,
        "distance_km": round(distance_km, 1),
        "max_wave_m": round(max_wave, 2),
        "hours": round(hours, 1),
        "attribution": [ATTRIBUTION],
    }
