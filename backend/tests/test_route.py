"""Route planning tests — golden query #5.

Owner: E · Phase: P3 (stretch)

The A* itself is pure arithmetic over a grid, so it is tested against a synthetic wave
field with no network involved. The property that matters most is that the route **goes
around** rough water rather than through it — otherwise it is just a straight line with
extra steps.
"""

from __future__ import annotations

import pytest
from app.agents import route
from app.schemas.response import Location

KAKINADA = Location(lat=16.99, lon=82.24, name="Kakinada")
CHENNAI = Location(lat=13.08, lon=80.27, name="Chennai")


# ── Geometry ──────────────────────────────────────────────────────────────


def test_haversine_matches_known_distance():
    """Kakinada → Chennai is ~470 km in a straight line."""
    km = route._haversine_km((16.99, 82.24), (13.08, 80.27))
    assert 440 < km < 500, f"got {km} km"


def test_haversine_is_symmetric_and_zero_for_a_point():
    a, b = (16.99, 82.24), (13.08, 80.27)
    assert route._haversine_km(a, b) == pytest.approx(route._haversine_km(b, a))
    assert route._haversine_km(a, a) == pytest.approx(0.0)


def test_grid_is_capped_for_long_journeys():
    """A long route must coarsen rather than build a grid that hammers the forecast API."""
    lats, lons = route._build_grid(
        Location(lat=8.0, lon=77.0), Location(lat=22.0, lon=88.0)
    )
    assert len(lats) * len(lons) <= route.MAX_GRID_CELLS


def test_grid_spans_both_endpoints():
    lats, lons = route._build_grid(KAKINADA, CHENNAI)
    assert min(lats) < CHENNAI.lat and max(lats) > KAKINADA.lat
    assert min(lons) < CHENNAI.lon and max(lons) > KAKINADA.lon


# ── Cost at arrival ───────────────────────────────────────────────────────


def test_cost_uses_the_hour_of_arrival_not_departure():
    """The classic route-planner bug: costing every cell on departure conditions sends
    the path into weather that had not arrived yet when the route was drawn."""
    series = [0.5, 0.5, 0.5, 4.0, 4.0]  # calm now, rough in three hours

    assert route._cost_at_arrival(series, 0, 0.0) == 0.5
    assert route._cost_at_arrival(series, 3, 0.0) == 4.0


def test_cost_clamps_beyond_the_forecast_horizon():
    series = [1.0, 2.0, 3.0]
    assert route._cost_at_arrival(series, 99, 0.0) == 3.0


def test_cost_skips_null_hours_rather_than_reading_them_as_calm():
    """A gap in the forecast is missing data, not flat water."""
    series = [1.5, None, 1.7]
    assert route._cost_at_arrival(series, 1, 0.0) in (1.5, 1.7)


def test_cost_falls_back_when_there_is_no_series():
    assert route._cost_at_arrival([], 4, 2.2) == 2.2


# ── Session store ─────────────────────────────────────────────────────────


def test_route_is_recalled_per_session():
    """The frozen response contract has no field for geometry, so the map fetches the
    line by session id instead."""
    geojson = {"type": "FeatureCollection", "features": []}
    route.remember("session-a", geojson)

    assert route.recall("session-a") is geojson
    assert route.recall("session-b") is None


def test_route_store_is_bounded():
    """A long demo must not leak every route it ever drew."""
    for i in range(route._RECENT_LIMIT + 12):
        route.remember(f"bounded-{i}", {"features": []})

    assert len(route._recent) <= route._RECENT_LIMIT


# ── Behaviour ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_route_steers_around_rough_water(monkeypatch):
    """The whole point: a least-risk path is not the straight line.

    A wall of high waves is placed across the direct route with calm water to the south;
    the path must detour rather than plough through it.
    """
    lats = [10.0 + 0.1 * i for i in range(12)]
    lons = [80.0 + 0.1 * j for j in range(12)]

    async def fake_grid(grid_lats, grid_lons):
        grid: dict = {}
        for i in range(len(grid_lats)):
            for j in range(len(grid_lons)):
                # A rough band across the middle rows, open at the southern edge.
                rough = 5 <= i <= 7 and j >= 2
                wave = 6.0 if rough else 0.3
                grid[(i, j)] = wave
                grid[("series", i, j)] = [wave] * 48
        return grid

    monkeypatch.setattr(route, "_build_grid", lambda o, d: (lats, lons))
    monkeypatch.setattr(route, "_wave_grid", fake_grid)

    result = await route.plan_route(
        Location(lat=lats[2], lon=lons[6]), Location(lat=lats[10], lon=lons[6])
    )

    coordinates = result["geojson"]["features"][0]["geometry"]["coordinates"]
    assert len(coordinates) > 2
    # It crossed the band somewhere — but through the calm gap, not the 6 m wall.
    assert result["max_wave_m"] < 6.0, "the route ploughed straight through rough water"


@pytest.mark.asyncio
async def test_land_is_impassable(monkeypatch):
    """A None cell is land. A route through a headland is an instant credibility loss."""
    lats = [10.0 + 0.1 * i for i in range(8)]
    lons = [80.0 + 0.1 * j for j in range(8)]

    async def fake_grid(grid_lats, grid_lons):
        grid: dict = {}
        for i in range(len(grid_lats)):
            for j in range(len(grid_lons)):
                # A land bar across the middle, fully blocking the grid.
                land = i == 4
                grid[(i, j)] = None if land else 0.4
                grid[("series", i, j)] = [] if land else [0.4] * 48
        return grid

    monkeypatch.setattr(route, "_build_grid", lambda o, d: (lats, lons))
    monkeypatch.setattr(route, "_wave_grid", fake_grid)

    with pytest.raises(route.RouteUnavailable, match="no navigable path"):
        await route.plan_route(
            Location(lat=lats[1], lon=lons[3]), Location(lat=lats[7], lon=lons[3])
        )


@pytest.mark.asyncio
async def test_endpoint_on_land_is_rejected_clearly(monkeypatch):
    lats = [10.0 + 0.1 * i for i in range(6)]
    lons = [80.0 + 0.1 * j for j in range(6)]

    async def fake_grid(grid_lats, grid_lons):
        grid: dict = {}
        for i in range(len(grid_lats)):
            for j in range(len(grid_lons)):
                grid[(i, j)] = None if (i, j) == (0, 0) else 0.4
                grid[("series", i, j)] = [0.4] * 48
        return grid

    monkeypatch.setattr(route, "_build_grid", lambda o, d: (lats, lons))
    monkeypatch.setattr(route, "_wave_grid", fake_grid)

    with pytest.raises(route.RouteUnavailable, match="navigable water"):
        await route.plan_route(
            Location(lat=lats[0], lon=lons[0], name="A field"),
            Location(lat=lats[4], lon=lons[4]),
        )
