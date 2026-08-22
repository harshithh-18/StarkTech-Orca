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


def append(existing: list, new: list) -> list:
    """Reducer for accumulating lists across parallel nodes.

    TODO(P1, A): return existing + new, tolerating None on either side.
    """
    raise NotImplementedError("TODO(P1, A)")


class OrcaState(TypedDict, total=False):
    """State for one graph run.

    ``total=False`` because early nodes populate incrementally — a specialist that never
    ran leaves its key absent, which is exactly what the synthesis layer needs to know
    in order to report an honest partial answer.
    """

    # ── Input ─────────────────────────────────────────────────────────────
    query: str
    session_id: str

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
    alerts: list[AlertType]

    # ── Accumulated across parallel nodes (append-only) ───────────────────
    evidence: Annotated[list[Evidence], append]
    reasoning_trace: Annotated[list[TraceStep], append]

    # ── Presentation ──────────────────────────────────────────────────────
    answer: str
    map_layers: list[MapLayer]
    charts: list[ChartSpec]

    # ── Provenance ────────────────────────────────────────────────────────
    used_mock_data: bool
    attribution: Annotated[list[str], append]
