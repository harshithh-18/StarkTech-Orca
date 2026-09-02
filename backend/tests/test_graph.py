"""Graph state and topology tests.

Owner: A · Phase: P1

The reducer behaviour here is subtle and was the source of a real bug: because the
checkpointer preserves state across turns of a conversation, append-reduced fields
accumulated forever and the second turn rendered every trace step twice.
"""

from __future__ import annotations

from app.graph import builder
from app.graph.state import PER_TURN_ACCUMULATORS, RESET, append
from app.schemas.enums import Intent


def test_append_accumulates():
    assert append([1, 2], [3]) == [1, 2, 3]


def test_append_tolerates_none_on_either_side():
    """Parallel nodes that contribute nothing leave the key absent."""
    assert append(None, [1]) == [1]
    assert append([1], None) == [1]
    assert append(None, None) == []


def test_append_does_not_mutate_its_inputs():
    """A reducer that mutates state breaks LangGraph's checkpointing."""
    existing = [1, 2]
    result = append(existing, [3])
    assert existing == [1, 2]
    assert result == [1, 2, 3]


def test_reset_sentinel_clears_the_field():
    """Regression: the multi-turn accumulation bug.

    Without this, turn 2 of a conversation returns turn 1's evidence and trace as well
    as its own — the panel shows every agent twice on exactly the multi-turn beat the
    demo is built around.
    """
    assert append([1, 2, 3], RESET) == []
    assert append(None, RESET) == []


def test_reset_is_falsy_but_still_resets():
    """RESET is an empty list subclass, so a truthiness check would miss it.

    This is the trap: `if not new: return existing` runs BEFORE the isinstance check
    would, and RESET is falsy. If someone reorders those branches, resets silently stop
    working and the accumulation bug comes back.
    """
    assert not RESET, "RESET is falsy — the isinstance check must come first"
    assert append([1, 2], RESET) == [], "a falsy RESET must still clear the field"


def test_every_accumulator_is_listed_for_reset():
    """Any append-reduced field not in PER_TURN_ACCUMULATORS will leak across turns."""
    from typing import get_type_hints

    from app.graph.state import OrcaState

    hints = get_type_hints(OrcaState, include_extras=True)
    reduced = {
        name
        for name, hint in hints.items()
        if append in getattr(hint, "__metadata__", ())
    }

    assert reduced, "expected to find append-reduced fields on OrcaState"
    assert reduced == set(PER_TURN_ACCUMULATORS), (
        f"append-reduced fields and PER_TURN_ACCUMULATORS have drifted.\n"
        f"  reduced but never reset: {sorted(reduced - set(PER_TURN_ACCUMULATORS))}\n"
        f"  reset but not reduced:   {sorted(set(PER_TURN_ACCUMULATORS) - reduced)}"
    )


# ── Routing ───────────────────────────────────────────────────────────────


def test_route_after_planner_fans_out_to_the_plan():
    assert builder.route_after_planner({"plan": ["weather", "sea_state"]}) == [
        "weather",
        "sea_state",
    ]


def test_empty_plan_routes_to_risk_not_nowhere():
    """A plan with no specialists must still reach the end of the graph."""
    assert builder.route_after_planner({"plan": []}) == ["risk"]
    assert builder.route_after_planner({}) == ["risk"]


def test_route_drops_unknown_node_names():
    """A hallucinated agent name must never become an edge to a node that doesn't exist."""
    assert builder.route_after_planner({"plan": ["weather", "teleporter"]}) == ["weather"]


def test_route_never_returns_the_unimplemented_route_node():
    """agents/route.py is a P3 stretch stub that only raises — dispatching it would fail."""
    assert "route" not in builder.SPECIALIST_NODES


# ── Planner ───────────────────────────────────────────────────────────────


def test_planner_maps_intents_to_specialists():
    from app.agents.planner import plan_deterministic

    assert plan_deterministic("is it safe?", Intent.SAFETY_CHECK, True) == [
        "weather",
        "sea_state",
    ]
    assert plan_deterministic("where are fish?", Intent.PFZ_LOOKUP, True) == [
        "marine_data",
        "geospatial",
    ]


def test_planner_unions_compound_queries():
    """"where are the fish and is it safe there?" must dispatch both branches."""
    from app.agents.planner import plan_deterministic

    chosen = plan_deterministic(
        "where are the fish and is it safe there?", Intent.PFZ_LOOKUP, True
    )
    assert set(chosen) >= {"marine_data", "geospatial", "weather", "sea_state"}


def test_planner_dispatches_nothing_without_a_location():
    """Every specialist needs a point; planning them without one only produces failures."""
    from app.agents.planner import plan_deterministic

    assert plan_deterministic("is it safe?", Intent.SAFETY_CHECK, False) == []
