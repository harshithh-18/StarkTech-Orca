"""Planner / Supervisor Agent — the thing that makes ORCA *agentic*.

Owner: A · Phase: P1 · Type: LLM

Decomposes the request into sub-tasks and picks which specialists to dispatch. Judges
cannot see planning happen, so this agent's trace step is the most important single line
in the panel: "Planner → [Weather, Sea-state, Risk]".

Baseline mapping (the planner may deviate — that's the point of having one rather than a
switch statement):

    pfz_lookup      → [marine_data, geospatial]
    safety_check    → [weather, sea_state]
    geofence_check  → [geospatial]
    diagnostic      → [marine_data]
    route_planning  → [sea_state, weather, route]

A compound question — "where are the fish and is it safe there?" — should yield the union,
which is exactly the behaviour worth demonstrating.
"""

from __future__ import annotations

from app.schemas.enums import Intent


async def plan(
    query: str,
    intent: Intent,
    has_location: bool,
    session_context: dict | None = None,
) -> list[str]:
    """Return the ordered list of specialist node names to dispatch.

    TODO(P1, A): Gemini call with the specialist roster in the prompt; structured list out
    TODO(P1, A): validate every returned name against the real node registry — an
                 hallucinated agent name must fail loudly here, not deep in the graph
    TODO(P2, A): handle compound queries by unioning the required specialists
    TODO(P3, A): fall back to the deterministic intent→agents map if the LLM is
                 unavailable. The demo must survive a rate limit.
    """
    raise NotImplementedError("TODO(P1, A)")


def explain_plan(plan: list[str]) -> str:
    """One human-readable trace line, e.g. "Planner → [Weather, Sea-state, Risk]".

    TODO(P1, A)
    """
    raise NotImplementedError("TODO(P1, A)")
