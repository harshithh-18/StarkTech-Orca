"""The explainability layer — ORCA's scoring lever.

Owner: C · Phase: P1

The problem statement asks for explainable, evidence-based answers three times. This module
is where that becomes structural rather than aspirational: it assembles the final
``OrcaResponse`` from graph state, attaching every piece of evidence and every trace step.

Two invariants, and they are not negotiable:

  1. **Every number the user sees is in ``evidence[]``** with a source and a timestamp.
  2. **Every agent that ran is in ``reasoning_trace[]``** — including the ones that were
     skipped, and why.

A visible skip is not an embarrassment. It's a demonstration that the system knows what it
doesn't know, which is exactly what "evidence-based" means.
"""

from __future__ import annotations

from app.graph.state import OrcaState
from app.schemas.response import Evidence, OrcaResponse, TraceStep


def assemble_response(state: OrcaState) -> OrcaResponse:
    """Build the final OrcaResponse from completed graph state.

    TODO(P1, C): map state → OrcaResponse fields
    TODO(P1, C): dedupe evidence — parallel specialists can both report SST
    TODO(P1, C): sort reasoning_trace by seq; parallel nodes finish out of order
    TODO(P1, C): collect attribution from every adapter that was touched, deduped
    TODO(P3, C): set used_mock_data if ANY adapter fell back to mock — the UI badges it
    """
    raise NotImplementedError("TODO(P1, C)")


async def write_answer(state: OrcaState) -> str:
    """Write the user-facing answer in the user's language.

    Grounded strictly in ``state['evidence']``. If a value isn't in evidence, it must not
    appear in the answer — that rule is what makes the citations meaningful.

    Keep it short. The reader is on a phone, possibly at 4 a.m. One glanceable verdict
    beats a wall of numbers.

    TODO(P1, C): Gemini call via services.llm, evidence passed as grounding
    TODO(P2, F): route through Bhashini NMT for translation-quality guarantees on
                 ta / te / ml / bn
    TODO(P2, C): explicitly state what's missing when a specialist was skipped, rather
                 than quietly answering with less
    """
    raise NotImplementedError("TODO(P1, C)")


def dedupe_evidence(evidence: list[Evidence]) -> list[Evidence]:
    """Collapse duplicate (field, source, time) entries, keeping the most specific.

    TODO(P1, C)
    """
    raise NotImplementedError("TODO(P1, C)")


def summarise_trace(trace: list[TraceStep]) -> str:
    """One-line summary for the collapsed state of the trace panel.

    e.g. "4 agents · 2 sources · 1.2 s"

    TODO(P2, C)
    """
    raise NotImplementedError("TODO(P2, C)")
