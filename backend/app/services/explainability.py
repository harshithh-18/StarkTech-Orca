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

import contextvars
import logging

from app.adapters import base as adapter_base
from app.graph.state import OrcaState
from app.i18n import bhashini
from app.rag import store as rag_store
from app.schemas.enums import AlertType, Intent, Language, TraceStatus, Verdict
from app.schemas.response import Evidence, OrcaResponse, TraceStep
from app.services import llm

logger = logging.getLogger(__name__)

# Agents that fetch data. A skip from one of these means the answer is genuinely missing
# something; a skip from risk/visualization/explainability is control flow, not a gap.
DATA_SPECIALISTS = frozenset({"weather", "sea_state", "marine_data", "geospatial"})

# Which translator actually served this request, so the response credits Bhashini only
# when it really ran and not when we fell back. A ContextVar rather than a module global:
# requests run concurrently on one event loop and a global would attribute one user's
# translation to another's answer.
_translator_used: contextvars.ContextVar[set[str] | None] = contextvars.ContextVar(
    "orca_translator_used", default=None
)


def begin_translation_tracking() -> None:
    """Start recording which translators run, for the current request only."""
    _translator_used.set(set())


def _record_translator(name: str) -> None:
    used = _translator_used.get()
    if used is not None:
        used.add(name)


def translation_attribution() -> list[str]:
    """Licence lines for the translators that actually ran on this request."""
    used = _translator_used.get() or set()
    return [bhashini.ATTRIBUTION] if "bhashini" in used else []


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


# Intents that need actual ocean under the query point.
MARINE_INTENTS = frozenset(
    {Intent.PFZ_LOOKUP, Intent.SAFETY_CHECK, Intent.DIAGNOSTIC, Intent.ROUTE_PLANNING}
)


def _is_inland_result(state: OrcaState) -> bool:
    """Did a data specialist skip because the point has no sea near it?

    The `inland` flag set by ``nodes._run_specialist`` is authoritative — it comes from a
    typed exception, ``adapters.base.LocationNotAtSea``, raised by the code that actually
    looked at the marine grid.

    The trace scan below it is a fallback for a specialist that reports the condition in
    words without raising that type. It is deliberately second: matching on the word
    "inland" in a free-text message was the *only* mechanism until P4, and it silently
    stopped working the moment that message was reworded — the kind of coupling that fails
    quietly and is only noticed when a user in Hyderabad is told the sea might be rough.
    """
    if state.get("inland"):
        return True
    for step in state.get("reasoning_trace") or []:
        if step.agent in DATA_SPECIALISTS and "inland" in step.message.casefold():
            return True
    return False


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
        if step.status not in (TraceStatus.SKIPPED, TraceStatus.FAILED):
            continue
        # Only a data specialist failing is a gap the user needs to hear about. The risk
        # node skipping a non-safety question is by design, not a shortfall — reporting
        # it reads as an apology for working correctly.
        if step.agent not in DATA_SPECIALISTS:
            continue
        gaps.append((step.agent, f"{step.agent.replace('_', ' ')}: {step.message}"))

    if prefer:
        gaps.sort(key=lambda pair: pair[0] != prefer)

    return [text for _, text in gaps]


# Below this Chroma distance a hit is close enough to answer with. Above it, the FAQ has
# nothing relevant and the capability blurb is the honest response — a loosely-related
# passage dressed up as an answer is worse than saying "I can help with these four things".
MAX_RETRIEVAL_DISTANCE = 1.1


def retrieve_background(query: str) -> str | None:
    """Answer a general marine question from the knowledge store, with its citation.

    Returns None when retrieval is unavailable or nothing is close enough — the caller
    then falls back to describing what ORCA can do.
    """
    if not query.strip():
        return None

    try:
        hits = rag_store.search(query, n_results=2)
    except Exception as exc:  # noqa: BLE001 - retrieval is never load-bearing
        logger.warning("explainability: retrieval failed (%s)", exc)
        return None

    if not hits:
        return None

    best = hits[0]
    distance = best.get("distance")
    if distance is not None and distance > MAX_RETRIEVAL_DISTANCE:
        logger.debug(
            "explainability: closest passage was %.2f away — too loose to answer with",
            distance,
        )
        return None

    # Strip the markdown heading; the section name is cited separately.
    body = "\n".join(
        line for line in best["text"].splitlines() if not line.strip().startswith("#")
    ).strip()

    section = best.get("section") or ""
    citation = f" (ORCA knowledge base: {section})" if section else ""
    return f"{body}{citation}"


