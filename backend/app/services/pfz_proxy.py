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
citable evidence, and it works when INCOIS doesn't.

As of the P0 spike (27 Aug 2026) INCOIS has no parseable advisory endpoint, so this is the
**primary** PFZ path, not a backup. See docs/DATA_SOURCES.md.

Inputs come from ``adapters.copernicus`` (local NetCDF, not live). Thresholds below are
provisional — tune them against known INCOIS advisories during P2 and record what you
tuned against.
"""

from __future__ import annotations

import logging

from app.schemas.response import Evidence, Location

logger = logging.getLogger(__name__)

# ── Thresholds ────────────────────────────────────────────────────────────
# Tuned 2 Sep 2026 against the real OSTIA + BGC subsets over the Bay of Bengal
# (14–20°N, 80–86°E, late SW monsoon). Re-run the sweep in the module's __main__ block
# after refreshing the subsets — these are regional and seasonal, not universal.
#
# TODO(P2, E): validate against published INCOIS advisories for the same dates. Matching
#              our zones to theirs is the real test; the percentile argument below is a
#              principled default, not a validation.

CHLOROPHYLL_THRESHOLD_MG_M3 = 0.25
"""Productive water. Weakly selective here — 72% of ocean cells in the monsoon Bay of
Bengal clear it (river discharge makes the whole basin productive), so in practice the
gradient below is what actually discriminates. Kept as a floor so a genuinely oligotrophic
patch cannot qualify on front strength alone."""

SST_FRONT_GRADIENT_THRESHOLD_C_PER_KM = 0.015
"""Front strength, set at roughly the **90th percentile** of observed gradients — the
common operational definition of a thermal front as the top ~10% of the local gradient
field.

Measured distribution over the tuning box (native 0.05° grid, ocean cells only):
    p50 0.0077 · p75 0.0119 · p90 0.0172 · p95 0.0219 · p99 0.0332 · max 0.068

An absolute threshold rather than a live percentile on purpose: a percentile would always
find "fronts", even in a featureless ocean, and would guarantee this system always returns
zones. Returning nothing when the water is uniform is the correct answer."""

MIN_ZONE_AREA_KM2 = 2000.0
"""Smallest area worth calling a fishing ground — roughly 45 km across.

