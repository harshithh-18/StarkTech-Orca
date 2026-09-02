"""Shared graph state.

Owner: A · Phase: P1

Threaded through every node in the supervisor graph. Two fields — ``evidence`` and
``reasoning_trace`` — use **append reducers** so that specialists running in parallel
accumulate into them instead of clobbering each other. Everything else is last-write-wins.
"""

from __future__ import annotations

from typing import Annotated, Any, TypedDict

from app.schemas.enums import AlertType, Intent, Language, MapLayer, Verdict
from app.schemas.response import ChartSpec, Evidence, Location, TraceStep


class Reset(list):
    """Sentinel telling ``append`` to clear the field instead of extending it.

    Needed because the checkpointer preserves state across turns of a conversation: on a
    second turn the accumulators would otherwise still hold the first turn's evidence and
    trace, and the panel would render every step twice. Passing ``RESET`` for these
    fields in the initial state starts each turn clean while leaving the remembered
    location intact — which is the whole point of keying the checkpointer by session.
    """


RESET = Reset()

# Fields that must be cleared at the start of every turn. Each uses the append reducer,
# so without an explicit reset they grow for the life of the conversation.
PER_TURN_ACCUMULATORS = ("evidence", "reasoning_trace", "alerts", "skipped_agents", "attribution")


def append(existing: list, new: list) -> list:
    """Reducer for accumulating lists across parallel nodes.

    Tolerates None on either side: a node that returns no evidence returns nothing at
    all, and LangGraph passes the missing key through as None on the first write.
    """
    if isinstance(new, Reset):
        return []
    if not existing:
        return list(new or [])
    if not new:
        return list(existing)
    return list(existing) + list(new)


class OrcaState(TypedDict, total=False):
    """State for one graph run.

    ``total=False`` because early nodes populate incrementally — a specialist that never
    ran leaves its key absent, which is exactly what the synthesis layer needs to know
    in order to report an honest partial answer.
    """

    # ── Input ─────────────────────────────────────────────────────────────
    query: str
    session_id: str
    input_lat: float | None      # device GPS as supplied on the request
    input_lon: float | None
    session_context: dict[str, Any]  # carried from the previous turn's checkpoint

    # ── Language + Intent agent ───────────────────────────────────────────
    language: Language
    intent: Intent
    location: Location | None
    time_window: dict[str, Any]  # {"start": iso, "end": iso} — "tomorrow morning" resolved

    # ── Planner ───────────────────────────────────────────────────────────
    plan: list[str]  # ordered agent names the supervisor chose

    # ── Specialist outputs ────────────────────────────────────────────────
    weather: dict[str, Any]
    sea_state: dict[str, Any]
    marine: dict[str, Any]     # PFZ zones, chlorophyll, SST
    geofence: dict[str, Any]   # containment + distance to nearest boundary
    route: dict[str, Any]      # stretch

    # ── Risk ──────────────────────────────────────────────────────────────
    verdict: Verdict | None
    verdict_reasons: list[str]  # which rules fired, in plain English

    # ── Accumulated across parallel nodes (append-only) ───────────────────
    evidence: Annotated[list[Evidence], append]
    reasoning_trace: Annotated[list[TraceStep], append]

    # Appended, not overwritten: geofence alerts are raised by the geospatial node and
    # weather/wave alerts by the risk node further down the graph. Last-write-wins here
    # would silently drop the geofence alerts — a boundary warning is exactly the one we
    # cannot afford to lose.
    alerts: Annotated[list[AlertType], append]

    # Which specialists could not run. The risk node reads this to cap the verdict at
    # CAUTION, so it must accumulate across every parallel branch that failed.
    skipped_agents: Annotated[list[str], append]

    # ── Presentation ──────────────────────────────────────────────────────
    answer: str
    map_layers: list[MapLayer]
    charts: list[ChartSpec]

    # ── Provenance ────────────────────────────────────────────────────────
    used_mock_data: bool
    attribution: Annotated[list[str], append]
