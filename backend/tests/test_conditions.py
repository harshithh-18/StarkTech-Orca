"""Conditions-snapshot tests.

Owner: C · Phase: P4

The dashboard answers a safety question without anyone asking one, so the property that
matters is **agreement**: the verdict it shows must be the verdict ``risk_rules`` would
give for the same readings, and a tile's colour must be the band that same module assigns.
A dashboard that disagreed with the chat answer would be worse than no dashboard.

No network: both adapters are stubbed with the recorded fixtures the rest of the suite
uses, so these tests pin the reduction, not Open-Meteo's uptime.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.schemas.enums import Verdict
from app.schemas.response import Location
from app.services import conditions, risk_rules

FIXTURES = Path(__file__).parent / "fixtures"


def _shift_to_now(hourly: dict) -> dict:
    """Re-stamp a recorded fixture so its hours straddle 'now'.

    The fixtures were captured on a fixed date; the snapshot looks for the hour nearest
    the current time and would find nothing years later. Only the timestamps move — every
    value stays exactly as recorded.
    """
    count = len(hourly.get("time") or [])
    origin = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    hourly = dict(hourly)
    hourly["time"] = [
        (origin + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(count)
    ]
    return hourly


@pytest.fixture
def stub_models(monkeypatch):
    """Serve both upstream models from the recorded fixtures."""
    marine = json.loads((FIXTURES / "open_meteo_marine.json").read_text())
    weather = json.loads((FIXTURES / "open_meteo_weather.json").read_text())

    marine["hourly"] = _shift_to_now(marine["hourly"])
    weather["hourly"] = _shift_to_now(weather["hourly"])
    # The tide field post-dates the recorded fixture; synthesise a plain sinusoid so the
    # tide summary has something to find. Amplitude and period are illustrative, not a
    # claim about Kakinada.
    import math

    marine["hourly"]["sea_level_height_msl"] = [
        round(0.5 * math.sin(i * math.pi / 6), 3)
        for i in range(len(marine["hourly"]["time"]))
    ]

    async def fake_fetch_area(lat, lon, forecast_days=7, radius_km=25.0):
        return [{**marine, "latitude": lat, "longitude": lon}]

    async def fake_weather_fetch(lat, lon, forecast_days=7):
        return weather

    monkeypatch.setattr(conditions.open_meteo_marine, "fetch_area", fake_fetch_area)
    monkeypatch.setattr(conditions.open_meteo_weather, "fetch", fake_weather_fetch)
    return marine, weather


KAKINADA = Location(lat=16.99, lon=82.24, name="Kakinada")


@pytest.mark.asyncio
async def test_snapshot_returns_tiles_and_a_verdict(stub_models):
    snapshot = await conditions.snapshot(KAKINADA)

    assert snapshot.tiles, "a snapshot with no tiles reads as calm water — never ship one"
    assert snapshot.verdict in {Verdict.GO, Verdict.CAUTION, Verdict.NO_GO}
    assert snapshot.reasons, "a verdict must always explain itself"
    assert snapshot.attribution


@pytest.mark.asyncio
async def test_the_verdict_matches_the_shared_risk_rules(stub_models):
    """The whole point: one verdict function, two surfaces."""
    snapshot = await conditions.snapshot(KAKINADA)
    independent = risk_rules.evaluate(snapshot.evidence)

    assert snapshot.verdict is independent["verdict"]


@pytest.mark.asyncio
async def test_every_tile_band_matches_the_thresholds(stub_models):
    snapshot = await conditions.snapshot(KAKINADA)

    for tile in snapshot.tiles:
        if tile.field not in risk_rules.THRESHOLDS:
            # No limit exists, so the tile must not imply one was checked.
            assert tile.band == "none"
            assert tile.threshold is None
            continue
        assert tile.band == (risk_rules.breaches(tile.field, tile.value) or "go")


@pytest.mark.asyncio
async def test_peak_band_is_scored_separately_from_the_current_reading(stub_models):
    """A reading can be inside the limits now and past them by evening."""
    snapshot = await conditions.snapshot(KAKINADA)

    for tile in snapshot.tiles:
        if tile.peak_value is None or tile.field not in risk_rules.THRESHOLDS:
            continue
        assert tile.peak_band == (risk_rules.breaches(tile.field, tile.peak_value) or "go")


@pytest.mark.asyncio
async def test_evidence_only_carries_fields_the_verdict_can_check(stub_models):
    """Anything else in the list would be a number the user cannot verify."""
    snapshot = await conditions.snapshot(KAKINADA)
    assert {item.field for item in snapshot.evidence} <= set(risk_rules.THRESHOLDS)


@pytest.mark.asyncio
async def test_tide_summary_is_present_and_labelled_as_modelled(stub_models):
    snapshot = await conditions.snapshot(KAKINADA)

    assert snapshot.tide is not None
    assert snapshot.tide.state in {"rising", "falling", "unknown"}
    assert "modelled" in snapshot.tide.source.lower()


@pytest.mark.asyncio
async def test_a_missing_weather_model_degrades_rather_than_failing(monkeypatch, stub_models):
    """One model down costs the user some tiles, not the page."""

    async def broken(lat, lon, forecast_days=7):
        raise RuntimeError("weather model unreachable")

    monkeypatch.setattr(conditions.open_meteo_weather, "fetch", broken)
    snapshot = await conditions.snapshot(KAKINADA)

    assert snapshot.tiles, "the marine tiles should still be there"
    assert snapshot.degraded, "and the snapshot must say what is missing"
    assert any("weather" in note for note in snapshot.degraded)
    # Missing safety-critical data caps the verdict — never a GO on half the picture.
    assert snapshot.verdict is not Verdict.GO


@pytest.fixture
def inland(monkeypatch, stub_models):
    """A point with no sea in range — the Hyderabad case."""

    async def no_sea(lat, lon, forecast_days=7, radius_km=25.0):
        return []

    monkeypatch.setattr(conditions.open_meteo_marine, "fetch_area", no_sea)


HYDERABAD = Location(lat=17.38, lon=78.48, name="Hyderabad")


@pytest.mark.asyncio
async def test_an_inland_point_gives_no_verdict_at_all(inland):
    """Not a cautious verdict — no verdict.

    Reporting CAUTION here was the single most misleading thing this system did: "sea
    state data was unavailable, so conditions could not be fully checked" reads as *the
    sea near you might be rough*, 400 km from any sea.
    """
    snapshot = await conditions.snapshot(HYDERABAD)

    assert snapshot.coastal is False
    assert snapshot.verdict is Verdict.NOT_APPLICABLE
    assert all(tile.field not in {"wave_height", "swell_wave_height"} for tile in snapshot.tiles)


@pytest.mark.asyncio
async def test_an_inland_point_names_the_nearest_coast(inland):
    """"Then where?" is the question the user actually has."""
    snapshot = await conditions.snapshot(HYDERABAD)

    assert snapshot.nearest_coast is not None
    assert snapshot.nearest_coast.name == "Kakinada"
    assert snapshot.nearest_coast.distance_km > 100
    assert snapshot.nearest_coast.bearing
    assert any("inland" in reason for reason in snapshot.reasons)
    assert any("Kakinada" in reason for reason in snapshot.reasons)


@pytest.mark.asyncio
async def test_an_inland_point_offers_no_departure_window(inland):
    """A sailing window scored on inland wind against a wave rulebook is nonsense."""
    snapshot = await conditions.snapshot(HYDERABAD)

    assert snapshot.next_window is None
    assert snapshot.windows == []
    assert snapshot.tide is None


@pytest.mark.asyncio
async def test_inland_weather_tiles_carry_no_safety_colour(inland):
    """The readings are true; the small-craft banding is not applicable to them."""
    snapshot = await conditions.snapshot(HYDERABAD)

    assert snapshot.tiles, "the weather readings are still real and still worth showing"
    assert all(tile.band == "none" for tile in snapshot.tiles)
    assert snapshot.evidence == [], "nothing here was checked against a marine limit"


@pytest.mark.asyncio
async def test_series_from_two_models_are_aligned_before_being_scored():
    """An unaligned series is the one bug that produces a confidently wrong window."""
    target = ["T0", "T1", "T2", "T3"]
    aligned = conditions._align(["T1", "T2"], [10.0, 20.0], target)

    assert aligned == [None, 10.0, 20.0, None]
    assert len(aligned) == len(target)
