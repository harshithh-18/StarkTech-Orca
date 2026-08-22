"""Marine Data Agent — fishing zones and ocean productivity.

Owner: E · Phase: P1 · Type: Tool + LLM
Sources: INCOIS PFZ advisories, Copernicus Marine (chlorophyll-a, SST)

Powers golden query #1 (nearest PFZ) and #4 (why productivity declined).

**Two paths to a fishing zone, and we want both:**
  1. INCOIS official advisories — authoritative, but scraped and fragile
  2. Our own proxy from Copernicus — high chlorophyll coinciding with an SST front

Path 2 is not merely a backup. It is scientifically the same method INCOIS itself uses,
and it means ORCA *reasons about* fishing zones rather than echoing a page. When both are
available and agree, that agreement is the strongest evidence in the whole product.

See the INCOIS risk section in docs/DATA_SOURCES.md.
"""

from __future__ import annotations

from app.schemas.response import ChartSpec, Evidence, Location


async def get_fishing_zones(location: Location, radius_km: float = 200.0) -> dict:
    """Potential Fishing Zones near a location, as GeoJSON + evidence.

    TODO(P1, E): try adapters.incois_pfz first
    TODO(P1, E): fall back to services.pfz_proxy (chlorophyll + SST front) on any failure
    TODO(P1, E): record WHICH path produced the zones in the Evidence source — the user
                 must be able to tell an official advisory from our own computation
    TODO(P2, E): when both agree, emit corroborating evidence saying so
    """
    raise NotImplementedError("TODO(P1, E)")


async def get_productivity_trend(location: Location, days: int = 90) -> tuple[list[Evidence], ChartSpec]:
    """Chlorophyll-a and SST anomaly over time — the "why has it declined?" answer.

    TODO(P2, E): read the Copernicus subsets from data/copernicus/ with xarray
    TODO(P2, E): compute the trend + anomaly vs the same period in prior years
    TODO(P2, E): return evidence + a ChartSpec for the chlorophyll series
    TODO(P2, E): correlate with marine-heat-wave advisories where they exist — MHW is a
                 real and defensible explanation for a productivity drop
    """
    raise NotImplementedError("TODO(P2, E)")


async def explain_decline(evidence: list[Evidence], language: str) -> str:
    """Narrative for golden query #4, in the user's language.

    This is the answer that showcases reasoning depth rather than lookup. A judge may
    well be an oceanographer — the narrative must stay defensible and must not overclaim
    causation from a correlation.

    TODO(P2, A): Gemini call, grounded strictly in the passed evidence — no free invention
    """
    raise NotImplementedError("TODO(P2, A)")
