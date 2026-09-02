"""Open-Meteo Marine — the sea-state backbone.

Owner: B · Phase: P0
Endpoint: https://marine-api.open-meteo.com/v1/marine
Auth: none · Quota: ~10 000 calls/day · Horizon: 16 days · Cache TTL: 1 hour

Wave height, period, direction, swell, sea-surface temperature, ocean currents.
The most decisive input to the safety verdict (golden query #2).

## Why this adapter samples a ring of points, not one

Measured at Kakinada on 27 Aug 2026: the geocoded harbour cell (16.96, 82.24) reports a
peak wave height of **0.56 m**, while points 25 km offshore in the same fishing ground
report **1.4 m** — and the 1.5 m caution threshold sits between them. Sampling at the
harbour wall would answer GO for a sea state that deserves CAUTION.

So ``fetch`` samples the requested point plus a ring around it and returns every valid
candidate. ``get_sea_state_evidence`` reports the **worst** of them and records which
point it came from in ``Evidence.location``, so the user can see exactly where the number
applies. A safety system should err toward the rougher reading.

Land cells are excluded by testing for an all-null series: Open-Meteo returns HTTP 200
with nulls over land rather than an error (verified: an inland point returns 0/24
non-null), so the null test is the land test.
"""

from __future__ import annotations

import asyncio
import logging
import math
from datetime import datetime

from app.adapters.base import (
    AdapterError,
    fetch_with_cascade,
    get_json,
    has_any_values,
    peak_in_window,
    slice_window,
)
from app.schemas.response import Evidence, Location
from app.services.cache import cache_key

logger = logging.getLogger(__name__)

BASE_URL = "https://marine-api.open-meteo.com/v1/marine"
CACHE_TTL = 3600
ATTRIBUTION = "Weather data by Open-Meteo.com (CC BY 4.0)"

HOURLY_FIELDS = [
    "wave_height",
    "wave_direction",
    "wave_period",
    "swell_wave_height",
    "swell_wave_period",
    "sea_surface_temperature",
    "ocean_current_velocity",
    "ocean_current_direction",
]

# How far offshore to look for the fishing ground, and how many bearings to try.
# Eight bearings at 25 km costs one HTTP request (the API takes comma-separated
# coordinates and returns an array), so the resolution is nearly free.
SAMPLE_RADIUS_KM = 25.0
SAMPLE_BEARINGS = list(range(0, 360, 45))

# Human-readable model attribution. Open-Meteo's marine endpoint does not report which
# wave model served a given point, so we name the family rather than claim a specific run.
SOURCE = "Open-Meteo Marine"

# Units as the API reports them, so Evidence carries the right label without a lookup.
UNITS = {
    "wave_height": "m",
    "wave_direction": "°",
    "wave_period": "s",
    "swell_wave_height": "m",
    "swell_wave_period": "s",
    "sea_surface_temperature": "°C",
    "ocean_current_velocity": "km/h",
    "ocean_current_direction": "°",
}


def _offset_point(lat: float, lon: float, bearing_deg: float, distance_km: float) -> tuple[float, float]:
    """Approximate destination point. Good enough for choosing sample sites.

    Longitude is scaled by cos(latitude) — at 17°N a degree of longitude is ~4.5% shorter
    than a degree of latitude, and ignoring that skews the ring eastward. Exact geodesics
    live in ``agents.geospatial``; this only has to land in the right grid cell.
    """
    bearing = math.radians(bearing_deg)
    dlat = (distance_km / 111.32) * math.cos(bearing)
    dlon = (distance_km / (111.32 * math.cos(math.radians(lat)))) * math.sin(bearing)
    return lat + dlat, lon + dlon


def candidate_points(lat: float, lon: float, radius_km: float = SAMPLE_RADIUS_KM) -> list[tuple[float, float]]:
    """The requested point plus a ring around it, in request order."""
    points = [(lat, lon)]
    for bearing in SAMPLE_BEARINGS:
        points.append(_offset_point(lat, lon, bearing, radius_km))
    return points


async def fetch(lat: float, lon: float, forecast_days: int = 7) -> dict:
    """Raw marine forecast for a point. Single cell, no ring — the plain lookup."""
    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "hourly": ",".join(HOURLY_FIELDS),
        "forecast_days": forecast_days,
        # UTC everywhere: the response contract is UTC, and 'auto' would silently make
        # every timestamp local to whichever cell we happened to sample.
        "timezone": "UTC",
    }
    key = cache_key("open_meteo_marine", params)
    result = await fetch_with_cascade(
        key, lambda: get_json(BASE_URL, params), CACHE_TTL, SOURCE
    )
    return result.payload


