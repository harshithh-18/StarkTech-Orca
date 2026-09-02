"""Deterministic safety thresholds — the code that decides GO / NO_GO.

Owner: E · Phase: P2

> ## This module must never call an LLM.
> A hallucinated GO could get someone killed. The verdict is a pure function of the
> evidence: testable, reviewable, and identical every time it runs. ``agents.risk`` uses a
> language model only to *phrase* the reasons this module returns.
>
> **This is the most test-worthy file in the repo.** Test every threshold boundary.

## Thresholds — PROVISIONAL, must be sourced before the demo

The values below are placeholders aligned with small-craft advisory practice, but they are
**not yet sourced to a published INCOIS Ocean State Forecast or IMD advisory**. Before P3,
replace them with cited limits and record the citation next to each value. A judge may ask
"why 2.5 metres?" and "it seemed reasonable" is not the answer you want to give.

Real advisories also vary by **craft type** — a mechanised trawler and a catamaran do not
share a wave limit. Until that is modelled, every verdict assumes a small mechanised boat,
and the demo should say so out loud.

## CAPE replaces thunderstorm_probability

The scaffold keyed the lightning rule to ``thunderstorm_probability``, which Open-Meteo
returns as all-nulls — the rule could never have fired. See
``adapters/open_meteo_weather.py``. CAPE bands below follow standard convective practice:
<1000 J/kg marginal, 1000–2500 moderate instability, >2500 strong.
"""

from __future__ import annotations

from app.schemas.enums import Verdict
from app.schemas.response import Evidence

# TODO(P3, E): replace with sourced values from INCOIS OSF / IMD small-craft advisories
# and cite each one inline.
THRESHOLDS = {
    "wave_height": {"caution": 1.5, "no_go": 2.5, "unit": "m"},
    "swell_wave_height": {"caution": 2.0, "no_go": 3.0, "unit": "m"},
    "wind_speed_10m": {"caution": 25.0, "no_go": 40.0, "unit": "km/h"},
    "wind_gusts_10m": {"caution": 35.0, "no_go": 55.0, "unit": "km/h"},
    "cape": {"caution": 1000.0, "no_go": 2500.0, "unit": "J/kg"},
    "visibility": {"caution": 2000.0, "no_go": 500.0, "unit": "m"},  # lower is worse
}

# Fields where a LOWER reading is more dangerous. Declared rather than inferred: this is
# the single easiest place in the codebase to introduce an inverted comparison, and an
# inverted visibility rule would report fog as excellent conditions.
LOWER_IS_WORSE = {"visibility"}

# Categorical evidence — no threshold to compare against, presence alone is the signal.
BOOLEAN_RISK_FIELDS = {
    "thunderstorm_forecast": "thunderstorm forecast in the window",
    "cyclone_bulletin_active": "active cyclone bulletin for this area",
}

SAFETY_CRITICAL_AGENTS = ("sea_state", "weather")
"""If one of these was skipped, the verdict is capped at CAUTION — never GO."""

# Ordering so "the worst verdict wins" is a max(), not a chain of ifs.
_SEVERITY = {
    Verdict.GO: 0,
    Verdict.CAUTION: 1,
    Verdict.NO_GO: 2,
    Verdict.NOT_APPLICABLE: -1,
}


def breaches(field: str, value: float) -> str | None:
    """Which band this value falls in: 'no_go', 'caution', or None.

    Thresholds are **inclusive** — a value exactly at the limit counts as breaching it.
    That is a deliberate choice for a safety system: at exactly 2.5 m we say NO_GO rather
    than waving the boat out on a technicality. ``test_exactly_at_threshold`` pins it.
    """
    limits = THRESHOLDS.get(field)
    if limits is None:
        return None

    if field in LOWER_IS_WORSE:
        if value <= limits["no_go"]:
            return "no_go"
        if value <= limits["caution"]:
            return "caution"
        return None

    if value >= limits["no_go"]:
        return "no_go"
    if value >= limits["caution"]:
        return "caution"
    return None


