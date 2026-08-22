"""Open-Meteo Geocoding — place name → coordinates.

Owner: B · Phase: P0
Endpoint: https://geocoding-api.open-meteo.com/v1/search
Auth: none · Cache TTL: 30 days (place names don't move)

Resolves "near Vizag" or "Kakinada" when the device gives no GPS.
"""

from __future__ import annotations

from app.schemas.response import Location

BASE_URL = "https://geocoding-api.open-meteo.com/v1/search"
CACHE_TTL = 2_592_000  # 30 days
ATTRIBUTION = "Geocoding by Open-Meteo.com (CC BY 4.0)"


async def geocode(name: str, language: str = "en") -> Location | None:
    """Resolve a place name to a Location.

    TODO(P0, B): GET with count=5, country_code=IN; cache aggressively
    TODO(P1, B): prefer COASTAL matches — many Indian place names are ambiguous, and an
                 inland namesake will silently produce a nonsense marine forecast
    TODO(P2, F): handle regional-script and romanised names ("విశాఖపట్నం", "Vizag",
                 "Visakhapatnam" must all resolve to the same point). Consider a small
                 hand-written alias table for the ~30 major fishing harbours — more
                 reliable than the geocoder for exactly the names our users will type.
    """
    raise NotImplementedError("TODO(P0, B)")


if __name__ == "__main__":
    # python -m app.adapters.open_meteo_geocoding
    # TODO(P0, B): resolve "Kakinada" and assert ≈ (16.99, 82.24)
    ...
