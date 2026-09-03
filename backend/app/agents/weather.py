"""Weather Intelligence Agent.

Owner: B · Phase: P2 · Type: Tool + light LLM
Sources: Open-Meteo Weather, IMD / RSMC bulletins

Wind, gusts, precipitation, thunderstorm potential, cyclone bulletins. Feeds the risk
agent alongside sea-state — wind and wave together decide the verdict.

⚠️ **Honesty note.** Lightning here is a *modelled proxy* (Open-Meteo CAPE — convective
available potential energy), not an IMD lightning observation. It says the atmosphere is
capable of storms, not that lightning was observed. That distinction is in the evidence
``source`` string and belongs in the demo narration too.
"""

from __future__ import annotations

import logging

from app.adapters import open_meteo_weather
from app.schemas.response import Evidence, Location

logger = logging.getLogger(__name__)

NAME = "weather"
ATTRIBUTION = open_meteo_weather.ATTRIBUTION


async def fetch_weather(location: Location, time_window: dict) -> list[Evidence]:
    """Wind speed, gusts, precipitation, CAPE, visibility at the worst hour in the window."""
    return await open_meteo_weather.get_weather_evidence(
        location.lat,
        location.lon,
        time_window["start"],
        time_window["end"],
    )


async def check_cyclone_alerts(location: Location) -> list[Evidence]:
    """Tropical-system check near the location.

    Absence of a warning is NOT evidence of safety, so this always returns evidence —
    including an explicit ``cyclone_bulletin_active=False`` — rather than an empty list.
    The trace must be able to show that the check ran and found nothing, which reads
    completely differently from the check never running.

    IMD publishes no machine-readable bulletin endpoint (every documented URL 404s; see
    ``adapters.imd_bulletins``), so this is a **declared proxy**: modelled pressure and
    wind classified against IMD's own bands, labelled as such in every evidence source.
    """
    from app.adapters import imd_bulletins

    return await imd_bulletins.get_alerts_near(location.lat, location.lon)