def format_reason(field: str, value: float, threshold: float, unit: str, source: str) -> str:
    """One human-readable reason line, in English; translated later by agents.risk.

    Names the value, the limit and the source, so the user can check the claim rather
    than take it on trust: that is what makes the citation meaningful.
    """
    label = field.replace("_10m", "").replace("_", " ")
    comparator = "below" if field in LOWER_IS_WORSE else "exceeds"
    return (
        f"{label} {value:g} {unit} {comparator} the {threshold:g} {unit} "
        f"small-craft threshold (source: {source})"
    )


def evaluate(
    evidence: list[Evidence], skipped_agents: list[str] | None = None
) -> dict:
    """Return {'verdict': Verdict, 'reasons': [str], 'fired_rules': [str]}.

    Rules:
      - any field past its ``no_go`` threshold → NO_GO
      - any field past its ``caution`` threshold → CAUTION
      - a safety-critical agent missing → at most CAUTION, and the reason says
        *which* data was missing
      - nothing breached and full data → GO

    Pure: no I/O, no LLM, no clock. Same evidence in, same verdict out, every time.
    """
    skipped = list(skipped_agents or [])
    verdict = Verdict.GO
    reasons: list[str] = []
    fired_rules: list[str] = []

    # Keep only the worst reading per field. Parallel specialists can each report wind,
    # and a verdict must not depend on which one happened to land in the list first.
    worst_by_field: dict[str, Evidence] = {}
    for item in evidence:
        if item.field in THRESHOLDS and isinstance(item.value, (int, float)) and not isinstance(item.value, bool):
            current = worst_by_field.get(item.field)
            if current is None:
                worst_by_field[item.field] = item
            else:
                lower_is_worse = item.field in LOWER_IS_WORSE
                incumbent = float(current.value)  # type: ignore[arg-type]
                challenger = float(item.value)
                if (challenger < incumbent) if lower_is_worse else (challenger > incumbent):
                    worst_by_field[item.field] = item

    for field, item in worst_by_field.items():
        value = float(item.value)  # type: ignore[arg-type]
        band = breaches(field, value)
        if band is None:
            continue
        limits = THRESHOLDS[field]
        reasons.append(
            format_reason(field, value, limits[band], limits["unit"], item.source)
        )
        fired_rules.append(f"{field}.{band}")
        verdict = _worse(verdict, Verdict.NO_GO if band == "no_go" else Verdict.CAUTION)

    # Categorical risks: presence is the breach.
    for item in evidence:
        if item.field in BOOLEAN_RISK_FIELDS and bool(item.value) is True:
            reasons.append(
                f"{BOOLEAN_RISK_FIELDS[item.field]} (source: {item.source})"
            )
            fired_rules.append(f"{item.field}.present")
            verdict = _worse(verdict, Verdict.CAUTION)

    # Missing safety-critical data caps the verdict. Absence of evidence is not evidence
    # of safety — we never issue a GO on half the picture.
    missing = [agent for agent in SAFETY_CRITICAL_AGENTS if agent in skipped]
    if missing:
        readable = " and ".join(a.replace("_", " ") for a in missing)
        reasons.append(
            f"{readable} data was unavailable, so conditions could not be fully "
            f"checked — treat this as provisional"
        )
        fired_rules.append("missing_safety_critical_data")
        verdict = _worse(verdict, Verdict.CAUTION)

    # No evidence at all is not a GO either.
    if not worst_by_field and not missing:
        reasons.append(
            "no forecast data was available for this location and time, so no safety "
            "assessment could be made"
        )
        fired_rules.append("no_evidence")
        verdict = _worse(verdict, Verdict.CAUTION)

    if verdict is Verdict.GO:
        reasons.append("all checked conditions are within small-craft limits")

    return {"verdict": verdict, "reasons": reasons, "fired_rules": fired_rules}


def _worse(a: Verdict, b: Verdict) -> Verdict:
    """The more severe of two verdicts."""
    return a if _SEVERITY[a] >= _SEVERITY[b] else b
