"""PFZ proxy tests.

Owner: E · Phase: P1

The proxy is the PRIMARY source for golden query #1 (see the P0 gate decision in
docs/DATA_SOURCES.md), so its arithmetic is load-bearing rather than a fallback detail.

No Copernicus files are needed here — the grids are synthetic, so the suite still runs on
a machine that has never downloaded a subset.
"""

from __future__ import annotations

import numpy as np
from app.services import pfz_proxy as P


def front_grid(n: int = 60, span_deg: float = 3.0):
    """A synthetic SST field with one sharp thermal front across the middle."""
    lats = np.linspace(16.0, 16.0 + span_deg, n)
    lons = np.linspace(82.0, 82.0 + span_deg, n)
    sst = np.zeros((n, n))
    for i in range(n):
        sst[i, :] = 28.0 + 1.5 / (1 + np.exp(-(i - n // 2) / 1.5))
    rng = np.random.default_rng(0)
    sst += rng.normal(0, 0.02, (n, n))  # sensor noise
    return sst, lats, lons


# ── Gradient ──────────────────────────────────────────────────────────────


def test_gradient_finds_the_front_and_ignores_flat_water():
    sst, lats, lons = front_grid()
    gradient = P.compute_sst_gradient(sst, lats, lons)

    mid = gradient.shape[0] // 2
    at_front = gradient[mid - 1 : mid + 2, :].mean()
    far_away = gradient[:5, :].mean()

    assert at_front > far_away * 5, "the front must dominate the flat background"


def test_gradient_scales_longitude_by_cos_latitude():
    """A degree of longitude is shorter than a degree of latitude, and by more the further
    north you go. Ignoring that overstates east-west gradients."""
    n = 40
    lons = np.linspace(80.0, 83.0, n)

    # The same east-west temperature ramp, evaluated near the equator and at high latitude.
    sst = np.tile(np.linspace(28.0, 30.0, n), (n, 1))

    near_equator = P.compute_sst_gradient(sst, np.linspace(0.0, 3.0, n), lons)
    high_latitude = P.compute_sst_gradient(sst, np.linspace(60.0, 63.0, n), lons)

    # Same °C over a physically shorter distance ⇒ a steeper gradient in °C/km.
    assert np.nanmedian(high_latitude) > np.nanmedian(near_equator) * 1.5


def test_gradient_tolerates_land_nan():
    sst, lats, lons = front_grid()
    sst[:5, :5] = np.nan  # land corner

    gradient = P.compute_sst_gradient(sst, lats, lons)

    assert np.isfinite(gradient[30:, 30:]).all(), "open water must stay finite"


# ── Zone detection ────────────────────────────────────────────────────────


def test_productive_water_on_a_front_qualifies_and_off_it_does_not():
    """The core claim of the method: chlorophyll AND a front, not either alone."""
    n = 60
    sst, lats, lons = front_grid(n)
    chl = np.full((n, n), 0.10)
    chl[n // 2 - 3 : n // 2 + 4, 12:22] = 0.55  # productive, ON the front
    chl[5:12, 40:50] = 0.60                      # productive, OFF the front

    zones = P.find_aggregation_zones(chl, sst, None, lats, lons)
    features = zones["features"]

    assert len(features) == 1, f"expected exactly the on-front patch, got {len(features)}"

    centroid_lat = features[0]["properties"]["centroid"][1]
    front_lat = lats[n // 2]
    assert abs(centroid_lat - front_lat) < 0.3, "the zone must sit on the front"


def test_uniform_ocean_yields_no_zones():
    """Featureless water must return nothing rather than inventing a zone.

    This is why the front threshold is absolute and not a live percentile — a percentile
    would always find a 'top 10%' and this system would never say "no zones today".
    """
    n = 40
    chl = np.full((n, n), 2.0)                    # very productive
    sst = np.full((n, n), 29.0)                   # but perfectly uniform
    lats = np.linspace(16.0, 19.0, n)
    lons = np.linspace(82.0, 85.0, n)

    zones = P.find_aggregation_zones(chl, sst, None, lats, lons)
    assert zones["features"] == []


def test_zones_carry_their_own_reasoning():
    """A zone must be able to explain why it qualified — it cannot appear by fiat."""
    n = 60
    sst, lats, lons = front_grid(n)
    chl = np.full((n, n), 0.10)
    chl[n // 2 - 3 : n // 2 + 4, 12:22] = 0.55

    feature = P.find_aggregation_zones(chl, sst, None, lats, lons)["features"][0]
    properties = feature["properties"]

    assert properties["chlorophyll_mg_m3"] > P.CHLOROPHYLL_THRESHOLD_MG_M3
    assert properties["sst_gradient_c_per_km"] > P.SST_FRONT_GRADIENT_THRESHOLD_C_PER_KM
    assert "chlorophyll" in properties["method"] and "SST" in properties["method"]
    # Never let a computed zone be mistaken for an official INCOIS advisory.
    assert "proxy" in properties["source"].casefold()
    assert "incois" not in properties["source"].casefold()


def test_zone_evidence_is_attributed_to_the_proxy():
    feature = {
        "properties": {
            "chlorophyll_mg_m3": 0.55,
            "sst_gradient_c_per_km": 0.031,
            "centroid": [82.5, 17.0],
        }
    }
    evidence = P.zone_evidence(feature)

    assert {e.field for e in evidence} == {"chlorophyll", "sst_gradient"}
    for item in evidence:
        assert "proxy" in item.source.casefold()
        assert item.location is not None


# ── Area filter ───────────────────────────────────────────────────────────


def test_cell_area_shrinks_with_latitude():
    """Longitude spacing narrows toward the poles, so the same degree box is smaller."""
    step = np.arange(0, 5, 0.25)

    tropical = P.cell_area_km2(17.0 + step, 82.0 + step)
    polar = P.cell_area_km2(60.0 + step, 82.0 + step)

    assert tropical > polar
    # 0.25° at 17°N is ~740 km².
    assert 600 < tropical < 900


def test_min_cells_adapts_to_grid_resolution():
    """The size filter is an AREA. A fixed cell count would silently change meaning when
    the grid resolution changes."""
    coarse = np.arange(0, 5, 0.25)   # 0.25° — the BGC chlorophyll grid
    fine = np.arange(0, 5, 0.05)     # 0.05° — the OSTIA SST grid

    coarse_cells = P._min_cells_for(17.0 + coarse, 82.0 + coarse)
    fine_cells = P._min_cells_for(17.0 + fine, 82.0 + fine)

    assert fine_cells > coarse_cells * 10, (
        "a finer grid needs many more cells to cover the same area"
    )


# ── Resampling ────────────────────────────────────────────────────────────


def test_resample_nearest_maps_onto_the_target_grid():
    src_lats = np.linspace(16.0, 19.0, 60)
    src_lons = np.linspace(82.0, 85.0, 60)
    dst_lats = np.linspace(16.0, 19.0, 12)
    dst_lons = np.linspace(82.0, 85.0, 12)

    # A field equal to its own row index makes the mapping checkable by eye.
    values = np.tile(np.arange(60.0)[:, None], (1, 60))
    out = P.resample_nearest(values, src_lats, src_lons, dst_lats, dst_lons)

    assert out.shape == (12, 12)
    assert out[0, 0] == 0.0
    assert out[-1, -1] == 59.0
    assert np.all(np.diff(out[:, 0]) > 0), "row ordering must be preserved"


def test_resample_preserves_front_strength_better_than_coarse_differencing():
    """The reason compute_zones works at native resolution.

    Regridding SST down BEFORE differencing averages real fronts away — measured at ~55%
    of p95 front strength lost on the actual Bay of Bengal subsets.
    """
    n = 120
    sst, lats, lons = front_grid(n)
    coarse_lats = lats[::5]
    coarse_lons = lons[::5]

    # Right: gradient at native resolution, then resampled.
    native = P.compute_sst_gradient(sst, lats, lons)
    resampled = P.resample_nearest(native, lats, lons, coarse_lats, coarse_lons)

    # Wrong: regrid first, then difference on the coarse grid.
    coarse_sst = P.resample_nearest(sst, lats, lons, coarse_lats, coarse_lons)
    coarse_gradient = P.compute_sst_gradient(coarse_sst, coarse_lats, coarse_lons)

    assert np.nanmax(resampled) > np.nanmax(coarse_gradient), (
        "computing the gradient natively must retain more front strength"
    )
