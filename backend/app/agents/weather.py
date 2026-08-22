"""Weather Intelligence Agent.

Owner: B · Phase: P2 · Type: Tool + light LLM
Sources: Open-Meteo Weather, IMD / RSMC bulletins

Wind, gusts, precipitation, thunderstorm probability, cyclone bulletins. Feeds the risk
agent alongside sea-state — wind and wave together decide the verdict.

⚠️ **Honesty note.** Lightning here is a *modelled proxy* (Open-Meteo thunderstorm
probability), not an IMD lightning observation. Say so in the evidence ``source`` string
and say it out loud in the demo. Judges respect a team that knows the limits of its data.
"""

from __future__ import annotations

from app.schemas.response import Evidence, Location


async def fetch_weather(location: Location, time_window: dict) -> list[Evidence]:
    """Wind speed, gusts, direction, precipitation, thunderstorm probability.

    TODO(P2, B): call adapters.open_meteo_weather; slice to time_window
    TODO(P2, B): return one Evidence per field at the worst hour in the window —
                 a safety verdict cares about the peak, not the average
    """
    raise NotImplementedError("TODO(P2, B)")


async def check_cyclone_alerts(location: Location) -> list[Evidence]:
    """IMD / RSMC cyclone and severe-weather bulletins near the location.

    TODO(P2, B): call adapters.imd_bulletins; filter by proximity
    TODO(P2, B): absence of a bulletin is NOT evidence of safety — return an explicit
                 "no active bulletin" Evidence rather than an empty list, so the trace
                 shows the check actually ran
    """
    raise NotImplementedError("TODO(P2, B)")
