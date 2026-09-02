"""Adapter parsing tests.

Owner: C (with B) · Phase: P1

> **No live network calls in tests.** Record a fixture once, commit it, test against it.
> A test suite that needs the internet is a test suite that fails on demo morning.

Fixtures in ``backend/tests/fixtures/`` were captured from real responses on 27 Aug 2026.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from app.adapters import base, incois_pfz, open_meteo_weather
from app.agents.geospatial import compass_point, distance_and_bearing
from app.schemas.response import Location

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def window_over(payload: dict, hours: int = 24) -> tuple[datetime, datetime]:
    """A window anchored to the fixture's own timestamps, so it never goes stale."""
    first = base.parse_hour(payload["hourly"]["time"][0])
    return first, first + timedelta(hours=hours)


# ── Open-Meteo Marine ─────────────────────────────────────────────────────


def test_open_meteo_marine_parses_wave_height():
    payload = load("open_meteo_marine.json")
    hourly = payload["hourly"]
    start, end = window_over(payload)

    indices = base.slice_window(hourly, start, end)
    assert indices, "the fixture's own first 24 h must be inside the window"

    found = base.peak_in_window(hourly, "wave_height", indices)
    assert found is not None
    value, when = found
    assert 0.0 < value < 20.0, f"implausible wave height: {value}"
    assert when.tzinfo is not None, "timestamps must be timezone-aware"


def test_open_meteo_marine_handles_land_nulls():
    """Open-Meteo returns nulls over land. A coastal point can land on a land cell —
    that must be detected, not passed through as "no waves"."""
    land = load("open_meteo_marine_land.json")
    sea = load("open_meteo_marine.json")

    assert not base.has_any_values(land["hourly"], "wave_height"), (
        "the inland fixture must have no wave values at all"
    )
    assert base.has_any_values(sea["hourly"], "wave_height")

    # The peak of an all-null series is None, never 0.0 — 0.0 would read as flat calm.
    indices = list(range(len(land["hourly"]["time"])))
    assert base.peak_in_window(land["hourly"], "wave_height", indices) is None


def test_peak_returns_the_maximum_not_the_first():
    """A safety verdict cares about the worst hour, not the current one."""
    hourly = {
        "time": ["2026-08-27T00:00", "2026-08-27T01:00", "2026-08-27T02:00"],
        "wave_height": [0.5, 3.4, 1.0],
    }
    value, when = base.peak_in_window(hourly, "wave_height", [0, 1, 2])
    assert value == 3.4
    assert when.hour == 1, "the reported time must be the hour the peak occurs"


def test_peak_min_mode_for_visibility():
    """Visibility is the one field where lower is worse."""
    hourly = {
        "time": ["2026-08-27T00:00", "2026-08-27T01:00"],
        "visibility": [20000.0, 300.0],
    }
    value, _ = base.peak_in_window(hourly, "visibility", [0, 1], mode="min")
    assert value == 300.0


def test_window_outside_forecast_horizon_is_empty():
    """An empty window must be distinguishable from calm conditions."""
    payload = load("open_meteo_marine.json")
    far_future = datetime.now(timezone.utc) + timedelta(days=400)
    indices = base.slice_window(
        payload["hourly"], far_future, far_future + timedelta(hours=6)
    )
    assert indices == []


# ── Open-Meteo Weather ────────────────────────────────────────────────────


def test_weather_does_not_request_the_dead_thunderstorm_field():
    """Regression guard for the silent-null finding.

    ``thunderstorm_probability`` returns HTTP 200 with every hour null, so a rule keyed
    to it can never fire while looking perfectly wired. CAPE replaced it.
    """
    assert "thunderstorm_probability" not in open_meteo_weather.HOURLY_FIELDS
    assert "cape" in open_meteo_weather.HOURLY_FIELDS


def test_weather_fixture_has_real_cape_values():
    """The replacement field must actually carry data — that was the whole point."""
    payload = load("open_meteo_weather.json")
    assert base.has_any_values(payload["hourly"], "cape")


def test_lightning_source_string_declares_the_proxy():
    """Overclaiming a modelled value as an observation is the failure we guard against."""
    source = open_meteo_weather.LIGHTNING_PROXY_SOURCE.casefold()
    assert "proxy" in source
    assert "imd" in source and "not" in source


def test_wind_direction_excluded_from_peak_scan():
    """Maximising a compass bearing is meaningless — 350° is not 'worse' than 10°."""
    assert "wind_direction_10m" in open_meteo_weather.CIRCULAR_FIELDS


# ── INCOIS ────────────────────────────────────────────────────────────────


def test_incois_parser_against_recorded_page():
    """The highest-value adapter test — this parser is the project's #1 risk.

    The recorded page is the real one from the P0 gate check: a client-rendered
    navigation shell with no advisory content. The parser must report that honestly.
    """
    html = (FIXTURES / "incois_pfz_page.html").read_text(encoding="utf-8", errors="replace")
    result = incois_pfz.parse_advisory_html(html)

    assert result["status"] == incois_pfz.STATUS_UNPARSEABLE, (
        "a page with no advisory content must NOT report as a successful empty parse"
    )
    assert result["zones"] == []
    assert result["detail"], "an unparseable result must explain itself"


