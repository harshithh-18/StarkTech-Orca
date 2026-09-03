"""Cyclone-proxy tests.

Owner: C (with B) · Phase: P4

This module classifies a *model field* against IMD's published wind bands. It is not an IMD
bulletin, and the tests exist mainly to make sure it never behaves as though it were:

  - both tests must pass — gale-force wind AND a pressure signature. Wind alone is a
    squall; low pressure alone is the monsoon trough. Requiring both is what stops this
    crying cyclone every July.
  - only a **cyclonic storm** or worse sets ``cyclone_bulletin_active``, which is the flag
    that caps the safety verdict. A depression is reported and left as context.
  - the check ALWAYS returns evidence, including "nothing found". An empty list is
    indistinguishable from the check never running, and in a safety system those two must
    never look the same.
"""

from __future__ import annotations

import pytest

from app.adapters import imd_bulletins
from app.adapters.imd_bulletins import classify


# ── Classification against the published bands ────────────────────────────


@pytest.mark.parametrize(
    "wind_kmh, expected",
    [
        (20.0, None),               # below depression strength
        (30.9, None),               # just under
        (31.0, "depression"),
        (49.0, "depression"),
        (50.0, "deep depression"),
        (61.0, "deep depression"),
        (62.0, "cyclonic storm"),
        (88.0, "cyclonic storm"),
        (89.0, "severe cyclonic storm"),
        (117.0, "severe cyclonic storm"),
        (118.0, "very severe cyclonic storm or above"),
        (250.0, "very severe cyclonic storm or above"),
    ],
)
def test_imd_wind_bands(wind_kmh, expected):
    assert classify(wind_kmh) == expected


# ── The two-test rule ─────────────────────────────────────────────────────


def cell(wind: float, pressure: float, gust: float | None = None) -> dict:
    """One model cell, three hours long, at a constant state."""
    from datetime import datetime, timedelta, timezone

    origin = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    times = [(origin + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(3)]
    return {
        "latitude": 16.99,
        "longitude": 82.24,
        "hourly": {
            "time": times,
            "wind_speed_10m": [wind] * 3,
            "wind_gusts_10m": [gust if gust is not None else wind * 1.4] * 3,
            "pressure_msl": [pressure] * 3,
        },
    }


@pytest.fixture
def stub(monkeypatch):
    """Serve a fixed set of model cells instead of calling Open-Meteo."""
    state: dict = {"cells": []}

    async def fake_cascade(key, fetch_live, ttl=None, source=""):
        class Result:
            payload = state["cells"]

        return Result()

    monkeypatch.setattr(imd_bulletins, "fetch_with_cascade", fake_cascade)
    return state


@pytest.mark.asyncio
async def test_strong_wind_without_low_pressure_is_not_a_system(stub):
    """A squall line, or a strong monsoon flow. Not a tropical cyclone."""
    stub["cells"] = [cell(wind=95.0, pressure=1008.0)]

    assert await imd_bulletins.fetch_active_bulletins(16.99, 82.24) == []


@pytest.mark.asyncio
async def test_low_pressure_without_strong_wind_is_not_a_system(stub):
    stub["cells"] = [cell(wind=18.0, pressure=992.0)]

    assert await imd_bulletins.fetch_active_bulletins(16.99, 82.24) == []


@pytest.mark.asyncio
async def test_both_together_are_reported(stub):
    stub["cells"] = [cell(wind=95.0, pressure=986.0)]

    systems = await imd_bulletins.fetch_active_bulletins(16.99, 82.24)
    assert len(systems) == 1
    assert systems[0]["band"] == "severe cyclonic storm"
    assert systems[0]["pressure_hpa"] == 986.0


@pytest.mark.asyncio
async def test_systems_are_ordered_strongest_first(stub):
    stub["cells"] = [cell(wind=55.0, pressure=996.0), cell(wind=120.0, pressure=970.0)]

    systems = await imd_bulletins.fetch_active_bulletins(16.99, 82.24)
    assert [system["band"] for system in systems] == [
        "very severe cyclonic storm or above",
        "deep depression",
    ]


# ── Evidence ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_nothing_found_is_still_evidence(stub):
    """Absence of a warning is not evidence of safety — say the check ran."""
    stub["cells"] = [cell(wind=15.0, pressure=1009.0)]

    evidence = await imd_bulletins.get_alerts_near(16.99, 82.24)
    assert len(evidence) == 1
    assert evidence[0].field == "cyclone_bulletin_active"
    assert evidence[0].value is False


@pytest.mark.asyncio
async def test_a_depression_is_reported_but_does_not_trip_the_flag(stub):
    """Only a cyclonic storm or worse caps the verdict. A depression is context."""
    stub["cells"] = [cell(wind=45.0, pressure=996.0)]

    evidence = {item.field: item for item in await imd_bulletins.get_alerts_near(16.99, 82.24)}
    assert evidence["cyclone_system_class"].value == "depression"
    assert evidence["cyclone_bulletin_active"].value is False


@pytest.mark.asyncio
async def test_a_cyclonic_storm_trips_the_flag(stub):
    stub["cells"] = [cell(wind=75.0, pressure=985.0)]

    evidence = {item.field: item for item in await imd_bulletins.get_alerts_near(16.99, 82.24)}
    assert evidence["cyclone_bulletin_active"].value is True
    assert evidence["cyclone_system_class"].value == "cyclonic storm"
    assert evidence["cyclone_sustained_wind"].value == 75.0


@pytest.mark.asyncio
async def test_every_value_is_labelled_as_a_modelled_proxy(stub):
    """The honesty requirement, enforced. Never let this read as an IMD bulletin."""
    stub["cells"] = [cell(wind=75.0, pressure=985.0)]

    for item in await imd_bulletins.get_alerts_near(16.99, 82.24):
        assert "modelled proxy" in item.source
        assert "not an IMD bulletin" in item.source


@pytest.mark.asyncio
async def test_a_failed_check_is_not_an_all_clear(monkeypatch):
    """It reports that it could not check, rather than that there is nothing to find."""

    async def broken(key, fetch_live, ttl=None, source=""):
        raise RuntimeError("upstream down")

    monkeypatch.setattr(imd_bulletins, "fetch_with_cascade", broken)

    evidence = await imd_bulletins.get_alerts_near(16.99, 82.24)
    assert len(evidence) == 1
    assert evidence[0].field == "cyclone_check_failed"
    assert "upstream down" in str(evidence[0].value)
