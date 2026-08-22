"""Adapter parsing tests.

Owner: C (with B) · Phase: P1

> **No live network calls in tests.** Record a fixture once, commit it, test against it.
> A test suite that needs the internet is a test suite that fails on demo morning.

Fixtures live in ``backend/tests/fixtures/`` — capture with each adapter's ``__main__``
spike block and save the raw response.
"""

from __future__ import annotations

import pytest


def test_open_meteo_marine_parses_wave_height():
    """TODO(P1, C)"""
    pytest.skip("TODO(P1, C)")


def test_open_meteo_marine_handles_land_nulls():
    """Open-Meteo returns nulls over land. A coastal point can land on a land cell —
    that must be detected, not passed through as "no waves"."""
    pytest.skip("TODO(P1, C)")


def test_incois_parser_against_recorded_page():
    """The highest-value adapter test — this parser is the project's #1 risk."""
    pytest.skip("TODO(P1, C)")


def test_incois_no_advisory_is_not_an_error():
    """None are issued during the ban period. Must return "none issued", not an empty
    success that reads identically to a failure."""
    pytest.skip("TODO(P1, C)")


def test_cascade_falls_back_to_cache_on_network_failure():
    """live fails → stale cache is served → the tier is reported as CACHE."""
    pytest.skip("TODO(P3, C)")


def test_adapter_never_raises_on_network_failure():
    """Total failure returns the mock rung. A dead source must never 500."""
    pytest.skip("TODO(P3, C)")


def test_geodesic_distance_not_euclidean():
    """At 17°N a degree of longitude is ~15% shorter than a degree of latitude.
    Euclidean error here is measured in kilometres."""
    pytest.skip("TODO(P1, C)")