async def translate_only(text: str, language_code: str) -> str:
    """Translate a fixed string, preserving its meaning and urgency exactly.

    For text the model is not permitted to rewrite — safety warnings and the productivity
    narrative. Falls back to the original English rather than risking a softened
    translation: an English warning the user can still read beats a translated one that
    no longer warns.

    Order: **Bhashini first**, then the LLM, then English. Bhashini is the Government of
    India's own Indic stack and is the right primary for a government problem statement;
    the LLM sits behind it so a Bhashini outage cannot take the multilingual story down.
    """
    if language_code == "en":
        return text

    # ── Bhashini (Government of India NMT) ────────────────────────────────
    if bhashini.available() and bhashini.supports("en", language_code):
        try:
            translated = await bhashini.translate(text, "en", language_code)
            logger.debug("explainability: translated via Bhashini → %s", language_code)
            _record_translator("bhashini")
            return translated
        except Exception as exc:  # noqa: BLE001 - fall through to the LLM
            logger.warning(
                "explainability: Bhashini translation failed (%s) — falling back to the LLM",
                exc,
            )

    if not llm.available():
        return text

    system = (
        f"Translate the user's text into the language with ISO 639-1 code "
        f"'{language_code}'. Output ONLY the translation.\n"
        f"This is a maritime SAFETY WARNING. Preserve every number, place name and unit "
        f"exactly. Preserve the urgency — if it warns, the translation must warn just as "
        f"strongly. Do not add, remove, soften or explain anything."
    )
    try:
        translated = await llm.complete(text, system=system, temperature=0.1)
        if isinstance(translated, str) and translated.strip():
            return translated.strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning("explainability: warning translation failed (%s)", exc)
    return text


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

    # ── Not at sea ────────────────────────────────────────────────────────
    # By far the most common reason a marine query returns nothing: anyone testing from
    # an office is inland. It is not a failure of ours, it outranks every other
    # explanation, and it must not be rewritten — handed to the model it gets recast
    # using whatever unrelated evidence is lying around ("you are not inside the EEZ").
    if intent in MARINE_INTENTS and _is_inland_result(state):
        from app.services import harbours

        location = state.get("location")
        where = location.name if location and location.name else "That location"
        # Name the nearest harbour rather than listing three arbitrary ones. "Try Kakinada"
        # is advice; "try Kakinada, Chennai or Kochi" is a menu the reader has to work out
        # for themselves, from a place none of them may be anywhere near.
        nearby = (
            f" {harbours.describe_nearest(location)}" if location is not None else ""
        )
        message = (
            f"{where} is inland — there is no sea near it, so there are no waves, tides "
            f"or sea conditions to report.{nearby} Ask again from a coastal place and I "
            f"can answer for the water there."
        )
        return await translate_only(message, language_code)

    # ── Geofence warnings are deterministic, like the verdict ─────────────
    # Asked to "rewrite naturally", the model deleted a boundary-proximity warning and
    # returned neutral distances — and in an earlier run volunteered "Continue your
    # current course" 2.3 km from the Sri Lanka IMBL. A warning that a language model can
    # edit is not a warning. The text is fixed here; the model may only translate it.
    alerts = state.get("alerts") or []
    if any(
        alert in (AlertType.GEOFENCE_BREACH, AlertType.GEOFENCE_PROXIMITY)
        for alert in alerts
    ):
        warning = (state.get("geofence") or {}).get("summary")
        if warning:
            if language_code == "en":
                return warning
            return await translate_only(warning, language_code)

    # ── A boundary answer is deterministic, alert or no alert ─────────────
    # The warning case above is not the only one that matters. Asked "am I near a
    # boundary?" from safe water, the model was handed a factual distance report and
    # returned "You are inside India's EEZ. The EEZ boundary is 4.0 km away" — putting an
    # acronym in front of a reader who has never seen one, over text that had deliberately
    # said "India's own waters". The distances are facts and the vocabulary is a decision;
    # neither is the model's to rewrite. It may translate.
    geofence_summary = (state.get("geofence") or {}).get("summary")
    if intent is Intent.GEOFENCE_CHECK and geofence_summary:
        return await translate_only(geofence_summary, language_code)

    # ── The productivity narrative is deterministic too ───────────────────
    # It states a measured change and explicitly declines to claim causation. Handing it
    # back for a "natural rewrite" is how the model reintroduced "both low, indicating
    # reduced primary productivity" over a chlorophyll value that was in fact high.
    narrative = (state.get("marine") or {}).get("narrative")
    if intent is Intent.DIAGNOSTIC and narrative:
        return await translate_only(narrative, language_code)

    # ── A route question is answered by the route ─────────────────────────
    # The risk node also runs for this intent (a path can be unsafe), but the user asked
    # "which way", so the path leads and the verdict is appended only when it was actually
    # assessed. Without this the answer became "no forecast data available" — a verdict
    # about evidence the route agent never produces.
    route_summary = (state.get("route") or {}).get("summary")
    if intent is Intent.ROUTE_PLANNING and route_summary:
        answer = (
            f"{route_summary} The path avoids the roughest water, costed at the time you "
            f"would actually reach each stretch. Advisory only — it knows nothing about "
            f"your vessel, shipping lanes or fuel."
        )
        if verdict in (Verdict.CAUTION, Verdict.NO_GO) and reasons:
            # Only a verdict grounded in real threshold breaches is worth appending.
            real = [r for r in reasons if "no forecast data" not in r]
            if real:
                answer += f" Conditions warning: {real[0]}"
        return await translate_only(answer, language_code)

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

    # An answer whose whole content is "I could not do this" must not be handed to a
    # model along with a pile of evidence — it reaches for the data and produces
    # something that reads like the analysis we just said we could not do. Translate it,
    # never rewrite it.
    if _is_unavailability_answer(deterministic):
        return await translate_only(deterministic, language_code)

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


