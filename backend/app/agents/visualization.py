"""Visualization / Reporting Agent.

Owner: B · Phase: P1 · Type: Tool (no LLM)

Decides what the screen shows: which map layers to switch on, which charts to render,
which alert cards to raise. Purely a mapping from state → presentation payload.

Design constraint from the UX spec: **one glanceable verdict beats a wall of numbers.**
The real user is a fisherman on a phone, possibly at 4 a.m. Switching on six layers at
once is worse than switching on two.
"""

from __future__ import annotations

from app.schemas.enums import Intent, MapLayer
from app.schemas.response import ChartSpec


def select_layers(intent: Intent, state: dict) -> list[MapLayer]:
    """Which map layers this answer should switch on.

    Baseline per intent:
        pfz_lookup      → [user_pin, pfz_zones, chlorophyll_heatmap]
        safety_check    → [user_pin, wave_heatmap]
        geofence_check  → [user_pin, eez_boundary, imbl_line, mpa_zones]
        diagnostic      → [user_pin, chlorophyll_heatmap, sst_heatmap]
        route_planning  → [user_pin, route_line, wave_heatmap]

    TODO(P1, B): implement the mapping; keep it to 2–3 layers, never all of them
    """
    raise NotImplementedError("TODO(P1, B)")


def build_charts(state: dict) -> list[ChartSpec]:
    """Assemble the chart specs relevant to this answer.

    TODO(P2, B): 48-hour wave + wind for safety_check
    TODO(P2, E): chlorophyll trend for diagnostic
    """
    raise NotImplementedError("TODO(P2, B)")
