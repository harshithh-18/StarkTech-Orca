"""IMD / RSMC cyclone and severe-weather bulletins.

Owner: B · Phase: P2
Source: https://mausam.imd.gov.in/ and RSMC New Delhi bulletins
Cache TTL: 1 hour (3 hours normally, but drop it during an active system)

Cyclone and lightning data are genuinely hard to obtain cleanly. Our approach: parse IMD
bulletins where we can, and use Open-Meteo's thunderstorm probability as a proxy elsewhere.

> **Flag the proxy honestly** — in the Evidence source string and out loud in the demo.
> "Lightning risk here is modelled, not observed" costs nothing to say and buys real
> credibility. Overclaiming in front of a judge who knows the difference costs everything.
"""

from __future__ import annotations

from app.schemas.response import Evidence

BASE_URL = "https://mausam.imd.gov.in"
CACHE_TTL = 3600
ATTRIBUTION = "Cyclone bulletins © India Meteorological Department (IMD) / RSMC New Delhi"


async def fetch_active_bulletins() -> list[dict]:
    """Currently active cyclone / severe-weather bulletins.

    TODO(P2, B): parse the IMD bulletin page; extract system name, category, position,
                 movement and the validity window
    TODO(P2, B): this is scraping, so treat it exactly like INCOIS — cache the last good
                 result, degrade to Open-Meteo storm probability, never hard-fail
    """
    raise NotImplementedError("TODO(P2, B)")


async def get_alerts_near(lat: float, lon: float, radius_km: float = 500.0) -> list[Evidence]:
    """Bulletins relevant to a location.

    TODO(P2, B): filter active bulletins by distance from the system centre
    TODO(P2, B): when there are none, return an explicit "no active bulletin" Evidence.
                 Absence of a warning is not evidence of safety, and the trace should show
                 that we checked.
    """
    raise NotImplementedError("TODO(P2, B)")
