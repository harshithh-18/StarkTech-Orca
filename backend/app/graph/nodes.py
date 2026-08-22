"""Graph node wrappers.

Owner: A · Phase: P1

Thin adapters between LangGraph's ``state -> state-delta`` calling convention and the
agents, which take plain arguments and return plain results. Keeping this seam means the
agents stay independently testable without a graph.

Every wrapper does the same four things:
  1. emit a ``started`` TraceStep
  2. call its agent
  3. emit an ``ok`` step and return the state delta (including new evidence)
  4. on failure: emit a ``skipped`` step with the reason and return an empty delta —
     **a specialist never fails the run** (docs/API_CONTRACT.md, degradation rule)
"""

from __future__ import annotations

from app.graph.state import OrcaState


async def language_intent_node(state: OrcaState) -> dict:
    """Detect language, classify intent, resolve location + time window.

    TODO(P1, A)
    """
    raise NotImplementedError("TODO(P1, A)")


async def planner_node(state: OrcaState) -> dict:
    """Decompose the request and choose the specialists.

    TODO(P1, A)
    """
    raise NotImplementedError("TODO(P1, A)")


async def weather_node(state: OrcaState) -> dict:
    """TODO(P2, B)"""
    raise NotImplementedError("TODO(P2, B)")


async def sea_state_node(state: OrcaState) -> dict:
    """TODO(P2, B)"""
    raise NotImplementedError("TODO(P2, B)")


async def marine_data_node(state: OrcaState) -> dict:
    """TODO(P1, E)"""
    raise NotImplementedError("TODO(P1, E)")


async def geospatial_node(state: OrcaState) -> dict:
    """TODO(P1, E)"""
    raise NotImplementedError("TODO(P1, E)")


async def risk_node(state: OrcaState) -> dict:
    """Correlate every specialist's evidence into a verdict.

    Joins the parallel branches. Runs even when some specialists were skipped — it must
    say so rather than pretending it had full information.

    TODO(P2, A + E)
    """
    raise NotImplementedError("TODO(P2, A+E)")


async def route_node(state: OrcaState) -> dict:
    """TODO(P3, E) — stretch"""
    raise NotImplementedError("TODO(P3, E)")


async def visualization_node(state: OrcaState) -> dict:
    """Pick map layers, build chart specs, assemble alert cards.

    TODO(P1, B)
    """
    raise NotImplementedError("TODO(P1, B)")


async def explainability_node(state: OrcaState) -> dict:
    """Final node: write the answer in the user's language and attach evidence + trace.

    The LLM phrases; it does not decide. The verdict is already fixed by ``risk_node``.

    TODO(P1, C)
    """
    raise NotImplementedError("TODO(P1, C)")
