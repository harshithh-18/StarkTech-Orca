"""Safety threshold tests.

Owner: C (with E) · Phase: P2

> **The most important test file in the repo.** These rules decide whether a fisherman
> goes to sea. Test every boundary, and test exactly-at-threshold — off-by-one on a
> comparison operator is the kind of bug that looks like nothing and matters enormously.
"""

from __future__ import annotations

import pytest


def test_calm_conditions_return_go():
    """TODO(P2, C)"""
    pytest.skip("TODO(P2, C)")


def test_wave_height_above_no_go_threshold_returns_no_go():
    """3.4 m vs a 2.5 m threshold → NO_GO, and the reason names both numbers."""
    pytest.skip("TODO(P2, C)")


def test_exactly_at_threshold():
    """Is the threshold inclusive? Decide deliberately, then pin it here."""
    pytest.skip("TODO(P2, C)")


def test_wind_alone_can_trigger_no_go():
    """Calm seas plus a gale is still NO_GO."""
    pytest.skip("TODO(P2, C)")


def test_visibility_compares_in_the_opposite_direction():
    """LOWER visibility is worse. Every other field is the other way round — easy bug."""
    pytest.skip("TODO(P2, C)")


def test_missing_sea_state_caps_verdict_at_caution():
    """Never issue GO on partial safety data. Absence of evidence is not evidence."""
    pytest.skip("TODO(P2, C)")


def test_reasons_name_value_threshold_and_source():
    """Every reason must be checkable by the user — value, limit, and where it came from."""
    pytest.skip("TODO(P2, C)")


def test_no_llm_in_the_decision_path():
    """Guard the design rule: evaluate() is pure. No network, no model, ever.

    A future refactor that "helpfully" adds an LLM call here should fail loudly.
    """
    pytest.skip("TODO(P2, C)")
