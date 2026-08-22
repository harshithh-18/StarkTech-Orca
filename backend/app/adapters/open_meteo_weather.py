"""Open-Meteo Weather — wind, rain, storms.

Owner: B · Phase: P0
Endpoint: https://api.open-meteo.com/v1/forecast
Auth: none · Cache TTL: 1 hour

Wind and gusts pair with wave height to decide the safety verdict.
``thunderstorm_probability`` is our **proxy** for lightning risk — label it honestly in the
Evidence source; it is not an IMD lightning observation.
"""

from __future__ import annotations

from app.schemas.response import Evidence

BASE_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL = 3600
ATTRIBUTION = "Weather data by Open-Meteo.com (CC BY 4.0)"

HOURLY_FIELDS = [
    "wind_speed_10m",
    "wind_gusts_10m",
    "wind_direction_10m",
    "precipitation",
    "weather_code",
    "thunderstorm_probability",
    "visibility",
]


async def fetch(lat: float, lon: float, forecast_days: int = 7) -> dict:
    """Raw weather forecast for a point.

    TODO(P0, B): GET BASE_URL with HOURLY_FIELDS via fetch_with_cascade
    """
    raise NotImplementedError("TODO(P0, B)")


async def get_weather_evidence(
    lat: float, lon: float, start: str, end: str
) -> list[Evidence]:
    """Evidence for the risk agent: peak wind, gusts, storm probability in the window.

    TODO(P2, B): slice to the window; report peaks with their hour
    TODO(P2, B): source string for lightning must read as a proxy, e.g.
                 "Open-Meteo thunderstorm probability (modelled proxy, not IMD observation)"
    """
    raise NotImplementedError("TODO(P2, B)")


if __name__ == "__main__":
    # python -m app.adapters.open_meteo_weather
    # TODO(P0, B): print wind speed for Kakinada
    ...
