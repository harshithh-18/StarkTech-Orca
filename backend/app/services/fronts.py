"""Thermal front detection — where the fish actually are, and why.

Owner: E · Phase: P4 (the P3 stretch item, delivered)

A **thermal front** is a sharp horizontal change in sea-surface temperature: the seam
where two water masses meet. Fronts concentrate plankton, plankton concentrate forage
fish, forage fish concentrate everything above them. They are the single most useful
oceanographic feature for a fisherman, and they are what INCOIS's own PFZ advisories are
built on.

``services.pfz_proxy`` already computes the SST gradient field, and uses it as one of two
tests for a fishing zone. This module surfaces the **feature itself** — the front lines and
the eddy-like closed features — as a map layer and as evidence in its own right, so the
answer to *"why is this a fishing zone?"* can point at the physical structure rather than
at a threshold being met.

## Method

Edge detection on a smoothed SST field, which is the classical technique and is what
"CV front detection" means in an oceanographic context:

  1. NaN-aware box smoothing (in ``pfz_proxy._boxcar``) to kill single-pixel satellite noise
  2. gradient magnitude in °C/km, longitude scaled by cos(latitude)
  3. threshold at the operational front definition — the top ~10% of the local gradient
     field, ``pfz_proxy.SST_FRONT_GRADIENT_THRESHOLD_C_PER_KM``
  4. connected-component labelling to group cells into distinct features
  5. classify each feature: a compact, roughly circular blob is reported as **eddy-like**;
     an elongated one as a **front**

Step 5 is a shape heuristic, not a dynamical eddy detection — a real one needs sea-surface
height and geostrophic velocity, which the SST subset does not carry. The feature type
says ``eddy_like`` rather than ``eddy`` for exactly that reason, and the property
``method`` records what was actually done. Claiming an eddy detector we do not have would
be the easiest lie in this repo to tell and the easiest for an oceanographer to catch.
"""

from __future__ import annotations

import logging

from app.adapters.copernicus import ATTRIBUTION
from app.schemas.response import Evidence, Location
from app.services import pfz_proxy

logger = logging.getLogger(__name__)

SOURCE = "Copernicus Marine SST (computed thermal front detection)"

MIN_FRONT_AREA_KM2 = 800.0
"""Smaller than this is noise that survived the smoother, not an ocean feature.

Expressed as an AREA, not a cell count — the same reasoning as
``pfz_proxy.MIN_ZONE_AREA_KM2``: the products ship at different resolutions, and a fixed
cell count silently changes what it means when the grid does.

The value is set by what the smoother leaves behind. A 3×3 boxcar spreads a single bad
satellite pixel across a 5×5 gradient neighbourhood, of which about a dozen cells clear
the threshold — roughly 350 km² on the 0.05° SST grid. One hot pixel is not an ocean
front, so the floor sits above that. ~800 km² is a feature about 28 km across, which is
the smallest thing worth telling a fisherman to steam toward anyway."""

# Elongation above which a feature is a front rather than an eddy. A front is a seam and
# is long and thin; a ring is compact. 2.0 is the ratio of the feature's bounding box
# sides — deliberately crude, because the classification is advisory, not load-bearing.
ELONGATION_RATIO = 2.0

COMPACT_FILL_RATIO = 0.45
"""Below this share of its own bounding box, a feature is a ribbon, not a ring.

A circle fills π/4 ≈ 0.79 of its bounding square, so 0.45 leaves generous room for a
ragged, satellite-derived approximation of one before it is called a front instead."""


