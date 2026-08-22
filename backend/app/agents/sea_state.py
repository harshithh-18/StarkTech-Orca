"""Ocean / Sea-State Agent.

Owner: B · Phase: P2 · Type: Tool (no LLM)
Source: Open-Meteo Marine

The sea-state backbone: wave height, period, direction, swell, currents, sea-surface
temperature. Wave height is the single most decisive input to the safety verdict —
golden query #2 lives or dies here.

Purely deterministic. No LLM, no interpretation — fetch, slice, return evidence.
"""

from __future__ import annotations

from app.schemas.response import ChartSpec, Evidence, Location


async def fetch_sea_state(location: Location, time_window: dict) -> list[Evidence]:
    """Wave height, period, direction, swell height, currents, SST.

    TODO(P2, B): call adapters.open_meteo_marine; slice to time_window
    TODO(P2, B): report the MAXIMUM wave height in the window, not the mean — and put the
                 hour it occurs in Evidence.time. "Rough at 06:00" is the actionable fact.
    """
    raise NotImplementedError("TODO(P2, B)")


async def fetch_forecast_chart(location: Location, hours: int = 48) -> ChartSpec:
    """48-hour wave-height series for the forecast chart.

    TODO(P2, B): build a ChartSpec with one series; localise the title into the response
                 language at the explainability layer, not here
    """
    raise NotImplementedError("TODO(P2, B)")


async def fetch_tides(location: Location) -> ChartSpec:
    """Tide curve.

    TODO(P3, B): Open-Meteo Marine doesn't publish tides directly — decide between a
                 harmonic model and an INCOIS tide table, and note the choice in
                 docs/DATA_SOURCES.md. Cut this if P3 is tight; it's the least load-bearing
                 chart on the screen.
    """
    raise NotImplementedError("TODO(P3, B)")