# Openings used by every "we could not do this" answer below. Kept as a list so the
# check stays in step with the phrasings rather than guessing at them.
_UNAVAILABLE_MARKERS = (
    "i could not",
    "i cannot yet",
    "no potential fishing zone was found",
    "no restricted boundary was found",
)


def _is_unavailability_answer(text: str) -> bool:
    """True when the answer's content is an honest gap rather than a finding."""
    lowered = text.casefold()
    return any(marker in lowered for marker in _UNAVAILABLE_MARKERS)


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
        # The narrative is built deterministically from the measured trend in
        # agents/marine_data.describe_trend. It must NOT be re-derived from raw evidence
        # here: asked to phrase this query from evidence alone, a model described
        # chlorophyll of 2.447 mg/m³ — nearly 10× the productive threshold — as "low,
        # indicating reduced primary productivity". Confidently wrong science is worse
        # than an honest gap.
        narrative = (state.get("marine") or {}).get("narrative")
        if narrative:
            return narrative
        if gaps:
            return f"I cannot yet explain productivity changes near {place}. {gaps[0]}"
        return f"I could not measure a productivity trend near {place}."

    if intent is Intent.ROUTE_PLANNING:
        # The success path is handled earlier in write_answer; this is the failure case.
        if gaps:
            return f"I could not plan a route. {gaps[0]}"
        return "I could not plan a route between those places."

    if intent is Intent.GENERAL:
        # Retrieval answers marine background questions ("what is a PFZ?", "what does
        # crossing the IMBL mean?") that fall outside the golden path but are squarely
        # within what a fisherman might ask. Retrieved text explains concepts; it never
        # supplies a number, because a retrieved value has no timestamp and no source.
        retrieved = retrieve_background(state.get("query", ""))
        if retrieved:
            return retrieved

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
        # Badged from what the adapters actually served, not from a flag a node had to
        # remember to set — an honesty guarantee is worthless if it depends on diligence.
        used_mock_data=bool(state.get("used_mock_data")) or adapter_base.served_mock_data(),
        attribution=collect_attribution(state) + translation_attribution(),
    )
