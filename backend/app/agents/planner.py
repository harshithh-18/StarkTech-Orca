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

import logging

from app.schemas.enums import Intent
from app.services import llm

logger = logging.getLogger(__name__)

# The real node registry. An LLM that invents an agent name must fail against this list
# here, at the boundary, rather than deep in the graph where the error is unreadable.
SPECIALISTS = ("weather", "sea_state", "marine_data", "geospatial", "route")

INTENT_PLAN: dict[Intent, list[str]] = {
    Intent.PFZ_LOOKUP: ["marine_data", "geospatial"],
    Intent.SAFETY_CHECK: ["weather", "sea_state"],
    Intent.GEOFENCE_CHECK: ["geospatial"],
    Intent.DIAGNOSTIC: ["marine_data"],
    Intent.ROUTE_PLANNING: ["sea_state", "weather", "route"],
    Intent.GENERAL: [],
}

# Phrases that pull in a second capability regardless of the primary intent. This is what
# makes "where are the fish and is it safe there?" dispatch both branches.
_COMPOUND_HINTS: list[tuple[tuple[str, ...], list[str]]] = [
    (
        ("is it safe", "safe there", "safety", "weather", "wave", "wind", "storm",
         "సురక్షిత", "பாதுகாப்", "নিরাপদ", "सुरक्षित"),
        ["weather", "sea_state"],
    ),
    (
        ("fishing zone", "pfz", "where are the fish", "fish there", "catch",
         "చేపల", "மீன்", "মাছ", "मछली"),
        ["marine_data", "geospatial"],
    ),
    (
        ("boundary", "border", "restricted", "imbl", "eez", "protected",
         "సరిహద్దు", "எல்லை"),
        ["geospatial"],
    ),
]

# Display names for the trace line, so it reads "Sea-state" rather than "sea_state".
_DISPLAY = {
    "weather": "Weather",
    "sea_state": "Sea-state",
    "marine_data": "Marine-data",
    "geospatial": "Geospatial",
    "route": "Route",
}


def plan_deterministic(query: str, intent: Intent, has_location: bool) -> list[str]:
    """The baseline intent→agents map, plus compound-query unioning. Always available."""
    chosen = list(INTENT_PLAN.get(intent, []))

    lowered = query.casefold()
    for phrases, extra in _COMPOUND_HINTS:
        if any(phrase in lowered for phrase in phrases):
            for name in extra:
                if name not in chosen:
                    chosen.append(name)

    if not has_location:
        # Every specialist we have needs a point to work from. Without one there is
        # nothing to dispatch, and the caller turns that into LOCATION_UNRESOLVED.
        return []

    # Route is a P3 stretch goal and is not built. Planning it would produce a node that
    # can only fail — better to leave it out and say so than to fake the capability.
    if "route" in chosen:
        chosen.remove("route")
        logger.info("planner: route_planning is not implemented yet — dropping it")

    return [name for name in SPECIALISTS if name in chosen]


async def plan(
    query: str,
    intent: Intent,
    has_location: bool,
    session_context: dict | None = None,
) -> list[str]:
    """Return the ordered list of specialist node names to dispatch.

    Tries the LLM for genuine decomposition, then validates every name it returns against
    ``SPECIALISTS``. Falls back to the deterministic map when the LLM is unavailable,
    returns nonsense, or is rate-limited — the demo must survive a rate limit.
    """
    baseline = plan_deterministic(query, intent, has_location)

    if not has_location or not llm.available():
        return baseline

    schema = {
        "type": "object",
        "properties": {
            "agents": {
                "type": "array",
                "items": {"type": "string", "enum": list(SPECIALISTS)},
            },
            "rationale": {"type": "string"},
        },
        "required": ["agents"],
    }
    system = (
        "You are the planner for ORCA, a marine advisory system. Choose which specialist "
        "agents to dispatch for a query. Available agents:\n"
        "- weather: wind, gusts, rain, thunderstorm potential\n"
        "- sea_state: wave height, swell, currents, sea surface temperature\n"
        "- marine_data: potential fishing zones, chlorophyll, productivity trends\n"
        "- geospatial: distance/bearing to zones, EEZ/IMBL/protected-area proximity\n"
        "- route: least-risk sea path (NOT IMPLEMENTED — never choose this)\n"
        "Choose the minimum set that fully answers the query. For a compound question, "
        "include every agent needed for every part of it."
    )

    try:
        result = await llm.complete(
            f"Query: {query}\nClassified intent: {intent.value}",
            system=system,
            json_schema=schema,
        )
    except Exception as exc:  # noqa: BLE001 - the plan must never fail the run
        logger.warning("planner: LLM unavailable (%s) — using the deterministic map", exc)
        return baseline

    proposed = result.get("agents") if isinstance(result, dict) else None
    if not isinstance(proposed, list) or not proposed:
        logger.warning("planner: LLM returned no usable plan — using the deterministic map")
        return baseline

    valid, invalid = [], []
    for name in proposed:
        if name in SPECIALISTS and name != "route":
            if name not in valid:
                valid.append(name)
        else:
            invalid.append(name)

    if invalid:
        # Loud: a hallucinated agent name is a real defect, and it must surface here
        # rather than as a mysterious missing node downstream.
        logger.warning("planner: LLM proposed unknown agents %s — dropped", invalid)

    if not valid:
        return baseline

    return [name for name in SPECIALISTS if name in valid]


def explain_plan(plan: list[str]) -> str:
    """One human-readable trace line, e.g. "Planner → [Weather, Sea-state, Risk]".

    Risk always runs after the specialists, so it is named here even though it is not a
    dispatch choice — the line describes the pipeline the user is about to watch.
    """
    if not plan:
        return "Planner → no specialists dispatched"
    names = [_DISPLAY.get(name, name) for name in plan]
    return f"Planner → [{', '.join(names)}, Risk]"
