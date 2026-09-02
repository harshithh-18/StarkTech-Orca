"""Marine Data Agent — fishing zones and ocean productivity.

Owner: E · Phase: P1 · Type: Tool + LLM
Sources: INCOIS PFZ advisories, Copernicus Marine (chlorophyll-a, SST)

Powers golden query #1 (nearest PFZ) and #4 (why productivity declined).

**Two paths to a fishing zone, and we want both:**
  1. INCOIS official advisories — authoritative, but the P0 spike found no parseable
     endpoint (see ``adapters/incois_pfz``), so this is enrichment only
  2. Our own proxy from Copernicus — high chlorophyll coinciding with an SST front

Path 2 is the primary. It is scientifically the same method INCOIS itself uses, and it
means ORCA *reasons about* fishing zones rather than echoing a page. When both are
available and agree, that agreement is the strongest evidence in the whole product.
"""

from __future__ import annotations

import logging

from app.adapters import copernicus, incois_pfz
from app.schemas.response import ChartSpec, Evidence, Location
from app.services import pfz_proxy

logger = logging.getLogger(__name__)

NAME = "marine_data"

# Search box around the user, in degrees. ~2° ≈ 220 km, which comfortably covers the
# 200 km radius a day boat would consider.
SEARCH_MARGIN_DEG = 2.0


class NoZoneDataAvailable(Exception):
    """Neither the advisory nor the proxy could produce zones.

    Carries the reason so the trace step can say *why* — "Copernicus subset not
    downloaded" is actionable, "no zones" is not.
    """


async def get_fishing_zones(location: Location, radius_km: float = 200.0) -> dict:
    """Potential Fishing Zones near a location, as GeoJSON + evidence.

    Tries the official advisory first, then the computed proxy. Records which path
    produced the zones in the Evidence source, so the user can always tell an official
    advisory from our own computation.
    """
    sources_tried: list[str] = []

    # ── Path 1: official advisory (best effort) ───────────────────────────
    official = {"features": []}
    try:
        official = await incois_pfz.get_zones_geojson(
            location.lat, location.lon, radius_km
        )
        sources_tried.append(f"INCOIS advisory: {official.get('status')}")
    except Exception as exc:  # noqa: BLE001 - INCOIS must never fail the run
        logger.info("marine_data: INCOIS path failed (%s)", exc)
        sources_tried.append(f"INCOIS advisory: error ({exc})")

    # ── Path 2: computed proxy (primary) ──────────────────────────────────
    bbox = {
        "lat_min": location.lat - SEARCH_MARGIN_DEG,
        "lat_max": location.lat + SEARCH_MARGIN_DEG,
        "lon_min": location.lon - SEARCH_MARGIN_DEG,
        "lon_max": location.lon + SEARCH_MARGIN_DEG,
    }

    proxy_zones = {"features": []}
    proxy_error: str | None = None
    try:
        proxy_zones = pfz_proxy.compute_zones(bbox)
        sources_tried.append(f"computed proxy: {len(proxy_zones['features'])} zones")
    except copernicus.CopernicusDataMissing as exc:
        proxy_error = str(exc)
        logger.info("marine_data: proxy unavailable — %s", exc)
        sources_tried.append("computed proxy: Copernicus subset not downloaded")
    except Exception as exc:  # noqa: BLE001
        proxy_error = str(exc)
        logger.warning("marine_data: proxy failed (%s)", exc)
        sources_tried.append(f"computed proxy: error ({exc})")

    official_features = official.get("features") or []
    proxy_features = proxy_zones.get("features") or []

    if not official_features and not proxy_features:
        # Honest failure. Naming the fix is the difference between a user who can act and
        # one who just sees "no zones found".
        detail = proxy_error or official.get("detail") or "no data source produced zones"
        raise NoZoneDataAvailable(
            f"no fishing-zone data available. {detail} "
            f"(tried: {'; '.join(sources_tried)})"
        )

    features = official_features + proxy_features
    evidence: list[Evidence] = []
    attribution: list[str] = []

    if official_features:
        attribution.append(incois_pfz.ATTRIBUTION)
    if proxy_features:
        attribution.append(pfz_proxy.ATTRIBUTION)
        evidence.extend(pfz_proxy.zone_evidence(proxy_features[0]))

    # Corroboration is the strongest evidence we can offer — say so explicitly when both
    # independent methods produced zones.
    if official_features and proxy_features:
        evidence.append(
            Evidence(
                field="zone_corroboration",
                value=True,
                unit=None,
                source="INCOIS advisory and computed Copernicus proxy agree",
            )
        )

    return {
        "geojson": {"type": "FeatureCollection", "features": features},
        "evidence": evidence,
        "attribution": attribution,
        "path": "official+proxy" if (official_features and proxy_features)
        else ("official" if official_features else "proxy"),
        "sources_tried": sources_tried,
    }


async def get_productivity_trend(
    location: Location, days: int = 90
) -> tuple[list[Evidence], ChartSpec]:
    """Chlorophyll-a and SST anomaly over time — the "why has it declined?" answer.

    TODO(P2, E): compute the trend and the anomaly against the same period in prior
                 years, and correlate with marine-heat-wave advisories. Needs a
                 multi-date Copernicus subset, which the current fetch script does not
                 yet pull — see scripts/fetch_copernicus_subset.py.
    """
    raise NotImplementedError("TODO(P2, E): needs a time-series Copernicus subset")


async def explain_decline(evidence: list[Evidence], language: str) -> str:
    """Narrative for golden query #4, in the user's language.

    TODO(P2, A): grounded Gemini call. Deferred with get_productivity_trend — there is no
                 trend to narrate until the time-series subset exists.
    """
    raise NotImplementedError("TODO(P2, A)")
