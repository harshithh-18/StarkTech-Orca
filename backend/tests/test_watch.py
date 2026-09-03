"""Proactive-watch tests.

Owner: C · Phase: P4

A watch is the only part of ORCA that speaks without being spoken to, so the tests are
about restraint as much as about detection:

  - it raises what is genuinely new
  - it does **not** re-announce a hazard it has already announced
  - it does not raise anything for a field that has no threshold
  - it does not warn about the EEZ, whose landward edge is the coastline — a warning that
    fires at the quayside teaches the user to ignore the IMBL warning that matters

Every upstream call is stubbed. These pin the alerting logic, not the ocean.
"""

from __future__ import annotations

import pytest

from app.schemas.conditions import (
    ConditionsSnapshot,
    ConditionTile,
    SafeWindow,
    WatchRequest,
)
from app.schemas.enums import AlertType, Verdict
from app.schemas.response import Evidence, Location
from app.services import watch as watch_service


def tile(field: str, value: float, band: str, label: str = "Reading") -> ConditionTile:
    return ConditionTile(
        field=field,
        label=label,
        icon="gauge",
        value=value,
        unit="m",
        band=band,
        peak_band=band,
        source="test",
    )


# Most tests are about hazards and boundaries, not about the departure window — so the
# default snapshot carries one. Without it every second check would also raise "no safe
# window", which is correct behaviour but noise in a test about something else.
OPEN_WINDOW = SafeWindow(
    start="2026-09-04T04:00", end="2026-09-04T12:00", hours=8, quality="clear"
)


def snapshot(tiles, verdict=Verdict.GO, next_window=OPEN_WINDOW) -> ConditionsSnapshot:
    return ConditionsSnapshot(
        location=Location(lat=16.99, lon=82.24, name="Kakinada"),
        tiles=tiles,
        verdict=verdict,
        reasons=["because the test said so"],
        next_window=next_window,
    )


@pytest.fixture(autouse=True)
async def clean_registry():
    """No watch may outlive its test — each one owns a background task."""
    yield
    await watch_service.cancel_all()


@pytest.fixture
def quiet_sea(monkeypatch):
    """A calm snapshot, no boundary data, no socket."""
    from app.services import conditions as conditions_service

    state = {"snapshot": snapshot([tile("wave_height", 0.5, "go", "Wave height")])}

    async def fake_snapshot(location, now=None):
        return state["snapshot"]

    async def no_geofences(location, buffer_km=10.0):
        return []

    async def swallow(session_id, watch_id, alert):
        return None

    monkeypatch.setattr(conditions_service, "snapshot", fake_snapshot)
    monkeypatch.setattr("app.agents.geospatial.check_geofences", no_geofences)
    monkeypatch.setattr("app.api.ws_trace.emit_watch_alert", swallow)
    # Never let the periodic loop fire during a test — each check is driven explicitly.
    # Must still be a coroutine: `register` hands the result to `asyncio.create_task`.
    async def idle(_state):
        return None

    monkeypatch.setattr(watch_service, "_loop", idle)
    return state


def request(**overrides) -> WatchRequest:
    return WatchRequest(
        session_id="test-session", lat=16.99, lon=82.24, name="Kakinada", **overrides
    )


@pytest.mark.asyncio
async def test_registering_runs_the_first_check_immediately(quiet_sea):
    """Being told nothing for fifteen minutes after arming a watch feels broken."""
    status = await watch_service.register(request())

    assert status.checks == 1
    assert status.watch.active
    assert status.watch.last_checked_at is not None


@pytest.mark.asyncio
async def test_a_calm_sea_raises_nothing(quiet_sea):
    status = await watch_service.register(request())
    assert status.alerts == []


@pytest.mark.asyncio
async def test_a_breached_threshold_raises_once_and_only_once(quiet_sea):
    """A watch that re-announces the same hazard every cycle trains the user to ignore it."""
    quiet_sea["snapshot"] = snapshot(
        [tile("wave_height", 3.2, "no_go", "Wave height")], verdict=Verdict.NO_GO
    )

    status = await watch_service.register(request())
    assert len(status.alerts) == 1
    assert status.alerts[0].severity == "critical"
    assert status.alerts[0].type is AlertType.HIGH_WAVE

    state = watch_service._watches[status.watch.id]
    await watch_service._check(state)
    assert len(state.alerts) == 1, "the same hazard must not be announced twice"


@pytest.mark.asyncio
async def test_worsening_from_caution_to_no_go_is_announced_again(quiet_sea):
    quiet_sea["snapshot"] = snapshot(
        [tile("wave_height", 1.8, "caution", "Wave height")], verdict=Verdict.CAUTION
    )
    status = await watch_service.register(request())
    assert len(status.alerts) == 1

    state = watch_service._watches[status.watch.id]
    quiet_sea["snapshot"] = snapshot(
        [tile("wave_height", 3.2, "no_go", "Wave height")], verdict=Verdict.NO_GO
    )
    await watch_service._check(state)

    # The threshold crossing, plus the verdict itself degrading.
    assert len(state.alerts) > 1
    assert any(alert.severity == "critical" for alert in state.alerts)


