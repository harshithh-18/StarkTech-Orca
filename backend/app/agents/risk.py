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

from app.schemas.enums import AlertType, Verdict
from app.schemas.response import Evidence


def assess(evidence: list[Evidence], skipped_agents: list[str] | None = None) -> dict:
    """Correlate evidence into a verdict.

    Returns {'verdict', 'reasons': [...], 'alerts': [...]}.

    ``skipped_agents`` matters: if sea-state couldn't run, we do **not** issue a GO on
    wind alone. Missing safety-critical data caps the verdict at CAUTION and the reason
    must say what was missing.

    TODO(P2, E): delegate the decision to services.risk_rules.evaluate()
    TODO(P2, E): degrade to CAUTION (never GO) when a safety-critical specialist is missing
    TODO(P2, E): derive alerts (HIGH_WAVE, HIGH_WIND, CYCLONE, LIGHTNING) from the rules
    """
    raise NotImplementedError("TODO(P2, E)")


async def phrase_reasons(
    verdict: Verdict, reasons: list[str], language: str
) -> str:
    """Turn the fired rules into a sentence in the user's language.

    Phrasing only. Passing a verdict this function could change would defeat the design.

    TODO(P2, A): Gemini call — translate and phrase, strictly no re-deciding
    TODO(P2, F): verify the safety vocabulary is right in Telugu and Tamil. Get a native
                 speaker to check "do not go to sea" reads as urgent, not as advisory.
    """
    raise NotImplementedError("TODO(P2, A)")


def derive_alerts(evidence: list[Evidence]) -> list[AlertType]:
    """TODO(P2, E)"""
    raise NotImplementedError("TODO(P2, E)")