Expressed as an AREA, not a cell count: the products ship at different resolutions, and a
fixed cell count silently changes what it means when the grid does. The cell equivalent is
derived per-grid in ``find_aggregation_zones``."""

SOURCE = "Copernicus Marine (computed PFZ proxy)"
ATTRIBUTION = "Generated using E.U. Copernicus Marine Service Information"


def compute_sst_gradient(sst_grid, lats=None, lons=None):
    """Magnitude of the SST gradient — front strength — in °C/km per grid cell.

    Grid spacing in degrees is NOT uniform in km: a degree of longitude shrinks by
    cos(latitude), so treating the axes alike overstates zonal gradients by ~5% at 17°N
    and much more further north. Longitude spacing is therefore scaled per row.
    """
    import numpy as np

    grid = np.asarray(sst_grid, dtype=float)

    # Smooth first — raw satellite SST is noisy and unsmoothed differencing produces
    # phantom fronts wherever two adjacent pixels disagree.
    smoothed = _boxcar(grid, size=3)

    if lats is None or lons is None:
        d_lat_km = d_lon_km = 111.32
        grad_y, grad_x = np.gradient(smoothed)
        return np.sqrt((grad_y / d_lat_km) ** 2 + (grad_x / d_lon_km) ** 2)

    lats = np.asarray(lats, dtype=float)
    lons = np.asarray(lons, dtype=float)

    lat_step_deg = float(np.abs(np.median(np.diff(lats)))) if lats.size > 1 else 1.0
    lon_step_deg = float(np.abs(np.median(np.diff(lons)))) if lons.size > 1 else 1.0

    grad_y, grad_x = np.gradient(smoothed)

    km_per_deg_lat = 111.32
    # cos(lat) per row, broadcast down the columns.
    cos_lat = np.cos(np.radians(lats))[:, None]
    km_per_deg_lon = 111.32 * np.clip(cos_lat, 1e-6, None)

    d_sst_d_lat = grad_y / (lat_step_deg * km_per_deg_lat)
    d_sst_d_lon = grad_x / (lon_step_deg * km_per_deg_lon)

    return np.sqrt(d_sst_d_lat**2 + d_sst_d_lon**2)


def _boxcar(grid, size: int = 3):
    """NaN-aware box smoothing. Keeps land (NaN) out of the average."""
    import numpy as np

    padded = np.pad(grid, size // 2, mode="edge")
    out = np.full(grid.shape, np.nan)
    for i in range(grid.shape[0]):
        for j in range(grid.shape[1]):
            window = padded[i : i + size, j : j + size]
            valid = window[~np.isnan(window)]
            if valid.size:
                out[i, j] = valid.mean()
    return out


def cell_area_km2(lats, lons) -> float:
    """Approximate area of one grid cell, in km².

    Longitude spacing shrinks by cos(latitude), so a 0.25° cell is ~780 km² at 17°N but
    would be ~480 km² at 55°N. Using the mid-latitude of the actual grid keeps the area
    filter honest wherever it runs.
    """
    import numpy as np

    lats = np.asarray(lats, dtype=float)
    lons = np.asarray(lons, dtype=float)
    if lats.size < 2 or lons.size < 2:
        return 0.0

    lat_step = float(np.abs(np.median(np.diff(lats))))
    lon_step = float(np.abs(np.median(np.diff(lons))))
    mid_lat = float(np.mean(lats))

    height_km = lat_step * 111.32
    width_km = lon_step * 111.32 * max(np.cos(np.radians(mid_lat)), 1e-6)
    return height_km * width_km


def _min_cells_for(lats, lons) -> int:
    """MIN_ZONE_AREA_KM2 expressed in cells of this particular grid."""
    area = cell_area_km2(lats, lons)
    if area <= 0:
        return 1
    return max(1, round(MIN_ZONE_AREA_KM2 / area))


def resample_nearest(values, src_lats, src_lons, dst_lats, dst_lons):
    """Nearest-neighbour resample of a 2-D field onto another grid's axes.

    Used to bring the natively-computed SST gradient onto the chlorophyll grid so the two
    masks can be intersected cell-for-cell. Nearest rather than bilinear on purpose: the
    gradient field is the *output* of a smoothing pass already, and nearest avoids a
    scipy dependency for what is a one-line index lookup.
    """
    import numpy as np

    src_lats = np.asarray(src_lats, dtype=float)
    src_lons = np.asarray(src_lons, dtype=float)
    rows = np.abs(src_lats[:, None] - np.asarray(dst_lats, dtype=float)[None, :]).argmin(axis=0)
    cols = np.abs(src_lons[:, None] - np.asarray(dst_lons, dtype=float)[None, :]).argmin(axis=0)
    return np.asarray(values, dtype=float)[np.ix_(rows, cols)]


def find_aggregation_zones(
    chlorophyll_grid,
    sst_grid,
    bbox: dict | None = None,
    lats=None,
    lons=None,
    sst_gradient=None,
) -> dict:
    """Candidate PFZ polygons as a GeoJSON FeatureCollection.

    Each feature carries the chlorophyll value and gradient magnitude that qualified it,
    so the zone can cite its own reasoning rather than appearing by fiat.

    ``sst_gradient`` lets the caller pass a gradient already computed at the SST product's
    native resolution — see ``compute_zones``. When omitted it is computed from
    ``sst_grid``, which assumes both fields share one grid.
    """
    import numpy as np

    chl = np.asarray(chlorophyll_grid, dtype=float)
    gradient = (
        np.asarray(sst_gradient, dtype=float)
        if sst_gradient is not None
        else compute_sst_gradient(sst_grid, lats, lons)
    )

    productive = chl > CHLOROPHYLL_THRESHOLD_MG_M3
    frontal = gradient > SST_FRONT_GRADIENT_THRESHOLD_C_PER_KM
    mask = productive & frontal & ~np.isnan(chl)

    logger.info(
        "pfz_proxy: %d productive cells ∧ %d frontal cells → %d qualifying cells",
        int(np.nansum(productive)),
        int(np.nansum(frontal)),
        int(np.nansum(mask)),
    )

    # Convert the minimum area into a cell count for THIS grid's resolution, so the
    # filter means the same thing whatever product is loaded.
    min_cells = _min_cells_for(lats, lons)

    labels, count = _label_regions(mask)
    features = []

    for label in range(1, count + 1):
        cells = np.argwhere(labels == label)
        if len(cells) < min_cells:
            continue  # a two-pixel "zone" is noise, not a fishing ground

        rows, cols = cells[:, 0], cells[:, 1]
        zone_chl = float(np.nanmean(chl[rows, cols]))
        zone_grad = float(np.nanmean(gradient[rows, cols]))

        # Centroid and a bounding ring in real coordinates.
        if lats is not None and lons is not None:
            lat_values = np.asarray(lats, dtype=float)[rows]
            lon_values = np.asarray(lons, dtype=float)[cols]
        else:
            lat_values, lon_values = rows.astype(float), cols.astype(float)

        centroid_lat = float(np.mean(lat_values))
        centroid_lon = float(np.mean(lon_values))
        lat_min, lat_max = float(np.min(lat_values)), float(np.max(lat_values))
        lon_min, lon_max = float(np.min(lon_values)), float(np.max(lon_values))

        # Confidence: how far past both thresholds this zone sits. Lets "nearest" mean
        # "nearest *good* zone" rather than nearest marginal blob.
        confidence = min(
            1.0,
            (zone_chl / CHLOROPHYLL_THRESHOLD_MG_M3 - 1.0) * 0.5
            + (zone_grad / SST_FRONT_GRADIENT_THRESHOLD_C_PER_KM - 1.0) * 0.5,
        )

        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [lon_min, lat_min],
                            [lon_max, lat_min],
                            [lon_max, lat_max],
                            [lon_min, lat_max],
                            [lon_min, lat_min],
                        ]
                    ],
                },
                "properties": {
                    "chlorophyll_mg_m3": round(zone_chl, 3),
                    "sst_gradient_c_per_km": round(zone_grad, 4),
                    "cells": len(cells),
                    "confidence": round(max(confidence, 0.0), 2),
                    "centroid": [round(centroid_lon, 4), round(centroid_lat, 4)],
                    "source": SOURCE,
                    "method": (
                        f"chlorophyll-a > {CHLOROPHYLL_THRESHOLD_MG_M3} mg/m³ and "
                        f"|∇SST| > {SST_FRONT_GRADIENT_THRESHOLD_C_PER_KM} °C/km"
                    ),
                },
            }
        )

    features.sort(key=lambda f: f["properties"]["confidence"], reverse=True)
    logger.info("pfz_proxy: %d zones survived the size filter", len(features))

    return {"type": "FeatureCollection", "features": features}


def _label_regions(mask):
    """Connected-component labelling (4-connectivity), iterative flood fill.

    Hand-rolled to avoid a scipy/skimage dependency for one function — the grids are
    small enough (a few hundred cells per side) that this is not a bottleneck.
    """
    import numpy as np

    mask = np.asarray(mask, dtype=bool)
    labels = np.zeros(mask.shape, dtype=int)
    current = 0

    for start_i in range(mask.shape[0]):
        for start_j in range(mask.shape[1]):
            if not mask[start_i, start_j] or labels[start_i, start_j]:
                continue
            current += 1
            stack = [(start_i, start_j)]
            labels[start_i, start_j] = current
            while stack:
                i, j = stack.pop()
                for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ni, nj = i + di, j + dj
                    if (
                        0 <= ni < mask.shape[0]
                        and 0 <= nj < mask.shape[1]
                        and mask[ni, nj]
                        and not labels[ni, nj]
                    ):
                        labels[ni, nj] = current
                        stack.append((ni, nj))

    return labels, current


def zone_evidence(zone: dict) -> list[Evidence]:
    """Evidence explaining why a zone qualified.

    Sourced explicitly to the computed proxy — this must never be mistaken for an
    official INCOIS advisory.
    """
    properties = zone.get("properties") or {}
    centroid = properties.get("centroid") or [None, None]
    location = (
        Location(lat=centroid[1], lon=centroid[0], source="pfz_proxy_centroid")
        if centroid[0] is not None
        else None
    )

    return [
        Evidence(
            field="chlorophyll",
            value=properties.get("chlorophyll_mg_m3"),
            unit="mg/m³",
            source=SOURCE,
            location=location,
        ),
        Evidence(
            field="sst_gradient",
            value=properties.get("sst_gradient_c_per_km"),
            unit="°C/km",
            source=SOURCE,
            location=location,
        ),
    ]


def compute_zones(bbox: dict | None = None) -> dict:
    """Load the Copernicus grids and run the proxy. Raises if the subset is missing.

    The gradient is computed on the SST product's own grid (0.05°, ~5.5 km) and only then
    resampled onto the coarser chlorophyll grid (0.25°, ~28 km). Doing it the other way —
    regridding SST down first — averages real fronts away before they can be measured,
    and fronts are the entire basis of this method.
    """
    from app.adapters import copernicus

    chl_grid, sst_grid = copernicus.load_grids(bbox)

    gradient_native = compute_sst_gradient(sst_grid.values, sst_grid.lats, sst_grid.lons)
    gradient = resample_nearest(
        gradient_native, sst_grid.lats, sst_grid.lons, chl_grid.lats, chl_grid.lons
    )

    logger.info(
        "pfz_proxy: SST gradient computed at %s (native), resampled to %s (chlorophyll grid)",
        sst_grid.shape,
        chl_grid.shape,
    )

    return find_aggregation_zones(
        chl_grid.values,
        None,
        bbox,
        chl_grid.lats,
        chl_grid.lons,
        sst_gradient=gradient,
    )
