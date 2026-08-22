"""INCOIS Potential Fishing Zone advisories.

Owner: B (with E) · Phase: P0 spike, P1 build
Cache TTL: 24 hours (advisories are issued daily)

> ## ⚠️ THIS IS THE #1 TECHNICAL RISK IN THE PROJECT.
> INCOIS has **no clean REST API** — only WebGIS layers and HTML/text advisory pages.
> Scraping works until the day it doesn't, and that day has a habit of being demo day.
>
> **P0 spike (½ day, B + E):** run ``scripts/incois_spike.py`` and decide by end of Day 2
> whether we can depend on this. Write the decision into docs/DATA_SOURCES.md.
>
> **Either way, build ``services/pfz_proxy.py``.** Computing zones ourselves from
> chlorophyll + SST fronts is the same method INCOIS uses, it's more defensible in front
> of judges, and when both sources agree that agreement is our strongest evidence.

Entry points:
    https://incois.gov.in/MarineFisheries/PfzAdvisory
    https://incois.gov.in/MarineFisheries/TextDataHome     (text advisories)
    https://incois.gov.in/geoportal/MFASPFZ                (WebGIS layers)

14 coastal sectors, ~1223 nodes.
"""

from __future__ import annotations

BASE_URL = "https://incois.gov.in/MarineFisheries"
CACHE_TTL = 86_400
ATTRIBUTION = (
    "Potential Fishing Zone advisories © INCOIS, "
    "Ministry of Earth Sciences, Government of India"
)


async def fetch_advisory(sector: str | None = None, date: str | None = None) -> dict:
    """Fetch and parse the PFZ text advisory.

    TODO(P0, B): spike the parse — see scripts/incois_spike.py
    TODO(P1, B): BeautifulSoup + lxml; extract sector, validity, and the node lat/lons
    TODO(P1, B): **no advisory is a normal state**, not an error. None are issued during
                 the fishing ban period or when cloud cover blocks the satellite. Return
                 an explicit "no advisory today" rather than an empty list — the user must
                 be able to tell "none issued" from "we failed to fetch".
    TODO(P1, B): keep the last good advisory indefinitely as a fallback
    TODO(P1, B): fail LOUDLY into the proxy if the page layout changed. A parser that
                 silently returns zero zones is worse than one that crashes.
    """
    raise NotImplementedError("TODO(P1, B)")


async def get_zones_geojson(lat: float, lon: float, radius_km: float = 200.0) -> dict:
    """PFZ nodes near a point, as a GeoJSON FeatureCollection.

    TODO(P1, B): pick the relevant coastal sector from the point, then filter by radius
    TODO(P1, E): the advisory gives point nodes — decide with E whether to render them as
                 points or as buffered polygons, and keep the frontend consistent with it
    """
    raise NotImplementedError("TODO(P1, B)")


if __name__ == "__main__":
    # python -m app.adapters.incois_pfz
    # TODO(P0, B): print today's advisory for one sector. If this doesn't work reliably
    #              by end of Day 2, the proxy becomes the primary path.
    ...
