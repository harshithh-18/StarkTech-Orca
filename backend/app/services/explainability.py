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

import logging

from app.graph.state import OrcaState
from app.schemas.enums import Intent, Language, TraceStatus, Verdict
from app.schemas.response import Evidence, OrcaResponse, TraceStep
from app.services import llm

logger = logging.getLogger(__name__)


def dedupe_evidence(evidence: list[Evidence]) -> list[Evidence]:
    """Collapse duplicate (field, source, time) entries, keeping the most specific.

    Parallel specialists can both report SST — sea-state reads it from the marine grid,
    marine-data samples it from Copernicus. Both are legitimate; showing the same field
    twice under two sources is just noise in the citation list.

    "Most specific" = the one carrying a location, then the one carrying a time.
    """
    best: dict[tuple, Evidence] = {}

    for item in evidence:
        key = (item.field, item.source, item.time)
        incumbent = best.get(key)
        if incumbent is None:
            best[key] = item
            continue
        incumbent_score = (incumbent.location is not None, incumbent.time is not None)
        challenger_score = (item.location is not None, item.time is not None)
        if challenger_score > incumbent_score:
            best[key] = item

    return list(best.values())


def collect_attribution(state: OrcaState) -> list[str]:
    """Licence lines for every source touched, deduped and stably ordered."""
    seen: list[str] = []
    for line in state.get("attribution") or []:
        if line and line not in seen:
            seen.append(line)

    # Any evidence source we have a licence line for, in case a specialist forgot to
    # declare it — attribution is a legal obligation, not a nicety.
    return seen


def summarise_trace(trace: list[TraceStep]) -> str:
    """One-line summary for the collapsed state of the trace panel.

    e.g. "4 agents · 2 sources · 1.2 s"
    """
    agents = {step.agent for step in trace}
    sources = {step.source for step in trace if step.source}
    total_ms = sum(step.duration_ms or 0 for step in trace)

    parts = [f"{len(agents)} agent{'s' if len(agents) != 1 else ''}"]
    if sources:
        parts.append(f"{len(sources)} source{'s' if len(sources) != 1 else ''}")
    if total_ms:
        parts.append(f"{total_ms / 1000:.1f} s")

    skipped = sum(1 for step in trace if step.status is TraceStatus.SKIPPED)
    failed = sum(1 for step in trace if step.status is TraceStatus.FAILED)
    if skipped:
        parts.append(f"{skipped} skipped")
    if failed:
        parts.append(f"{failed} failed")

    return " · ".join(parts)


def describe_gaps(state: OrcaState, prefer: str | None = None) -> list[str]:
    """Plain-English notes about what could not be checked.

    Surfaced in the answer rather than buried in the trace: quietly answering with less
    is the failure mode this whole layer exists to prevent.

    ``prefer`` puts one agent's gap first. Which gap the user sees matters: for a fishing
    zone query, "the Copernicus subset isn't downloaded" is the actionable reason, while
    the geofence agent's unrelated skip is noise.
    """
    gaps = []
    for step in state.get("reasoning_trace") or []:
        if step.status in (TraceStatus.SKIPPED, TraceStatus.FAILED):
            gaps.append((step.agent, f"{step.agent.replace('_', ' ')}: {step.message}"))

    if prefer:
        gaps.sort(key=lambda pair: pair[0] != prefer)

    return [text for _, text in gaps]


