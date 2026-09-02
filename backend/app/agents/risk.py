"""Risk Assessment Agent — the verdict.

Owner: A + E · Phase: P2 · Type: Rules + LLM (phrasing only)

Correlates every specialist's evidence into **GO / CAUTION / NO_GO**.

> ## The verdict is deterministic.
> ``services.risk_rules`` compares values against thresholds and returns the verdict plus
> which rule fired. The LLM's ONLY job is to phrase those reasons in the user's language.
>
> Never let a language model decide whether it is safe to go to sea. A hallucinated GO is
> the worst possible failure this project can have — a fisherman could die. This is not a
> stylistic preference; it is the reason the risk logic lives in a tested pure function.

The verdict always states the rule that fired:

    "No-Go: forecast wave height 3.4 m exceeds the 2.5 m small-craft threshold at your
     location tomorrow 06:00 (source: Open-Meteo Marine, ICON-Wave)."
"""

from __future__ import annotations

import logging

from app.i18n import bhashini
from app.schemas.enums import AlertType, Verdict
from app.schemas.response import Evidence
from app.services import llm, risk_rules

logger = logging.getLogger(__name__)

NAME = "risk"

# Which alert an exceeded threshold raises. Derived from the fired rules rather than
# re-inspecting the evidence, so an alert can never contradict the verdict that fired it.
_RULE_ALERTS: dict[str, AlertType] = {
    "wave_height": AlertType.HIGH_WAVE,
    "swell_wave_height": AlertType.HIGH_WAVE,
    "wind_speed_10m": AlertType.HIGH_WIND,
    "wind_gusts_10m": AlertType.HIGH_WIND,
    "cape": AlertType.LIGHTNING,
    "thunderstorm_forecast": AlertType.LIGHTNING,
    "cyclone_bulletin_active": AlertType.CYCLONE,
}


def assess(evidence: list[Evidence], skipped_agents: list[str] | None = None) -> dict:
    """Correlate evidence into a verdict.

    Returns {'verdict', 'reasons', 'fired_rules', 'alerts'}.

    ``skipped_agents`` matters: if sea-state couldn't run, we do **not** issue a GO on
    wind alone. Missing safety-critical data caps the verdict at CAUTION and the reason
    says what was missing. All of that lives in ``risk_rules.evaluate`` — this function
    only adds the alert mapping.
    """
    result = risk_rules.evaluate(evidence, skipped_agents)
    result["alerts"] = derive_alerts_from_rules(result["fired_rules"])
    logger.info(
        "risk: %s (%d rules fired: %s)",
        result["verdict"].value,
        len(result["fired_rules"]),
        ", ".join(result["fired_rules"]) or "none",
    )
    return result


def derive_alerts_from_rules(fired_rules: list[str]) -> list[AlertType]:
    """Map fired rule ids ('wave_height.no_go') onto alert banner types."""
    alerts: list[AlertType] = []
    for rule in fired_rules:
        field = rule.rsplit(".", 1)[0]
        alert = _RULE_ALERTS.get(field)
        if alert is not None and alert not in alerts:
            alerts.append(alert)
    return alerts


def derive_alerts(evidence: list[Evidence]) -> list[AlertType]:
    """Alerts implied by a bare evidence list, without a full assessment."""
    return derive_alerts_from_rules(risk_rules.evaluate(evidence)["fired_rules"])


def phrase_reasons_deterministic(verdict: Verdict, reasons: list[str]) -> str:
    """English verdict sentence built from the fired rules. No model involved.

    The always-available floor: if the LLM is absent or rate-limited, the user still gets
    a correct, specific answer — in English rather than their language, which is a
    degradation we can state honestly rather than a failure.
    """
    headline = {
        Verdict.GO: "Safe to go",
        Verdict.CAUTION: "Caution",
        Verdict.NO_GO: "Do not go to sea",
        Verdict.NOT_APPLICABLE: "",
    }[verdict]

    if not reasons:
        return headline

    top = reasons[:3]
    if len(top) == 1:
        return f"{headline}: {top[0]}."
    body = "; ".join(top[:-1]) + f"; and {top[-1]}"
    return f"{headline}: {body}."


async def phrase_reasons(
    verdict: Verdict, reasons: list[str], language: str
) -> str:
    """Turn the fired rules into a sentence in the user's language.

    Phrasing only. The verdict is already fixed before this runs and is passed in as a
    fact to be communicated, never as a question to be reconsidered — the prompt says so
    explicitly, and the deterministic fallback below cannot re-decide anything at all.
    """
    fallback = phrase_reasons_deterministic(verdict, reasons)

    if language == "en" or not reasons:
        return fallback

    # Bhashini first when it is configured: translating the deterministic sentence is
    # strictly safer than letting a model compose one, because the verdict wording cannot
    # drift at all — and it puts the Government of India's own Indic stack on the safety
    # path, which is the point of using it.
    if bhashini.available() and bhashini.supports("en", language):
        try:
            translated = await bhashini.translate(fallback, "en", language)
            from app.services.explainability import _record_translator

            _record_translator("bhashini")
            return translated
        except Exception as exc:  # noqa: BLE001
            logger.warning("risk: Bhashini translation failed (%s) — trying the LLM", exc)

    if not llm.available():
        return fallback

    verdict_words = {
        Verdict.GO: "SAFE TO GO",
        Verdict.CAUTION: "CAUTION — conditions are marginal",
        Verdict.NO_GO: "DO NOT GO TO SEA",
        Verdict.NOT_APPLICABLE: "",
    }

    system = (
        f"You are ORCA, a marine safety advisor for Indian coastal fishermen. "
        f"Write ONLY in the language with ISO 639-1 code '{language}'.\n\n"
        f"The verdict has ALREADY been decided by a deterministic safety rule engine. "
        f"Your only job is to communicate it clearly and urgently in the user's "
        f"language. You must NOT change, soften, question or re-evaluate the verdict, "
        f"and you must NOT introduce any number that is not in the reasons given.\n\n"
        f"Keep it to two or three short sentences. Lead with the verdict itself — the "
        f"reader may be on a phone at 4 a.m. before leaving harbour. If the verdict is "
        f"DO NOT GO TO SEA, it must read as an urgent warning, not as gentle advice."
    )

    prompt = (
        f"Verdict (fixed, communicate exactly this): {verdict_words[verdict]}\n\n"
        f"Reasons the rule engine gave:\n"
        + "\n".join(f"- {reason}" for reason in reasons[:4])
    )

    try:
        answer = await llm.complete(prompt, system=system, temperature=0.3)
        if isinstance(answer, str) and answer.strip():
            return answer.strip()
    except Exception as exc:  # noqa: BLE001 - phrasing must never fail the run
        logger.warning("risk: could not phrase reasons in %s (%s)", language, exc)

    return fallback
