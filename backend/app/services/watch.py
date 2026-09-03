"""Proactive safety watches — the platform speaking first.

Owner: B + E · Phase: P4

Everything else in ORCA is pull: the user asks, ORCA answers. A fisherman who is already
at sea is not going to ask. This module is the push half — register a location, and ORCA
re-evaluates it on a timer and raises anything that turned dangerous:

  - conditions crossing a small-craft threshold that were inside it last check
  - the verdict degrading (GO → CAUTION → NO_GO)
  - drifting within warning distance of the sea border with a neighbouring country, or of
    a protected marine area
  - the safe departure window closing

## Design constraints that shaped this

**Only report changes.** A watch that re-announces "waves are 1.6 m" every fifteen minutes
trains the user to ignore it, and an ignored alert is worse than no alert. Each watch keeps
the last snapshot's fingerprint and raises only what is new or newly worse.

**Never raise an all-clear as an alert.** Conditions improving is good news, not an
interruption. It updates the watch state and the dashboard; it does not buzz a phone.

**In-process, not a job queue.** One asyncio task per watch, cancelled when the watch is
dropped, all state in memory. A watch does not outlive the server — and it says so, rather
than implying a durability the deployment does not have. Persisting them is a Redis-and-a-
worker change, and pretending otherwise in a safety feature would be the dishonest option.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from app.schemas.conditions import (
    ConditionsSnapshot,
    Watch,
    WatchAlert,
    WatchRequest,
    WatchStatus,
)
from app.schemas.enums import AlertType, Verdict
from app.schemas.response import Location

logger = logging.getLogger(__name__)

# How close to a maritime boundary before the watch says something. Deliberately generous:
# a boat making 8 knots covers 15 km in an hour, so a warning at 15 km is roughly an hour
# of notice — enough to turn around, which is the entire point.
BOUNDARY_WARNING_KM = 15.0
BOUNDARY_CRITICAL_KM = 5.0

# Verdict severity, so "did it get worse?" is a comparison rather than a table of cases.
_SEVERITY = {
    Verdict.NOT_APPLICABLE: -1,
    Verdict.GO: 0,
    Verdict.CAUTION: 1,
    Verdict.NO_GO: 2,
}

MAX_ALERTS_KEPT = 25
"""Per watch. The panel shows a history, not a log file."""


class _WatchState:
    """One live watch: its record, its task, and what it has already told the user."""

    def __init__(self, watch: Watch):
        self.watch = watch
        self.task: asyncio.Task | None = None
        self.alerts: list[WatchAlert] = []
        self.verdict: Verdict = Verdict.NOT_APPLICABLE
        self.snapshot: ConditionsSnapshot | None = None
        self.checks = 0
        # Fingerprints of what has already been raised, so a persisting hazard is
        # announced once rather than every cycle.
        self.announced: set[str] = set()

    def status(self) -> WatchStatus:
        return WatchStatus(
            watch=self.watch,
            verdict=self.verdict,
            alerts=list(reversed(self.alerts)),
            checks=self.checks,
        )


_watches: dict[str, _WatchState] = {}


def list_watches(session_id: str | None = None) -> list[WatchStatus]:
    """Every active watch, or just one session's."""
    return [
        state.status()
        for state in _watches.values()
        if session_id is None or state.watch.session_id == session_id
    ]


def get(watch_id: str) -> WatchStatus | None:
    state = _watches.get(watch_id)
    return state.status() if state else None


def snapshot_of(watch_id: str) -> ConditionsSnapshot | None:
    """The last conditions snapshot this watch took, if it has taken one."""
    state = _watches.get(watch_id)
    return state.snapshot if state else None


async def register(request: WatchRequest) -> WatchStatus:
    """Start a watch and run its first check immediately.

    The first check is synchronous on purpose: registering a watch and being told nothing
    for fifteen minutes feels broken, and the interesting case — "you registered a watch
    and you are *already* in trouble" — is exactly the one that must not wait for a timer.
    """
    # One watch per session per location. Re-registering the same spot should refresh the
    # watch, not accumulate a second timer racing the first.
    for existing in list(_watches.values()):
        same_session = existing.watch.session_id == request.session_id
        close = (
            abs(existing.watch.location.lat - request.lat) < 0.01
            and abs(existing.watch.location.lon - request.lon) < 0.01
        )
        if same_session and close:
            await cancel(existing.watch.id)

    watch = Watch(
        id=uuid.uuid4().hex[:12],
        session_id=request.session_id,
        location=Location(
            lat=request.lat, lon=request.lon, name=request.name, source="watch"
        ),
        language=request.language,
        interval_seconds=request.interval_seconds,
    )
    state = _WatchState(watch)
    _watches[watch.id] = state

    await _check(state, first_run=True)
    state.task = asyncio.create_task(_loop(state), name=f"orca-watch-{watch.id}")

    logger.info(
        "watch %s: started for %.3f,%.3f every %d s",
        watch.id, request.lat, request.lon, request.interval_seconds,
    )
    return state.status()