def detect(bbox: dict | None = None, downsample: int = 2) -> dict:
    """Detect thermal fronts and eddy-like features. Returns a GeoJSON FeatureCollection.

    Each feature is a ``MultiPoint`` of the cells that make it up, carrying its mean and
    peak gradient, its approximate length, and the classification. Points rather than
    polygons because the detection is cell-wise: drawing a smooth polygon around a ragged
    set of cells would imply a precision the gradient field does not have.
    """
    import numpy as np

    from app.adapters import copernicus

    _, sst_grid = copernicus.load_grids(bbox)
    gradient = pfz_proxy.compute_sst_gradient(
        sst_grid.values, sst_grid.lats, sst_grid.lons
    )

    threshold = pfz_proxy.SST_FRONT_GRADIENT_THRESHOLD_C_PER_KM
    frontal = np.nan_to_num(gradient, nan=0.0) > threshold

    labels, count = pfz_proxy._label_regions(frontal)
    logger.info(
        "fronts: %d candidate feature(s) above %.4f °C/km on a %s grid",
        count, threshold, sst_grid.values.shape,
    )

    cell_area = float(pfz_proxy.cell_area_km2(sst_grid.lats, sst_grid.lons))
    min_cells = max(4, int(MIN_FRONT_AREA_KM2 / max(cell_area, 1e-6)))
    logger.debug(
        "fronts: cell area %.0f km² → minimum feature size %d cells", cell_area, min_cells
    )

    features = []
    for label in range(1, count + 1):
        rows, cols = np.where(labels == label)
        if rows.size < min_cells:
            continue

        lats = sst_grid.lats[rows]
        lons = sst_grid.lons[cols]

        lat_span_km = (float(lats.max()) - float(lats.min())) * 111.32
        lon_span_km = (
            (float(lons.max()) - float(lons.min()))
            * 111.32
            * float(np.cos(np.radians(float(lats.mean()))))
        )
        long_side = max(lat_span_km, lon_span_km)
        short_side = max(min(lat_span_km, lon_span_km), 1e-6)
        elongation = long_side / short_side

        # Bounding-box elongation alone misclassifies a diagonal or curved front, whose
        # box is square even though the feature is a thin ribbon. The fill ratio — how
        # much of that box the feature's own cells actually occupy — catches those: a
        # compact ring fills most of its box, a meandering seam fills very little of it.
        box_area = max(long_side * short_side, 1e-6)
        fill_ratio = (int(rows.size) * cell_area) / box_area

        kind = (
            "front"
            if elongation >= ELONGATION_RATIO or fill_ratio < COMPACT_FILL_RATIO
            else "eddy_like"
        )

        # Thin the drawn points so a large feature doesn't ship 4 000 coordinates to a
        # phone. The statistics below are computed over every cell, not the thinned set.
        stride = max(1, rows.size // 240)
        coordinates = [
            [round(float(sst_grid.lons[c]), 3), round(float(sst_grid.lats[r]), 3)]
            for r, c in zip(rows[::stride], cols[::stride])
        ]

        strengths = gradient[rows, cols]
        temperatures = sst_grid.values[rows, cols]

        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "MultiPoint", "coordinates": coordinates},
                "properties": {
                    "kind": kind,
                    "gradient_mean_c_per_km": round(float(np.nanmean(strengths)), 4),
                    "gradient_max_c_per_km": round(float(np.nanmax(strengths)), 4),
                    "length_km": round(long_side, 0),
                    "width_km": round(short_side, 0),
                    "fill_ratio": round(fill_ratio, 2),
                    "sst_mean_c": round(float(np.nanmean(temperatures)), 2),
                    "cells": int(rows.size),
                    "centroid": [
                        round(float(lons.mean()), 3),
                        round(float(lats.mean()), 3),
                    ],
                    "method": (
                        "gradient magnitude of 3×3-smoothed SST, thresholded at "
                        f"{threshold} °C/km (~90th percentile), connected components; "
                        "shape heuristic for eddy_like — not a dynamical eddy detection"
                    ),
                    "source": SOURCE,
                },
            }
        )

    # Strongest first: the map draws them in order and the strongest front is the one a
    # boat should be steaming toward.
    features.sort(key=lambda f: f["properties"]["gradient_max_c_per_km"], reverse=True)

    collection = {
        "type": "FeatureCollection",
        "features": features,
        "properties": {
            "source": SOURCE,
            "attribution": ATTRIBUTION,
            "threshold_c_per_km": float(threshold),
            "count": len(features),
        },
    }

    # Every value above is already coerced with float()/int(), but this is a NumPy
    # pipeline and a single missed coercion produces a np.float64 that serialises fine
    # over JSON and then fails inside the graph checkpointer, three layers away from the
    # line that made it. One cheap round-trip removes that entire class of bug.
    import json

    return json.loads(json.dumps(collection, default=float))


def nearest_front(location: Location, collection: dict) -> dict | None:
    """The front nearest a point, with distance and bearing.

    Measured to the nearest *cell* of the feature, not to its centroid: a 200 km front is
    something you steam to the near end of, and quoting the centroid would send a boat
    100 km past where it should have stopped.
    """
    from app.agents.geospatial import distance_and_bearing

    best: tuple[float, float, dict, Location] | None = None

    for feature in collection.get("features") or []:
        for lon, lat in feature["geometry"]["coordinates"]:
            target = Location(lat=lat, lon=lon, source="front_cell")
            distance_km, bearing = distance_and_bearing(location, target)
            if best is None or distance_km < best[0]:
                best = (distance_km, bearing, feature, target)

    if best is None:
        return None

    distance_km, bearing, feature, target = best
    return {
        "distance_km": round(distance_km, 1),
        "bearing_deg": round(bearing, 1),
        "feature": feature,
        "location": target,
    }


def front_evidence(location: Location, collection: dict) -> list[Evidence]:
    """Evidence describing the nearest thermal front, for the marine-data answer.

    Returns an empty list when no front was detected — and that is a real finding, not a
    failure: uniform water means no front, and the caller should say so rather than
    inventing one.
    """
    from app.agents.geospatial import compass_point

    nearest = nearest_front(location, collection)
    if nearest is None:
        return []

    properties = nearest["feature"]["properties"]
    return [
        Evidence(
            field="nearest_front_distance",
            value=nearest["distance_km"],
            unit="km",
            source=SOURCE,
            location=nearest["location"],
        ),
        Evidence(
            field="nearest_front_bearing",
            value=compass_point(nearest["bearing_deg"]),
            source=SOURCE,
            location=nearest["location"],
        ),
        Evidence(
            field="front_strength",
            value=properties["gradient_max_c_per_km"],
            unit="°C/km",
            source=SOURCE,
            location=nearest["location"],
        ),
        Evidence(
            field="front_kind",
            value=properties["kind"],
            source=SOURCE,
            location=nearest["location"],
        ),
    ]


def describe(location: Location, collection: dict) -> str:
    """One English sentence about the nearest front, for the trace and the answer."""
    from app.agents.geospatial import compass_word

    nearest = nearest_front(location, collection)
    if nearest is None:
        return (
            "no thermal front was detected in this area — the surface water is thermally "
            "uniform, which is itself a reason productivity may be low"
        )

    properties = nearest["feature"]["properties"]
    kind = (
        "an eddy-like feature"
        if properties["kind"] == "eddy_like"
        else f"a {properties['length_km']:.0f} km thermal front"
    )
    return (
        f"{kind} lies {nearest['distance_km']:.0f} km "
        f"{compass_word(nearest['bearing_deg'])}, with a peak temperature gradient of "
        f"{properties['gradient_max_c_per_km']} °C/km — the kind of boundary that "
        f"concentrates plankton and the fish that feed on it"
    )