@pytest.mark.asyncio
async def test_conditions_improving_is_not_an_alert(quiet_sea):
    """Good news does not buzz a phone."""
    quiet_sea["snapshot"] = snapshot(
        [tile("wave_height", 3.2, "no_go", "Wave height")], verdict=Verdict.NO_GO
    )
    status = await watch_service.register(request())
    raised = len(status.alerts)

    state = watch_service._watches[status.watch.id]
    quiet_sea["snapshot"] = snapshot(
        [tile("wave_height", 0.4, "go", "Wave height")], verdict=Verdict.GO
    )
    await watch_service._check(state)

    assert len(state.alerts) == raised


@pytest.mark.asyncio
async def test_a_field_with_no_threshold_never_raises(quiet_sea):
    """Tide and sea temperature have no limit, so they cannot breach one."""
    quiet_sea["snapshot"] = snapshot(
        [
            tile("sea_level_height_msl", 1.4, "none", "Tide"),
            tile("sea_surface_temperature", 31.0, "none", "Sea temperature"),
        ]
    )
    status = await watch_service.register(request())
    assert status.alerts == []


@pytest.mark.asyncio
async def test_the_eez_never_raises_a_proximity_alert(monkeypatch, quiet_sea):
    """Its landward edge is the coastline: a harbour is always metres from it."""

    async def close_to_everything(location, buffer_km=10.0):
        return [
            Evidence(field="distance_to_eez", value=2.0, unit="km", source="test"),
            Evidence(field="inside_eez", value=True, source="test"),
        ]

    monkeypatch.setattr("app.agents.geospatial.check_geofences", close_to_everything)
    status = await watch_service.register(request())

    assert status.alerts == [], "being near India's own EEZ edge is not a warning"


@pytest.mark.asyncio
async def test_approaching_the_imbl_is_critical(monkeypatch, quiet_sea):
    """The boundary with consequences. This is the alert the whole feature exists for."""

    async def near_imbl(location, buffer_km=10.0):
        return [Evidence(field="distance_to_imbl", value=6.0, unit="km", source="test")]

    monkeypatch.setattr("app.agents.geospatial.check_geofences", near_imbl)
    status = await watch_service.register(request())

    assert len(status.alerts) == 1
    alert = status.alerts[0]
    assert alert.type is AlertType.GEOFENCE_PROXIMITY
    assert alert.severity == "critical"
    # The consequence has to be stated, in words a first-time reader understands.
    assert "seized" in alert.detail and "detained" in alert.detail
    # And never the acronym: "you are 6 km from the IMBL" is only a warning to someone who
    # already knows what an IMBL is, which is exactly backwards for a warning.
    assert "IMBL" not in alert.title and "IMBL" not in alert.detail


@pytest.mark.asyncio
async def test_moving_clear_of_a_boundary_re_arms_the_warning(monkeypatch, quiet_sea):
    distance = {"km": 6.0}

    async def variable(location, buffer_km=10.0):
        return [
            Evidence(field="distance_to_imbl", value=distance["km"], unit="km", source="t")
        ]

    monkeypatch.setattr("app.agents.geospatial.check_geofences", variable)
    status = await watch_service.register(request())
    state = watch_service._watches[status.watch.id]
    assert len(state.alerts) == 1

    distance["km"] = 90.0  # steamed away
    await watch_service._check(state)
    assert len(state.alerts) == 1, "moving clear is not itself an alert"

    distance["km"] = 4.0  # came back
    await watch_service._check(state)
    assert len(state.alerts) == 2, "a second approach must warn again"


@pytest.mark.asyncio
async def test_the_departure_window_closing_is_announced_once(quiet_sea):
    """"When can I go?" losing its answer is news, and it is news exactly once."""
    status = await watch_service.register(request())
    state = watch_service._watches[status.watch.id]
    assert state.alerts == []

    quiet_sea["snapshot"] = snapshot(
        [tile("wave_height", 0.5, "go", "Wave height")], next_window=None
    )
    await watch_service._check(state)
    assert len(state.alerts) == 1
    assert "No safe departure window" in state.alerts[0].title

    await watch_service._check(state)
    assert len(state.alerts) == 1, "a closed window is announced once, not every cycle"

    # And it re-arms when a window reopens and later closes again.
    quiet_sea["snapshot"] = snapshot([tile("wave_height", 0.5, "go", "Wave height")])
    await watch_service._check(state)
    quiet_sea["snapshot"] = snapshot(
        [tile("wave_height", 0.5, "go", "Wave height")], next_window=None
    )
    await watch_service._check(state)
    assert len(state.alerts) == 2


@pytest.mark.asyncio
async def test_registering_the_same_place_twice_replaces_the_watch(quiet_sea):
    """Two timers racing on one location is a duplicate-alert generator."""
    first = await watch_service.register(request())
    second = await watch_service.register(request())

    assert first.watch.id != second.watch.id
    assert len(watch_service.list_watches("test-session")) == 1


@pytest.mark.asyncio
async def test_cancelling_is_idempotent(quiet_sea):
    status = await watch_service.register(request())

    assert await watch_service.cancel(status.watch.id) is True
    assert await watch_service.cancel(status.watch.id) is False
    assert watch_service.get(status.watch.id) is None
