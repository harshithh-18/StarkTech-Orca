"""Open-Meteo Marine — the sea-state backbone.

Owner: B · Phase: P0
Endpoint: https://marine-api.open-meteo.com/v1/marine
Auth: none · Quota: ~10 000 calls/day · Horizon: 16 days · Cache TTL: 1 hour

Wave height, period, direction, swell, sea-surface temperature, ocean currents.
The most decisive input to the safety verdict (golden query #2).
"""

from __future__ import annotations

from app.schemas.response import Evidence

BASE_URL = "https://marine-api.open-meteo.com/v1/marine"
CACHE_TTL = 3600
ATTRIBUTION = "Weather data by Open-Meteo.com (CC BY 4.0)"

HOURLY_FIELDS = [
    "wave_height",
    "wave_direction",
    "wave_period",
    "swell_wave_height",
    "swell_wave_period",
    "sea_surface_temperature",
    "ocean_current_velocity",
    "ocean_current_direction",
]


async def fetch(lat: float, lon: float, forecast_days: int = 7) -> dict:
    """Raw marine forecast for a point.

    TODO(P0, B): GET BASE_URL with HOURLY_FIELDS, timezone=auto, via fetch_with_cascade
    TODO(P0, B): Open-Meteo returns nulls over land — a coastal query can land on a land
                 cell and silently return nothing. Detect an all-null response and nudge
                 the point seaward rather than reporting "no data".
    """
    raise NotImplementedError("TODO(P0, B)")


async def get_sea_state_evidence(
    lat: float, lon: float, start: str, end: str
) -> list[Evidence]:
    """Evidence for the risk agent: the worst conditions within the window.

    TODO(P2, B): slice hourly arrays to [start, end]
    TODO(P2, B): return the MAXIMUM wave height with the hour it occurs in Evidence.time.
                 The peak is what makes the call, and "rough at 06:00" is the actionable fact.
    TODO(P2, B): name the wave model in `source` where the API reports it,
                 e.g. "Open-Meteo Marine (ICON-Wave)"
    """
    raise NotImplementedError("TODO(P2, B)")


if __name__ == "__main__":
    # Spike entry point: python -m app.adapters.open_meteo_marine
    # TODO(P0, B): fetch Kakinada (16.99, 82.24) and print wave height — this is the very
    #              first thing that must work in P0.
    ...