def test_incois_no_advisory_is_not_an_error():
    """None are issued during the ban period. Must return "none issued", not an empty
    success that reads identically to a failure."""
    html = "<html><body><p>No PFZ advisory is issued today.</p></body></html>"
    result = incois_pfz.parse_advisory_html(html)

    assert result["status"] == incois_pfz.STATUS_NONE_ISSUED
    assert result["status"] != incois_pfz.STATUS_UNPARSEABLE, (
        "'none issued' and 'we failed to parse' must be distinguishable states"
    )


def test_incois_parses_coordinates_when_present():
    """If INCOIS ever serves real advisory text, we must pick the nodes out of it."""
    html = """<html><body>
        <p>PFZ advisory: 16.5 N 82.3 E and 17.25 N 83.10 E</p>
        <p>Ignore 99.9 N 12.0 E which is outside Indian waters</p>
    </body></html>"""
    result = incois_pfz.parse_advisory_html(html)

    assert result["status"] == incois_pfz.STATUS_PARSED
    assert len(result["zones"]) == 2, "out-of-bounds coordinates must be filtered out"
    assert result["zones"][0] == {"lat": 16.5, "lon": 82.3}


# ── Geodesy ───────────────────────────────────────────────────────────────


def test_geodesic_distance_not_euclidean():
    """At 17°N a degree of longitude is ~15% shorter than a degree of latitude.
    Euclidean error here is measured in kilometres."""
    origin = Location(lat=17.0, lon=82.0)

    one_degree_north = Location(lat=18.0, lon=82.0)
    one_degree_east = Location(lat=17.0, lon=83.0)

    north_km, north_bearing = distance_and_bearing(origin, one_degree_north)
    east_km, east_bearing = distance_and_bearing(origin, one_degree_east)

    assert 110.0 < north_km < 112.0, f"a degree of latitude is ~111 km, got {north_km}"
    assert 105.0 < east_km < 107.0, (
        f"a degree of longitude at 17°N is ~106 km, got {east_km}. "
        "If this is ~111 km, the code went euclidean."
    )
    # The difference is ~5 km — far too large to wave away in a geofencing product.
    assert north_km - east_km > 4.0

    assert abs(north_bearing - 0.0) < 1.0 or abs(north_bearing - 360.0) < 1.0
    assert abs(east_bearing - 90.0) < 1.0


def test_compass_point_naming():
    """A fisherman reads 'north-east', not '045°'."""
    assert compass_point(0) == "N"
    assert compass_point(45) == "NE"
    assert compass_point(90) == "E"
    assert compass_point(180) == "S"
    assert compass_point(270) == "W"
    assert compass_point(359) == "N", "the compass must wrap"


# ── Cache ─────────────────────────────────────────────────────────────────


def test_cache_key_is_stable_and_rounds_coordinates():
    from app.services.cache import cache_key

    a = cache_key("marine", {"latitude": 16.9899999, "longitude": 82.24, "days": 7})
    b = cache_key("marine", {"days": 7, "longitude": 82.24, "latitude": 16.99})
    assert a == b, "key order and sub-metre coordinate noise must not split the cache"

    c = cache_key("marine", {"latitude": 17.99, "longitude": 82.24, "days": 7})
    assert a != c, "genuinely different points must not collide"


@pytest.mark.asyncio
async def test_adapter_never_raises_on_network_failure():
    """Total failure returns the mock rung. A dead source must never 500."""
    from app.services import cache

    key = cache.cache_key("test_adapter", {"probe": "cascade"})

    async def always_fails():
        raise base.AdapterError("simulated outage")

    # Seed a cache entry, then confirm a failed live call serves it rather than raising.
    cache.put(key, {"served": "from-cache"})
    result = await base.fetch_with_cascade(key, always_fails, ttl_seconds=0, source="test")

    assert result.payload == {"served": "from-cache"}
    assert result.tier is base.DataTier.CACHE
    assert result.is_degraded, "a cache hit after a live failure must be flagged degraded"


@pytest.mark.asyncio
async def test_cascade_falls_back_to_cache_on_network_failure():
    """live fails → stale cache is served → the tier is reported as CACHE."""
    from app.services import cache

    key = cache.cache_key("test_adapter", {"probe": "stale"})
    cache.put(key, {"age": "stale"})

    async def always_fails():
        raise base.AdapterError("down")

    # ttl=0 makes the entry immediately stale, so the fresh-cache rung is skipped and we
    # exercise the stale-read path specifically.
    result = await base.fetch_with_cascade(key, always_fails, ttl_seconds=0, source="test")
    assert result.tier is base.DataTier.CACHE


@pytest.mark.asyncio
async def test_cascade_raises_only_when_every_rung_is_exhausted():
    """With no cache and no mock, the cascade raises so the node can emit `skipped`."""
    from app.services import cache

    key = cache.cache_key("test_adapter", {"probe": "nothing-anywhere"})

    async def always_fails():
        raise base.AdapterError("down")

    with pytest.raises(base.AdapterError):
        await base.fetch_with_cascade(key, always_fails, ttl_seconds=60, source="test")