async def cancel(watch_id: str) -> bool:
    """Stop a watch and forget it. Idempotent."""
    state = _watches.pop(watch_id, None)
    if state is None:
        return False
    if state.task is not None:
        state.task.cancel()
        try:
            await state.task
        except asyncio.CancelledError:
            # Expected: this is what cancelling a task looks like from the inside.
            pass
        except Exception as exc:  # noqa: BLE001 - a dying watch must still be forgotten
            logger.debug("watch %s: loop raised while cancelling (%s)", watch_id, exc)
    logger.info("watch %s: cancelled", watch_id)
    return True


async def cancel_all() -> None:
    """Stop every watch. Called from the app lifespan shutdown."""
    for watch_id in list(_watches):
        await cancel(watch_id)


async def _loop(state: _WatchState) -> None:
    """Re-check on the watch's interval until cancelled."""
    while True:
        try:
            await asyncio.sleep(state.watch.interval_seconds)
            await _check(state)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - a bad cycle must not kill the watch
            logger.warning("watch %s: check failed (%s) — will retry", state.watch.id, exc)


async def _check(state: _WatchState, first_run: bool = False) -> None:
    """One evaluation cycle: snapshot, compare, raise what is new, push it."""
    from app.services import conditions as conditions_service

    watch = state.watch
    state.checks += 1
    watch.last_checked_at = datetime.now(timezone.utc)

    snapshot = await conditions_service.snapshot(watch.location)
    previous_verdict = state.verdict
    state.snapshot = snapshot
    state.verdict = snapshot.verdict

    raised: list[WatchAlert] = []

    # ── Hazards crossing a threshold ──────────────────────────────────────
    for tile in snapshot.tiles:
        # 'none' means the field has no safety threshold at all (tide, sea temperature).
        # There is nothing for it to breach, so it can never be an alert.
        if tile.band in ("go", "none"):
            continue
        # Fingerprint includes the band, so caution → no_go re-announces while
        # caution → caution stays quiet.
        fingerprint = f"{tile.field}:{tile.band}"
        if fingerprint in state.announced:
            continue
        state.announced.add(fingerprint)
        # Clear the milder band so conditions easing and worsening again re-announces.
        state.announced.discard(f"{tile.field}:{'caution' if tile.band == 'no_go' else 'no_go'}")

        raised.append(
            WatchAlert(
                type=_alert_for_field(tile.field),
                severity="critical" if tile.band == "no_go" else "warning",
                title=f"{tile.label} {tile.value}{tile.unit or ''}"
                + (f", peaking at {tile.peak_value}{tile.unit or ''}" if tile.peak_value else ""),
                detail=(
                    f"{tile.label} is past the "
                    f"{'no-go' if tile.band == 'no_go' else 'caution'} limit for small "
                    f"craft at {watch.location.name or 'your watched location'}."
                ),
                location=watch.location,
                evidence=[e for e in snapshot.evidence if e.field == tile.field],
            )
        )

    # ── The verdict itself getting worse ──────────────────────────────────
    if not first_run and _SEVERITY[snapshot.verdict] > _SEVERITY[previous_verdict]:
        raised.append(
            WatchAlert(
                type=AlertType.HIGH_WAVE if snapshot.alerts == [] else snapshot.alerts[0],
                severity="critical" if snapshot.verdict is Verdict.NO_GO else "warning",
                title=(
                    "Conditions have worsened — do not go to sea"
                    if snapshot.verdict is Verdict.NO_GO
                    else "Conditions have worsened — take care"
                ),
                detail=" ".join(snapshot.reasons[:2]) or "The safety verdict changed.",
                location=watch.location,
            )
        )
        # A worsening verdict is always worth repeating if it happens again later.
        state.announced.discard("verdict")

    # ── Boundary proximity ────────────────────────────────────────────────
    raised.extend(await _boundary_alerts(state))

    # ── The safe window closing ───────────────────────────────────────────
    if not first_run and snapshot.next_window is None and "window_closed" not in state.announced:
        state.announced.add("window_closed")
        raised.append(
            WatchAlert(
                type=AlertType.HIGH_WAVE,
                severity="warning",
                title="No safe departure window in the forecast",
                detail=(
                    "There is no run of 4 or more hours inside small-craft limits in the "
                    "next 72 hours at this location."
                ),
                location=watch.location,
            )
        )
    elif snapshot.next_window is not None:
        state.announced.discard("window_closed")

    if not raised:
        logger.debug("watch %s: check %d — nothing new", watch.id, state.checks)
        return

    state.alerts.extend(raised)
    del state.alerts[:-MAX_ALERTS_KEPT]

    await _push(watch, raised)


