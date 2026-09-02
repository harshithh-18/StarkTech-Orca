"""Contract tests.

Owner: C · Phase: P1

These matter more than they look. The schema is the coordination point between four people
working in parallel — if it drifts, everyone's day is wasted. The most important test here
is that the implementation report's §12 example still validates.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from app.schemas.enums import (
    AlertType,
    Intent,
    Language,
    MapLayer,
    TraceStatus,
    Verdict,
)
from app.schemas.response import Location, OrcaResponse
from pydantic import ValidationError

TS_TYPES = Path(__file__).resolve().parents[2] / "frontend" / "src" / "types" / "orca.ts"

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
    response = OrcaResponse.model_validate(REPORT_EXAMPLE)

    assert response.verdict is Verdict.NO_GO
    assert response.language is Language.TELUGU
    assert response.intent is Intent.SAFETY_CHECK
    assert len(response.evidence) == 2
    assert len(response.reasoning_trace) == 4
    assert response.location is not None and response.location.name == "Kakinada"


def test_evidence_and_trace_default_to_empty_not_none():
    """Both are lists always — the frontend maps over them without a null check."""
    minimal = OrcaResponse(
        query="q",
        session_id="s",
        language=Language.ENGLISH,
        intent=Intent.GENERAL,
        answer="a",
    )

    assert minimal.evidence == []
    assert minimal.reasoning_trace == []
    assert minimal.map_layers == []
    assert minimal.alerts == []
    assert minimal.charts == []
    assert minimal.attribution == []
    for field in ("evidence", "reasoning_trace", "map_layers", "alerts", "charts"):
        assert getattr(minimal, field) is not None


def test_trace_messages_matches_report_flat_shape():
    """trace_messages() must reproduce report §12's flat string array."""
    response = OrcaResponse.model_validate(REPORT_EXAMPLE)
    messages = response.trace_messages()

    assert messages == [step["message"] for step in REPORT_EXAMPLE["reasoning_trace"]]
    assert all(isinstance(m, str) for m in messages)


def test_location_rejects_out_of_range_coordinates():
    """lat 91 / lon 181 must fail validation, not silently pass to shapely."""
    with pytest.raises(ValidationError):
        Location(lat=91.0, lon=82.0)
    with pytest.raises(ValidationError):
        Location(lat=17.0, lon=181.0)
    with pytest.raises(ValidationError):
        Location(lat=-91.0, lon=0.0)

    # The boundaries themselves are legal.
    assert Location(lat=90.0, lon=180.0).lat == 90.0


def test_verdict_is_optional_but_evidence_is_not():
    """Non-safety intents carry no verdict; every answer still carries an evidence list."""
    response = OrcaResponse(
        query="where are the fish?",
        session_id="s",
        language=Language.ENGLISH,
        intent=Intent.PFZ_LOOKUP,
        answer="…",
    )
    assert response.verdict is None
    assert response.evidence == []


def _ts_union_members(source: str, type_name: str) -> set[str]:
    """Pull the string-literal members of a TS union type out of the mirror file."""
    match = re.search(rf"export type {type_name}\s*=\s*(.*?);", source, re.DOTALL)
    if match is None:
        return set()
    return set(re.findall(r'"([^"]+)"', match.group(1)))


def test_enums_match_frontend_types():
    """Guard against drift with frontend/src/types/orca.ts.

    Parse the TS file's union literals and compare to the Python enums. Crude, but it
    catches the exact failure that costs a whole afternoon of debugging.
    """
    assert TS_TYPES.exists(), f"the TypeScript mirror is missing at {TS_TYPES}"
    source = TS_TYPES.read_text(encoding="utf-8")

    for type_name, enum in [
        ("Intent", Intent),
        ("Verdict", Verdict),
        ("AlertType", AlertType),
        ("MapLayer", MapLayer),
        ("Language", Language),
        ("TraceStatus", TraceStatus),
    ]:
        ts_members = _ts_union_members(source, type_name)
        py_members = {member.value for member in enum}
        assert ts_members, f"could not parse the TS union for {type_name}"
        assert ts_members == py_members, (
            f"{type_name} has drifted between Python and TypeScript.\n"
            f"  only in Python: {sorted(py_members - ts_members)}\n"
            f"  only in TS:     {sorted(ts_members - py_members)}\n"
            f"Update backend/app/schemas/enums.py, frontend/src/types/orca.ts and "
            f"docs/API_CONTRACT.md together."
        )


def test_generated_at_is_timezone_aware():
    """The contract says UTC ISO 8601; a naive datetime serialises ambiguously."""
    response = OrcaResponse(
        query="q", session_id="s", language=Language.ENGLISH,
        intent=Intent.GENERAL, answer="a",
    )
    assert response.generated_at.tzinfo is not None
