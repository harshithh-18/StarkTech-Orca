"""Potential Fishing Zone proxy — computed, not scraped.

Owner: E · Phase: P1

**The method.** Fish aggregate where nutrient-rich water meets warmer water: high
chlorophyll-a concentration coinciding with a strong sea-surface-temperature gradient
(a thermal front). This is scientifically the same approach INCOIS itself uses to issue
advisories.

    chlorophyll-a > ~0.2–0.3 mg/m³   AND   |∇SST| above a front threshold
        ⇒ likely fish-aggregation zone

**Why this matters beyond being a fallback.** It is the difference between ORCA *reasoning
about* fishing zones and echoing a scraped page. Every step is explainable, every input is
citable evidence, and it works when INCOIS doesn't. Build it even if the scrape succeeds —
when the two sources agree, that agreement is the strongest evidence in the product.

Inputs come from ``adapters.copernicus`` (local NetCDF, not live). Thresholds below are
provisional — tune them against known INCOIS advisories during P2 and record what you
tuned against.
"""

from __future__ import annotations

from app.schemas.response import Evidence

# TODO(P2, E): tune against real INCOIS advisories; document the validation set
CHLOROPHYLL_THRESHOLD_MG_M3 = 0.25
SST_FRONT_GRADIENT_THRESHOLD_C_PER_KM = 0.05


def compute_sst_gradient(sst_grid):
    """Magnitude of the SST gradient — front strength — per grid cell.

    TODO(P1, E): np.gradient over the SST field, converted to °C/km (grid spacing in
                 degrees is NOT uniform in km — scale longitude by cos(latitude))
    TODO(P2, E): smooth first; raw satellite SST is noisy and will produce phantom fronts
    """
    raise NotImplementedError("TODO(P1, E)")


def find_aggregation_zones(
    chlorophyll_grid,
    sst_grid,
    bbox: dict | None = None,
) -> dict:
    """Candidate PFZ polygons as a GeoJSON FeatureCollection.

    Each feature carries the chlorophyll value and gradient magnitude that qualified it,
    so the zone can cite its own reasoning rather than appearing by fiat.

    TODO(P1, E): threshold both fields, intersect the masks
    TODO(P1, E): contour the mask into polygons (skimage.measure.find_contours or
                 rasterio.features.shapes)
    TODO(P1, E): drop specks — a two-pixel "zone" is noise, not a fishing ground
    TODO(P2, E): rank by confidence so "nearest" can mean "nearest *good* zone"
    """
    raise NotImplementedError("TODO(P1, E)")


def zone_evidence(zone: dict) -> list[Evidence]:
    """Evidence explaining why a zone qualified.

    TODO(P1, E): one Evidence for chlorophyll, one for SST gradient, both sourced to
                 "Copernicus Marine (computed PFZ proxy)" — never let this be mistaken
                 for an official INCOIS advisory
    """
    raise NotImplementedError("TODO(P1, E)")
