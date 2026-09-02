"""LangGraph supervisor topology.

Owner: A · Phase: P1

The shape (docs/ARCHITECTURE.md):

    language_intent → planner → ┬→ weather   ─┐
                                ├→ sea_state ─┤
                                ├→ marine    ─┼→ risk → visualization → explainability → END
                                ├→ geospatial─┘
                                └→ (none) ────┘

The planner decides which specialists run for a given intent; the ones it didn't pick are
skipped, not failed. Specialists run in parallel because none of them depends on another.
"""

from __future__ import annotations

import logging
from typing import Any

from langgraph.graph import END, StateGraph

from app.graph import nodes
from app.graph.state import OrcaState

logger = logging.getLogger(__name__)

# Node names the planner may dispatch, mapped to their wrappers.
SPECIALIST_NODES = {
    "weather": nodes.weather_node,
    "sea_state": nodes.sea_state_node,
    "marine_data": nodes.marine_data_node,
    "geospatial": nodes.geospatial_node,
}

# A planner loop or a runaway fan-out must not hang the demo. The longest legitimate path
# is intent → planner → 4 specialists → risk → visualization → explainability, so 25
# leaves generous headroom while still terminating.
RECURSION_LIMIT = 25


def route_after_planner(state: OrcaState) -> list[str]:
    """Conditional edge: fan out to exactly the specialists the planner chose.

    Rough mapping (the planner may deviate — that's the point of having one):
        pfz_lookup      → [marine_data, geospatial]
        safety_check    → [weather, sea_state]
        geofence_check  → [geospatial]
        diagnostic      → [marine_data]
        route_planning  → [sea_state, weather, route]

    An empty plan routes straight to ``risk``, which then reports honestly that it had
    nothing to assess — rather than leaving the graph with no path to the end.
    """
    plan = [name for name in (state.get("plan") or []) if name in SPECIALIST_NODES]
    if not plan:
        logger.info("graph: no specialists to dispatch — routing straight to risk")
        return ["risk"]
    return plan


def build_graph(checkpointer: Any | None = None) -> Any:
    """Compile the supervisor graph.

    ``checkpointer`` is a LangGraph saver keyed by ``session_id`` as thread_id — that is
    what makes the multi-turn demo beat ("…and is it safe there?") work.
    """
    graph = StateGraph(OrcaState)

    graph.add_node("language_intent", nodes.language_intent_node)
    graph.add_node("planner", nodes.planner_node)
    for name, fn in SPECIALIST_NODES.items():
        graph.add_node(name, fn)
    graph.add_node("risk", nodes.risk_node)
    graph.add_node("visualization", nodes.visualization_node)
    graph.add_node("explainability", nodes.explainability_node)

    graph.set_entry_point("language_intent")
    graph.add_edge("language_intent", "planner")

    # Conditional fan-out. The path list must name every node the router can return, so
    # LangGraph knows which branches to wait on before running the join.
    graph.add_conditional_edges(
        "planner",
        route_after_planner,
        list(SPECIALIST_NODES) + ["risk"],
    )

    # Join: every specialist feeds the risk node, which runs once they have all finished.
    for name in SPECIALIST_NODES:
        graph.add_edge(name, "risk")

    graph.add_edge("risk", "visualization")
    graph.add_edge("visualization", "explainability")
    graph.add_edge("explainability", END)

    compiled = graph.compile(checkpointer=checkpointer)
    logger.info(
        "graph: compiled with %d specialist node(s)%s",
        len(SPECIALIST_NODES),
        " and a checkpointer" if checkpointer else " (no checkpointer — no multi-turn memory)",
    )
    return compiled


_graph: Any | None = None
_connection: Any = None


async def init_graph() -> Any:
    """Build the graph and open the checkpointer. Called once from the app lifespan.

    Owns the aiosqlite connection directly rather than going through
    ``from_conn_string`` (an async context manager), because the connection has to stay
    open for the process lifetime — multi-turn memory is useless if it closes between
    requests.
    """
    global _graph, _connection
    if _graph is not None:
        return _graph

    checkpointer = None
    try:
        import aiosqlite
        from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

        from app.config import get_settings

        settings = get_settings()
        settings.cache_dir.mkdir(parents=True, exist_ok=True)
        path = settings.cache_dir / "orca_memory.sqlite"

        _connection = await aiosqlite.connect(str(path))
        checkpointer = AsyncSqliteSaver(_connection)
        await checkpointer.setup()
        logger.info("graph: multi-turn memory at %s", path)
    except Exception as exc:  # noqa: BLE001 - memory is a feature, not a prerequisite
        logger.warning(
            "graph: could not open the SQLite checkpointer (%s) — running without "
            "multi-turn memory",
            exc,
        )
        checkpointer = None

    _graph = build_graph(checkpointer)
    return _graph


async def close_graph() -> None:
    """Close the checkpointer connection at shutdown."""
    global _graph, _connection
    if _connection is not None:
        try:
            await _connection.close()
        except Exception as exc:  # noqa: BLE001
            logger.debug("graph: error closing the checkpointer (%s)", exc)
    _connection = None
    _graph = None


def get_graph() -> Any:
    """The compiled graph. Raises if the app lifespan never ran."""
    if _graph is None:
        raise RuntimeError(
            "the ORCA graph has not been initialised — init_graph() runs in the FastAPI "
            "lifespan, so call it first if you are driving the graph outside the app"
        )
    return _graph
