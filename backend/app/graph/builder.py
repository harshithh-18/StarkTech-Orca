"""LangGraph supervisor topology.

Owner: A · Phase: P1

The shape (docs/ARCHITECTURE.md):

    language_intent → planner → ┬→ weather   ─┐
                                ├→ sea_state ─┤
                                ├→ marine    ─┼→ risk → visualization → explainability → END
                                └→ geospatial─┘

The planner decides which specialists run for a given intent; the ones it didn't pick are
skipped, not failed. Specialists run in parallel because none of them depends on another.
"""

from __future__ import annotations

from typing import Any

from app.graph.state import OrcaState


def route_after_planner(state: OrcaState) -> list[str]:
    """Conditional edge: fan out to exactly the specialists the planner chose.

    Rough mapping (the planner may deviate — that's the point of having one):
        pfz_lookup      → [marine_data, geospatial]
        safety_check    → [weather, sea_state]
        geofence_check  → [geospatial]
        diagnostic      → [marine_data]
        route_planning  → [sea_state, weather, route]

    TODO(P1, A): read state['plan'] and return the node names to fan out to.
    """
    raise NotImplementedError("TODO(P1, A)")


def build_graph(checkpointer: Any | None = None) -> Any:
    """Compile the supervisor graph.

    ``checkpointer`` is a LangGraph SqliteSaver keyed by ``session_id`` as thread_id —
    that is what makes the multi-turn demo beat ("…and is it safe there?") work, so it is
    not optional past P2.

    TODO(P1, A): StateGraph(OrcaState); add nodes from graph.nodes
    TODO(P1, A): entry = language_intent → planner; conditional fan-out; join at risk
    TODO(P2, A): attach SqliteSaver for multi-turn memory
    TODO(P2, A): recursion/step limit so a planner loop can't hang the demo
    """
    raise NotImplementedError("TODO(P1, A): build and compile the StateGraph")
