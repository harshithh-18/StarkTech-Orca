"""Visualization / Reporting Agent.

Owner: B · Phase: P1 · Type: Tool (no LLM)

Decides what the screen shows: which map layers to switch on, which charts to render,
which alert cards to raise. Purely a mapping from state → presentation payload.

Design constraint from the UX spec: **one glanceable verdict beats a wall of numbers.**
The real user is a fisherman on a phone, possibly at 4 a.m. Switching on six layers at
once is worse than switching on two.
"""

from __future__ import annotations

import logging

from app.schemas.enums import Intent, MapLayer
from app.schemas.response import ChartSpec

logger = logging.getLogger(__name__)

NAME = "visualization"

# Baseline per intent. Kept to two or three layers — the map has to stay readable on a
# phone, and a layer the answer doesn't reference is noise.
INTENT_LAYERS: dict[Intent, list[MapLayer]] = {
    Intent.PFZ_LOOKUP: [MapLayer.USER_PIN, MapLayer.PFZ_ZONES],
    Intent.SAFETY_CHECK: [MapLayer.USER_PIN, MapLayer.WAVE_HEATMAP],
    Intent.GEOFENCE_CHECK: [MapLayer.USER_PIN, MapLayer.EEZ_BOUNDARY, MapLayer.IMBL_LINE],
    Intent.DIAGNOSTIC: [MapLayer.USER_PIN, MapLayer.CHLOROPHYLL_HEATMAP],
    Intent.ROUTE_PLANNING: [MapLayer.USER_PIN, MapLayer.ROUTE_LINE, MapLayer.WAVE_HEATMAP],
    Intent.GENERAL: [MapLayer.USER_PIN],
}


def select_layers(intent: Intent, state: dict) -> list[MapLayer]:
    """Which map layers this answer should switch on.

    Only layers whose data actually materialised are returned: switching on ``pfz_zones``
    when the marine agent was skipped gives the user an empty legend entry and a map that
    looks broken.
    """
    layers = list(INTENT_LAYERS.get(intent, [MapLayer.USER_PIN]))

    marine = state.get("marine") or {}
    if MapLayer.PFZ_ZONES in layers and not (marine.get("geojson", {}).get("features")):
        layers.remove(MapLayer.PFZ_ZONES)
        logger.debug("visualization: no PFZ features — dropping the pfz_zones layer")

    geofence = state.get("geofence") or {}
    if not geofence.get("checked"):
        for layer in (MapLayer.EEZ_BOUNDARY, MapLayer.IMBL_LINE, MapLayer.MPA_ZONES):
            if layer in layers:
                layers.remove(layer)

    # MPA is added only when the point is actually near or inside one — three boundary
    # layers at once is exactly the wall-of-detail the UX spec warns against.
    if geofence.get("near_mpa") and MapLayer.MPA_ZONES not in layers:
        layers.append(MapLayer.MPA_ZONES)

    if state.get("alerts"):
        layers.append(MapLayer.HAZARD_OVERLAY)

    return layers


# Which chart belongs under which answer. The planner is allowed to over-dispatch — it
# may call sea_state for a productivity question — but a 48-hour wave chart under "why
# has productivity declined?" is a non-sequitur on screen, so relevance is enforced here
# rather than depending on the plan being minimal.
INTENT_CHARTS: dict[Intent, set[str]] = {
    Intent.SAFETY_CHECK: {"wave_48h", "wind_48h", "tide"},
    Intent.DIAGNOSTIC: {"chlorophyll_trend", "sst_trend"},
    Intent.PFZ_LOOKUP: {"chlorophyll_trend"},
    Intent.ROUTE_PLANNING: {"wave_48h", "wind_48h"},
    Intent.GEOFENCE_CHECK: set(),
    Intent.GENERAL: set(),
}


def build_charts(state: dict) -> list[ChartSpec]:
    """Assemble the chart specs relevant to this answer.

    Charts are built by the specialists that own the data (sea_state builds the wave
    series); this collects whatever they produced, drops empty ones, and keeps only those
    that answer the question actually asked.
    """
    intent = state.get("intent", Intent.GENERAL)
    allowed = INTENT_CHARTS.get(intent, set())

    charts: list[ChartSpec] = []
    for key in ("sea_state", "weather", "marine"):
        payload = state.get(key) or {}
        for chart in payload.get("charts", []):
            if not isinstance(chart, ChartSpec):
                continue
            if chart.id not in allowed:
                logger.debug(
                    "visualization: dropping chart %s — not relevant to %s",
                    chart.id, intent.value,
                )
                continue
            # A series that is entirely null renders as an empty frame; drop it rather
            # than showing the user a chart with nothing in it.
            if any(point.y is not None for series in chart.series for point in series.points):
                charts.append(chart)

    return charts