async def _boundary_alerts(state: _WatchState) -> list[WatchAlert]:
    """Proximity to the IMBL, the EEZ edge and Marine Protected Areas.

    The IMBL case is the one with legal consequences — crossing it is what gets boats
    detained — so it is the only boundary that escalates to `critical`.
    """
    from app.agents import geospatial

    watch = state.watch
    try:
        evidence = await geospatial.check_geofences(watch.location)
    except Exception as exc:  # noqa: BLE001 - no boundary data is not a failed watch
        logger.info("watch %s: geofence check unavailable (%s)", watch.id, exc)
        return []

    by_field = {e.field: e for e in evidence}
    raised: list[WatchAlert] = []

    # The EEZ is deliberately absent. Being outside India's EEZ is lawful — and the EEZ
    # polygon's landward edge *is* the coastline, so a boat in its home harbour is metres
    # from an "EEZ boundary". Warning on it fires at the quayside and in international
    # waters alike, which is how you teach someone to ignore the IMBL warning that
    # matters. Same reasoning as ``geospatial.derive_geofence_alerts``.
    for key in ("imbl", "mpa"):
        label = geospatial.BOUNDARY_LABELS[key]
        distance = by_field.get(f"distance_to_{key}")
        inside = by_field.get(f"inside_{key}")

        # Inside a protected area is a breach, not a proximity warning.
        if key == "mpa" and inside is not None and bool(inside.value):
            if "mpa_breach" in state.announced:
                continue
            state.announced.add("mpa_breach")
            raised.append(
                WatchAlert(
                    type=AlertType.GEOFENCE_BREACH,
                    severity="critical",
                    title="You are inside a protected marine area",
                    detail=(
                        "This is a conservation area for marine life. Fishing here may "
                        "be restricted or banned. Leave the area."
                    ),
                    location=watch.location,
                    evidence=[inside],
                )
            )
            continue

        if distance is None or not isinstance(distance.value, (int, float)):
            continue
        km = float(distance.value)
        if km > BOUNDARY_WARNING_KM:
            # Moved clear — allow the warning to fire again on the next approach.
            state.announced.discard(f"near_{key}")
            continue

        level = "critical" if km <= BOUNDARY_CRITICAL_KM else "warning"
        fingerprint = f"near_{key}"
        if fingerprint in state.announced:
            continue
        state.announced.add(fingerprint)

        raised.append(
            WatchAlert(
                type=AlertType.GEOFENCE_PROXIMITY,
                severity="critical" if key == "imbl" else level,
                title=f"{km:.0f} km from {label}",
                detail=(
                    "This is where India's waters meet another country's. Crossing it "
                    "without permission can get your boat seized and your crew detained. "
                    "Turn back towards Indian waters."
                    if key == "imbl"
                    else "You are approaching a conservation area where fishing may be "
                    "restricted or banned."
                ),
                location=watch.location,
                evidence=[distance],
            )
        )

    return raised


def _alert_for_field(field: str) -> AlertType:
    """Which banner an exceeded field raises. Mirrors ``agents.risk._RULE_ALERTS``."""
    from app.agents.risk import _RULE_ALERTS

    return _RULE_ALERTS.get(field, AlertType.HIGH_WAVE)


async def _push(watch: Watch, alerts: list[WatchAlert]) -> None:
    """Send alerts down the session's trace socket.

    Reuses the trace socket rather than opening a second one: the client already holds it
    open for the reasoning panel, and a watch that needs its own connection is a watch that
    silently stops working the moment a proxy closes the idle one.
    """
    from app.api.ws_trace import emit_watch_alert

    for alert in alerts:
        logger.info(
            "watch %s: raising %s — %s", watch.id, alert.type.value, alert.title
        )
        try:
            await emit_watch_alert(watch.session_id, watch.id, alert)
        except Exception as exc:  # noqa: BLE001 - a closed socket is not a failed watch
            logger.debug("watch %s: could not push over the socket (%s)", watch.id, exc)