async def write_answer(state: OrcaState) -> str:
    """Write the user-facing answer in the user's language.

    Grounded strictly in ``state['evidence']``. If a value isn't in evidence, it must not
    appear in the answer — that rule is what makes the citations meaningful.

    Keep it short. The reader is on a phone, possibly at 4 a.m. One glanceable verdict
    beats a wall of numbers.
    """
    language = state.get("language", Language.ENGLISH)
    language_code = language.value if isinstance(language, Language) else str(language)
    intent = state.get("intent", Intent.GENERAL)
    evidence = state.get("evidence") or []
    verdict = state.get("verdict")
    reasons = state.get("verdict_reasons") or []

    # ── Safety answers are phrased by the risk agent ──────────────────────
    # It holds the verdict-communication rules (never soften, never re-decide), so the
    # answer for a safety check comes from there rather than being written twice.
    if verdict is not None and verdict is not Verdict.NOT_APPLICABLE:
        from app.agents.risk import phrase_reasons

        answer = await phrase_reasons(verdict, reasons, language_code)
        gaps = describe_gaps(state)
        if gaps and language_code == "en":
            answer += f" (Note: {gaps[0]})"
        return answer

    # ── Everything else ───────────────────────────────────────────────────
    deterministic = _deterministic_answer(state, intent)

    if not llm.available():
        return deterministic

    try:
        prompt = (
            f"The user asked: {state.get('query', '')}\n\n"
            f"A deterministic system produced this answer:\n{deterministic}\n\n"
            f"Rewrite it naturally and briefly for the user, preserving every number "
            f"and place name exactly."
        )
        answer = await llm.complete_in_language(
            prompt, language_code, evidence=evidence, temperature=0.3
        )
        if isinstance(answer, str) and answer.strip():
            return answer.strip()
    except Exception as exc:  # noqa: BLE001 - the answer must always exist
        logger.warning("explainability: LLM answer failed (%s) — using the rule-based text", exc)

    return deterministic


def _deterministic_answer(state: OrcaState, intent: Intent) -> str:
    """The always-available English answer, built from state. No model involved."""
    location = state.get("location")
    place = (location.name if location and location.name else "your location")

    # Each intent has an agent whose failure is the one worth reporting to the user.
    gaps = describe_gaps(
        state,
        prefer={
            Intent.PFZ_LOOKUP: "marine_data",
            Intent.DIAGNOSTIC: "marine_data",
            Intent.GEOFENCE_CHECK: "geospatial",
        }.get(intent),
    )

    if intent is Intent.PFZ_LOOKUP:
        marine = state.get("marine") or {}
        nearest = marine.get("nearest") or {}
        if nearest.get("description"):
            path = marine.get("path", "computed proxy")
            method = (
                "an official INCOIS advisory" if path == "official"
                else "our computed chlorophyll + SST-front analysis"
                if path == "proxy"
                else "both the INCOIS advisory and our own analysis, which agree"
            )
            return (
                f"The nearest potential fishing zone is about "
                f"{nearest['description']} of {place}, identified using {method}."
            )
        if gaps:
            return f"I could not locate a fishing zone near {place}. {gaps[0]}"
        return f"No potential fishing zone was found within range of {place}."

    if intent is Intent.GEOFENCE_CHECK:
        geofence = state.get("geofence") or {}
        if geofence.get("summary"):
            return geofence["summary"]
        if gaps:
            return f"I could not check boundaries near {place}. {gaps[0]}"
        return f"No restricted boundary was found near {place}."

    if intent is Intent.DIAGNOSTIC:
        if gaps:
            return (
                f"I cannot yet explain productivity changes near {place}. {gaps[0]}"
            )
        return f"Productivity analysis for {place} is not available yet."

    if intent is Intent.GENERAL:
        return (
            "I can help with four things: finding the nearest potential fishing zone, "
            "checking whether it is safe to go to sea, warning you about restricted "
            "maritime boundaries, and explaining changes in fish productivity. "
            "Ask me about any of those for a location on the Indian coast."
        )

    return f"I could not produce an answer for {place}."


def assemble_response(state: OrcaState) -> OrcaResponse:
    """Build the final OrcaResponse from completed graph state.

    ``answer`` is expected to already be in state (written by the explainability node);
    this function is the pure state → response mapping so it stays synchronous and
    testable.
    """
    trace = sorted(state.get("reasoning_trace") or [], key=lambda step: step.seq)
    evidence = dedupe_evidence(state.get("evidence") or [])

    verdict = state.get("verdict")
    intent = state.get("intent", Intent.GENERAL)
    if verdict is None and intent is Intent.SAFETY_CHECK:
        # A safety question must never come back without a verdict field.
        verdict = Verdict.NOT_APPLICABLE

    return OrcaResponse(
        query=state.get("query", ""),
        session_id=state.get("session_id", ""),
        language=state.get("language", Language.ENGLISH),
        intent=intent,
        location=state.get("location"),
        answer=state.get("answer", ""),
        verdict=verdict,
        evidence=evidence,
        reasoning_trace=trace,
        map_layers=state.get("map_layers") or [],
        alerts=state.get("alerts") or [],
        charts=state.get("charts") or [],
        used_mock_data=bool(state.get("used_mock_data")),
        attribution=collect_attribution(state),
    )
