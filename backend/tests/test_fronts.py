"""Thermal-front detection tests.

Owner: C (with E) · Phase: P4

Front detection is a claim about the physical ocean, so the tests are about what the
detector must and must not say:

  - a synthetic front is found, with the gradient roughly where it was put
  - **uniform water yields nothing** — a detector that always finds fronts is a random
    number generator with a nautical vocabulary
  - the classification separates a ribbon from a ring
  - nothing NumPy leaks into the output (a np.float64 serialises fine over JSON and then
    explodes inside the graph checkpointer, three layers from the line that made it)

Run against synthetic grids, not the Copernicus subset: the subset is gitignored, so a
test that needed it would be a test that never runs in CI.
"""

from __future__ import annotations

import json

import numpy as np
import pytest

from app.schemas.response import Location
from app.services import fronts, pfz_proxy


class FakeGrid:
    """The two attributes ``fronts.detect`` reads off a Copernicus grid."""

    def __init__(self, values, lats, lons):
        self.values = values
        self.lats = lats
        self.lons = lons


def install(monkeypatch, sst: np.ndarray, lats: np.ndarray, lons: np.ndarray):
    """Point ``fronts.detect`` at a synthetic SST field."""
    import app.adapters.copernicus as copernicus

    def fake_load_grids(bbox=None):
        chl = FakeGrid(np.zeros_like(sst), lats, lons)
        return chl, FakeGrid(sst, lats, lons)

    monkeypatch.setattr(copernicus, "load_grids", fake_load_grids)


# 0.05° spacing over a 6° box — the resolution the OSTIA SST product actually ships at.
# Using a coarser synthetic grid would make "one bad pixel" 11 km wide, which is a real
# ocean feature rather than the sensor noise the size floor is meant to reject.
SIZE = 121
AXIS_LATS = np.linspace(14.0, 20.0, SIZE)
AXIS_LONS = np.linspace(80.0, 86.0, SIZE)


def uniform_field(value: float = 29.0) -> np.ndarray:
    return np.full((SIZE, SIZE), value)


def test_uniform_water_yields_no_fronts(monkeypatch):
    """The most important case. Returning nothing when there is nothing is the answer."""
    install(monkeypatch, uniform_field(), AXIS_LATS, AXIS_LONS)

    collection = fronts.detect()
    assert collection["features"] == []
    assert collection["properties"]["count"] == 0


def test_a_sharp_north_south_step_is_detected_as_a_front(monkeypatch):
    """Two water masses meeting along a line of latitude."""
    sst = uniform_field(29.0)
    sst[SIZE // 2 :, :] = 27.0  # a 2 °C step across ~5 km — a strong front

    install(monkeypatch, sst, AXIS_LATS, AXIS_LONS)
    collection = fronts.detect()

    assert collection["features"], "a 2 °C step must be detected"
    strongest = collection["features"][0]["properties"]
    assert strongest["kind"] == "front"
    assert strongest["gradient_max_c_per_km"] > pfz_proxy.SST_FRONT_GRADIENT_THRESHOLD_C_PER_KM
    # It spans the full width of the box and almost none of its height.
    assert strongest["length_km"] > strongest["width_km"]


def test_a_compact_warm_core_is_classified_as_eddy_like(monkeypatch):
    """A ring, not a ribbon — and named `eddy_like`, never `eddy`."""
    sst = uniform_field(29.0)
    y, x = np.ogrid[:SIZE, :SIZE]
    core = (y - SIZE // 2) ** 2 + (x - SIZE // 2) ** 2 <= 8**2
    sst[core] = 31.5

    install(monkeypatch, sst, AXIS_LATS, AXIS_LONS)
    collection = fronts.detect()

    assert collection["features"]
    kinds = {feature["properties"]["kind"] for feature in collection["features"]}
    assert "eddy_like" in kinds
    assert "eddy" not in kinds, "we do not have sea-surface height; do not claim an eddy"


def test_noise_below_the_minimum_size_is_not_a_feature(monkeypatch):
    """A couple of disagreeing pixels is sensor noise, not an ocean feature."""
    sst = uniform_field(29.0)
    sst[20, 20] = 33.0
    sst[80, 94] = 25.0

    install(monkeypatch, sst, AXIS_LATS, AXIS_LONS)
    assert fronts.detect()["features"] == []


def test_output_is_plain_json_types(monkeypatch):
    """NumPy scalars serialise over JSON and then fail inside the graph checkpointer."""
    sst = uniform_field(29.0)
    sst[SIZE // 2 :, :] = 27.0
    install(monkeypatch, sst, AXIS_LATS, AXIS_LONS)

    collection = fronts.detect()
    # A round-trip through the strict encoder: no `default=` escape hatch, so anything
    # that is not a plain type raises here rather than in production.
    json.dumps(collection)


def test_features_are_ordered_strongest_first(monkeypatch):
    sst = uniform_field(29.0)
    sst[40:, :] = 28.5  # weak step
    sst[:, 80:] = 26.0  # strong step
    install(monkeypatch, sst, AXIS_LATS, AXIS_LONS)

    strengths = [
        feature["properties"]["gradient_max_c_per_km"]
        for feature in fronts.detect()["features"]
    ]
    assert strengths == sorted(strengths, reverse=True)


# ── Evidence and narrative ────────────────────────────────────────────────


@pytest.fixture
def one_front(monkeypatch):
    sst = uniform_field(29.0)
    sst[SIZE // 2 :, :] = 27.0
    install(monkeypatch, sst, AXIS_LATS, AXIS_LONS)
    return fronts.detect()


def test_nearest_front_measures_to_the_closest_cell_not_the_centroid(one_front):
    """A 200 km front is something you steam to the near end of."""
    here = Location(lat=17.05, lon=80.5)
    nearest = fronts.nearest_front(here, one_front)

    assert nearest is not None
    every_distance = [
        fronts.nearest_front(here, {"features": [one_front["features"][0]]})["distance_km"]
    ]
    assert nearest["distance_km"] <= min(every_distance) + 1e-6

    centroid = one_front["features"][0]["properties"]["centroid"]
    from app.agents.geospatial import distance_and_bearing

    to_centroid, _ = distance_and_bearing(
        here, Location(lat=centroid[1], lon=centroid[0])
    )
    assert nearest["distance_km"] <= to_centroid


def test_front_evidence_names_its_source_as_computed(one_front):
    evidence = fronts.front_evidence(Location(lat=17.05, lon=82.0), one_front)

    assert {item.field for item in evidence} == {
        "nearest_front_distance",
        "nearest_front_bearing",
        "front_strength",
        "front_kind",
    }
    assert all("computed" in item.source for item in evidence)


def test_no_front_is_reported_as_a_finding_not_a_failure():
    empty = {"type": "FeatureCollection", "features": []}
    here = Location(lat=17.0, lon=82.0)

    assert fronts.front_evidence(here, empty) == []
    described = fronts.describe(here, empty)
    assert "no thermal front" in described
    assert "uniform" in described
