"""Deterministic safety thresholds — the code that decides GO / NO_GO.

Owner: E · Phase: P2

> ## This module must never call an LLM.
> A hallucinated GO could get someone killed. The verdict is a pure function of the
> evidence: testable, reviewable, and identical every time it runs. ``agents.risk`` uses a
> language model only to *phrase* the reasons this module returns.
>
> **This is the most test-worthy file in the repo.** Test every threshold boundary.

## Thresholds — PROVISIONAL, must be sourced before the demo

The values below are placeholders. Before P3, replace them with real small-craft advisory
limits from INCOIS Ocean State Forecast or IMD, and cite the source in a comment. A judge
may ask "why 2.5 metres?" and "it seemed reasonable" is not the answer you want to give.

Real advisories also vary by **craft type** — a mechanised trawler and a catamaran do not
share a wave limit. If time allows, take craft type as an input; if not, state plainly in
the demo that thresholds assume a small mechanised boat.
"""

from __future__ import annotations

from app.schemas.enums import Verdict
from app.schemas.response import Evidence

# TODO(P2, E): replace with sourced values from INCOIS OSF / IMD small-craft advisories
THRESHOLDS = {
    "wave_height_m": {"caution": 1.5, "no_go": 2.5},
    "wind_speed_kmh": {"caution": 25.0, "no_go": 40.0},
    "wind_gust_kmh": {"caution": 35.0, "no_go": 55.0},
    "thunderstorm_probability_pct": {"caution": 30.0, "no_go": 60.0},
    "visibility_m": {"caution": 2000.0, "no_go": 500.0},  # lower is worse
}

SAFETY_CRITICAL_AGENTS = ("sea_state", "weather")
"""If one of these was skipped, the verdict is capped at CAUTION — never GO."""


def evaluate(
    evidence: list[Evidence], skipped_agents: list[str] | None = None
) -> dict:
    """Return {'verdict': Verdict, 'reasons': [str], 'fired_rules': [str]}.

    Rules:
      - any field past its ``no_go`` threshold → NO_GO
      - any field past its ``caution`` threshold → CAUTION
      - a safety-critical agent missing → at most CAUTION, and the reason must say
        *which* data was missing
      - nothing breached and full data → GO

    Each reason names the value, the threshold and the source, so the answer can say:
    "wave height 3.4 m exceeds the 2.5 m small-craft threshold (Open-Meteo Marine)".

    TODO(P2, E): implement; pure function, no I/O, no LLM
    TODO(P2, E): visibility compares in the opposite direction to everything else —
                 easy bug, worth a dedicated test
    TODO(P2, C): unit-test every threshold boundary, exactly-at-threshold included
    """
    raise NotImplementedError("TODO(P2, E)")


def format_reason(field: str, value: float, threshold: float, unit: str, source: str) -> str:
    """One human-readable reason line, in English; translated later by agents.risk.

    TODO(P2, E)
    """
    raise NotImplementedError("TODO(P2, E)")
