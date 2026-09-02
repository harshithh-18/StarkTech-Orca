"""Geofencing tests.

Owner: E (with C) · Phase: P1

These guard two defects found against real Marine Regions data on 2 Sep 2026, both of
which are the kind that erode trust in a safety product:

  1. **False breach alarms.** "Outside the EEZ" was treated as a breach, so a query from
     Kakinada — a home harbour — raised GEOFENCE_BREACH, as did any point in lawful
     international waters. An alert that cries wolf at the quayside teaches the user to
     ignore the one that matters.

  2. **A softened warning.** Asked to phrase a result 2.3 km from the Sri Lanka maritime
     boundary, the LLM deleted the warning and returned neutral distances — and in an
     earlier run volunteered "Continue your current course", advice nobody computed, in
     precisely the situation where fishermen get detained.
"""

from __future__ import annotations

import pytest
from app.agents.geospatial import (
    compass_point,
    derive_geofence_alerts,
    describe_offset,
    distance_and_bearing,
)
from app.schemas.enums import AlertType, Intent, Language
from app.schemas.response import Evidence, Location

SOURCE = "Maritime boundaries © Flanders Marine Institute (Marine Regions)"


def ev(field: str, value, unit: str | None = None) -> Evidence:
    return Evidence(field=field, value=value, unit=unit, source=SOURCE)


# ── What counts as a breach ───────────────────────────────────────────────


def test_outside_eez_is_not_a_breach():
    """Regression: this fired at Kakinada harbour.

    The EEZ polygon covers water, so a quayside point sits just outside it — and being in
    international waters is lawful for any vessel. Neither is a breach.
    """
    alerts = derive_geofence_alerts(
        [ev("inside_eez", False), ev("distance_to_eez", 4.0, "km"),
         ev("distance_to_imbl", 625.6, "km")]
    )
    assert alerts == [], f"a lawful position must raise no alert, got {alerts}"


def test_inside_eez_is_not_a_breach():
    """The normal, expected state for an Indian fishing boat."""
    alerts = derive_geofence_alerts(
        [ev("inside_eez", True), ev("distance_to_eez", 300.0, "km"),
         ev("distance_to_imbl", 400.0, "km")]
    )
    assert alerts == []


def test_near_imbl_raises_proximity():
    """The alert that actually matters — warn on approach, not after the crossing."""
    alerts = derive_geofence_alerts(
        [ev("inside_eez", True), ev("distance_to_imbl", 2.3, "km")]
    )
    assert AlertType.GEOFENCE_PROXIMITY in alerts


def test_far_from_imbl_raises_nothing():
    alerts = derive_geofence_alerts(
        [ev("inside_eez", True), ev("distance_to_imbl", 200.0, "km")]
    )
    assert alerts == []


def test_inside_mpa_is_a_breach():
    """A protected area is a genuine restricted zone."""
    alerts = derive_geofence_alerts(
        [ev("inside_mpa", True), ev("distance_to_mpa", 0.0, "km")]
    )
    assert AlertType.GEOFENCE_BREACH in alerts


def test_breach_supersedes_proximity():
    """Already inside a zone — 'you are approaching' would understate it."""
    alerts = derive_geofence_alerts(
        [ev("inside_mpa", True), ev("distance_to_mpa", 0.0, "km"),
         ev("distance_to_imbl", 3.0, "km")]
    )
    assert AlertType.GEOFENCE_BREACH in alerts
    assert AlertType.GEOFENCE_PROXIMITY not in alerts


# ── The warning text is not the model's to edit ───────────────────────────


@pytest.mark.asyncio
async def test_proximity_warning_survives_verbatim(monkeypatch):
    """The deterministic warning must reach the user unmodified.

    A warning a language model is free to rewrite is not a warning.
    """
    from app.services import explainability, llm

    # Any LLM call in this path would be a bug — fail loudly if one happens.
    async def explode(*args, **kwargs):
        raise AssertionError("the geofence warning path must not call the LLM in English")

    monkeypatch.setattr(llm, "complete", explode)

    warning = (
        "WARNING — you are only 2.3 km from an international maritime boundary. "
        "Crossing it without authorisation can result in detention by the neighbouring "
        "coast guard. Turn back toward Indian waters."
    )
    state = {
        "language": Language.ENGLISH,
        "intent": Intent.GEOFENCE_CHECK,
        "alerts": [AlertType.GEOFENCE_PROXIMITY],
        "geofence": {"summary": warning},
        "evidence": [ev("distance_to_imbl", 2.3, "km")],
    }

    answer = await explainability.write_answer(state)

    assert answer == warning
    assert "2.3 km" in answer, "the distance must survive exactly"
    for softener in ("stay on course", "proceed", "continue your current course"):
        assert softener not in answer.casefold()


@pytest.mark.asyncio
async def test_warning_falls_back_to_english_if_translation_fails(monkeypatch):
    """An English warning the user can still read beats a lost one.

    The provider is stubbed out rather than left to the environment: a developer with
    real keys in .env would otherwise make this test hit the network and translate for
    real, which is both flaky and not what is being asserted.
    """
    from app.services import explainability, llm

    async def rate_limited(*args, **kwargs):
        raise llm.LLMUnavailable("429 quota exceeded")

    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(llm, "complete", rate_limited)

    warning = "WARNING — you are only 2.3 km from an international maritime boundary."
    assert await explainability.translate_only(warning, "ta") == warning


@pytest.mark.asyncio
async def test_warning_translation_keeps_the_number(monkeypatch):
    """A translated warning must still carry the distance verbatim."""
    from app.services import explainability, llm

    async def fake_translate(text, system=None, **kwargs):
        assert "SAFETY WARNING" in (system or ""), "the strict prompt must be used"
        return "எச்சரிக்கை — 2.3 km தொலைவில் சர்வதேச கடல் எல்லை."

    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(llm, "complete", fake_translate)

    out = await explainability.translate_only(
        "WARNING — you are only 2.3 km from an international maritime boundary.", "ta"
    )
    assert "2.3 km" in out


# ── Geodesy ───────────────────────────────────────────────────────────────


def test_distance_to_sri_lanka_boundary_is_geodesic():
    """Palk Strait is narrow; euclidean error here is the difference between
    fishing legally and being detained."""
    kakinada = Location(lat=16.99, lon=82.24)
    palk = Location(lat=9.30, lon=79.50)

    distance_km, bearing = distance_and_bearing(kakinada, palk)

    # ~890 km along the coast, bearing roughly south-southwest.
    assert 800 < distance_km < 950, f"got {distance_km} km"
    assert 190 < bearing < 220, f"got bearing {bearing}"
    assert compass_point(bearing) in {"S", "SSW", "SW"}


def test_offset_is_described_in_words_not_degrees():
    """A fisherman reads 'north-east', not '045°'."""
    text = describe_offset(38.2, 45.0)
    assert "38 km" in text
    assert "north-east" in text
    assert "°" not in text