async def fetch_area(
    lat: float, lon: float, forecast_days: int = 7, radius_km: float = SAMPLE_RADIUS_KM
) -> list[dict]:
    """Marine forecast for the point and its offshore ring, land cells removed.

    One HTTP request: the endpoint accepts comma-separated coordinates and returns an
    array in the same order. Returns only candidates that carry real wave data, so an
    inland query yields an empty list rather than a confident "no waves".
    """
    points = candidate_points(lat, lon, radius_km)
    params = {
        "latitude": ",".join(f"{p[0]:.4f}" for p in points),
        "longitude": ",".join(f"{p[1]:.4f}" for p in points),
        "hourly": ",".join(HOURLY_FIELDS),
        "forecast_days": forecast_days,
        "timezone": "UTC",
    }
    key = cache_key("open_meteo_marine_area", params)
    result = await fetch_with_cascade(
        key, lambda: get_json(BASE_URL, params), CACHE_TTL, SOURCE
    )

    payload = result.payload
    # A single-point request returns a dict; the multi-point form returns a list. Accept
    # both so a cached entry written by either shape still loads.
    cells = payload if isinstance(payload, list) else [payload]

    # Adjacent bearings often snap to the same forecast cell — dedupe on the coordinates
    # the API echoes back, so a cell isn't weighted twice and the spike output reads clean.
    valid = []
    seen: set[tuple[float, float]] = set()
    for cell in cells:
        hourly = cell.get("hourly") or {}
        if not has_any_values(hourly, "wave_height"):
            continue
        snapped = (round(cell.get("latitude", 0), 4), round(cell.get("longitude", 0), 4))
        if snapped in seen:
            continue
        seen.add(snapped)
        valid.append(cell)

    if not valid:
        logger.info(
            "marine: no valid sea cell within %.0f km of %.3f,%.3f — treating as inland",
            radius_km,
            lat,
            lon,
        )
    return valid


async def get_sea_state_evidence(
    lat: float, lon: float, start: str, end: str
) -> list[Evidence]:
    """Evidence for the risk agent: the worst conditions within the window.

    Reports the peak across every valid cell in the sampled area, with the hour it occurs
    in ``Evidence.time`` and the sampled point in ``Evidence.location``.

    Raises AdapterError when there is no sea within range, so the caller can emit a
    `skipped` trace step. Returning an empty list would read identically to calm water.
    """
    window_start = datetime.fromisoformat(start) if isinstance(start, str) else start
    window_end = datetime.fromisoformat(end) if isinstance(end, str) else end

    cells = await fetch_area(lat, lon)
    if not cells:
        raise AdapterError(
            f"no sea within {SAMPLE_RADIUS_KM:.0f} km of this location — it appears to "
            f"be inland"
        )

    # For each field, keep the worst reading found anywhere in the sampled area.
    worst: dict[str, tuple[float, datetime, dict]] = {}
    for cell in cells:
        hourly = cell.get("hourly") or {}
        indices = slice_window(hourly, window_start, window_end)
        if not indices:
            continue
        for field in HOURLY_FIELDS:
            # Directions are circular — a "maximum bearing" is meaningless, so they ride
            # along with the peak reading of the field they describe rather than being
            # maximised on their own.
            if field.endswith("_direction"):
                continue
            found = peak_in_window(hourly, field, indices, mode="max")
            if found is None:
                continue
            value, when = found
            if field not in worst or value > worst[field][0]:
                worst[field] = (value, when, cell)

    if not worst:
        raise AdapterError(
            f"marine forecast has no hours inside the requested window "
            f"({window_start:%Y-%m-%d %H:%M} → {window_end:%Y-%m-%d %H:%M} UTC)"
        )

    evidence = []
    for field, (value, when, cell) in worst.items():
        evidence.append(
            Evidence(
                field=field,
                value=round(value, 2),
                unit=UNITS.get(field),
                source=SOURCE,
                time=when,
                location=Location(
                    lat=cell.get("latitude", lat),
                    lon=cell.get("longitude", lon),
                    name=None,
                    source="marine_grid_sample",
                ),
            )
        )
    return evidence


async def _spike() -> None:
    """P0 spike: prove we can get a real wave height for a named port."""
    lat, lon = 16.99, 82.24  # Kakinada
    print(f"Open-Meteo Marine — Kakinada ({lat}, {lon})\n")

    single = await fetch(lat, lon, forecast_days=2)
    hourly = single.get("hourly", {})
    waves = [v for v in hourly.get("wave_height", []) if v is not None]
    print(f"  single cell  {single.get('latitude'):.3f},{single.get('longitude'):.3f}")
    print(f"    wave_height  now {waves[0] if waves else '—'} m   peak {max(waves) if waves else '—'} m")

    cells = await fetch_area(lat, lon, forecast_days=2)
    print(f"\n  offshore ring: {len(cells)}/{len(SAMPLE_BEARINGS) + 1} candidates are sea")
    for cell in cells:
        cw = [v for v in (cell.get("hourly", {}).get("wave_height") or []) if v is not None]
        print(f"    {cell.get('latitude'):7.3f},{cell.get('longitude'):7.3f}  peak {max(cw) if cw else '—'} m")

    from datetime import timedelta
    from datetime import timezone as _tz

    now = datetime.now(_tz.utc)
    evidence = await get_sea_state_evidence(
        lat, lon, now.isoformat(), (now + timedelta(hours=24)).isoformat()
    )
    print("\n  evidence for the next 24 h (worst in the sampled area):")
    for item in evidence:
        loc = item.location
        print(
            f"    {item.field:26} {item.value:>7} {item.unit or '':4} "
            f"at {item.time:%d %b %H:%M} UTC  ({loc.lat:.2f},{loc.lon:.2f})"
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    asyncio.run(_spike())
