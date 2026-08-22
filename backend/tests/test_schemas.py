"""Contract tests.

Owner: C · Phase: P1

These matter more than they look. The schema is the coordination point between four people
working in parallel — if it drifts, everyone's day is wasted. The most important test here
is that the implementation report's §12 example still validates.
"""

from __future__ import annotations

import pytest

# ── The canonical example from implementation report §12 / docs/API_CONTRACT.md ──
REPORT_EXAMPLE = {
    "query": "Is it safe to sail tomorrow near Kakinada?",
    "session_id": "test-session",
    "language": "te",
    "intent": "safety_check",
    "location": {"lat": 16.99, "lon": 82.24, "name": "Kakinada"},
    "answer": "No-Go tomorrow morning: seas too rough.",
    "verdict": "NO_GO",
    "evidence": [
        {
            "field": "wave_height",
            "value": 3.4,
            "unit": "m",
            "source": "Open-Meteo Marine (ICON-Wave)",
            "time": "2026-09-02T06:00:00Z",
        },
        {
            "field": "wind_speed",
            "value": 42,
            "unit": "km/h",
            "source": "Open-Meteo",
            "time": "2026-09-02T06:00:00Z",
        },
    ],
    "reasoning_trace": [
        {"seq": 0, "agent": "language_intent", "status": "ok",
         "message": "Intent=safety_check, lang=te, resolved Kakinada→16.99,82.24"},
        {"seq": 1, "agent": "planner", "status": "ok",
         "message": "Planner → [Weather, Sea-state, Risk]"},
        {"seq": 2, "agent": "sea_state", "status": "ok",
         "message": "wave_height 3.4m > 2.5m small-craft threshold"},
        {"seq": 3, "agent": "risk", "status": "ok",
         "message": "Threshold breached → NO_GO"},
    ],
    "map_layers": ["user_pin", "wave_heatmap", "eez_boundary"],
    "alerts": ["HIGH_WAVE"],
}


def test_report_example_validates():
    """The example from the report must always parse. If this fails, the contract moved."""
    # TODO(P1, C): OrcaResponse.model_validate(REPORT_EXAMPLE)
    pytest.skip("TODO(P1, C)")


def test_evidence_and_trace_default_to_empty_not_none():
    """Both are lists always — the frontend maps over them without a null check."""
    # TODO(P1, C)
    pytest.skip("TODO(P1, C)")


def test_trace_messages_matches_report_flat_shape():
    """trace_messages() must reproduce report §12's flat string array."""
    # TODO(P1, C)
    pytest.skip("TODO(P1, C)")


def test_location_rejects_out_of_range_coordinates():
    """lat 91 / lon 181 must fail validation, not silently pass to shapely."""
    # TODO(P1, C)
    pytest.skip("TODO(P1, C)")


def test_enums_match_frontend_types():
    """Guard against drift with frontend/src/types/orca.ts.

    Parse the TS file's union literals and compare to the Python enums. Crude, but it
    catches the exact failure that costs a whole afternoon of debugging.
    """
    # TODO(P2, C)
    pytest.skip("TODO(P2, C)")
