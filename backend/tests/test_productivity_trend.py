"""Productivity trend tests — golden query #4.

Owner: E (with A) · Phase: P2

The narrative here is the one a judge is most likely to interrogate, because it is the
only answer that makes a scientific claim rather than reporting a measurement. Two things
must hold: it never overclaims, and it never bends to the premise of the question.

Synthetic series only — no Copernicus subset needed to run these.
"""

from __future__ import annotations

import numpy as np
from app.agents import marine_data
from app.agents.visualization import build_charts
from app.schemas.enums import ChartKind, Intent
from app.schemas.response import ChartPoint, ChartSeries, ChartSpec, Evidence, Location

KAKINADA = Location(lat=16.99, lon=82.24, name="Kakinada")


def ev(field: str, value, unit: str | None = None) -> Evidence:
    return Evidence(field=field, value=value, unit=unit, source="Copernicus Marine (test)",
                    location=KAKINADA)


def trend_evidence(change_pct: float, sst_change: float = 0.0) -> list[Evidence]:
    baseline = 1.0
    recent = baseline * (1 + change_pct / 100)
    return [
        ev("chlorophyll_recent_mean", round(recent, 3), "mg/m³"),
        ev("chlorophyll_baseline_mean", baseline, "mg/m³"),
        ev("chlorophyll_change_pct", change_pct, "%"),
        ev("sst_change", sst_change, "°C"),
    ]


# ── The narrative ─────────────────────────────────────────────────────────


def test_reports_a_real_decline():
    text = marine_data.describe_trend(trend_evidence(-40.0), KAKINADA)
    assert "fallen 40%" in text
    assert "food chain" in text or "feed" in text


def test_contradicts_the_premise_when_productivity_rose():
    """The user asks "why has productivity declined?" — if it did not, say so.

    Confabulating a decline to match the question is the single most likely way this
    answer becomes wrong, and it is the failure a domain expert would spot instantly.
    """
    text = marine_data.describe_trend(trend_evidence(+160.0), KAKINADA)

    assert "risen" in text
    assert "improving, not declining" in text
    assert "fallen" not in text and "decline in productivity" not in text


def test_small_change_is_reported_as_no_change():
    """Below the noise floor of a short satellite window, a 'trend' is an artefact."""
    text = marine_data.describe_trend(trend_evidence(-4.0), KAKINADA)
    assert "unchanged" in text
    assert "no measurable decline" in text


def test_never_claims_causation_from_correlation():
    """SST may be mentioned as correlated; asserting it caused the drop is overclaiming."""
    text = marine_data.describe_trend(trend_evidence(-45.0, sst_change=1.2), KAKINADA)

    assert "correlation, not cause" in text
    for overclaim in ("because of", "caused by", "due to the warming", "is causing"):
        assert overclaim not in text.casefold(), f"overclaimed with {overclaim!r}"


def test_states_which_baseline_was_used():
    """It compares against the preceding weeks, NOT a climatological normal.

    Calling this an 'anomaly' would be wrong — the analysis-forecast product has no
    multi-year history — and an oceanographer on the panel would know.
    """
    text = marine_data.describe_trend(trend_evidence(-30.0), KAKINADA)
    assert "not against a multi-year seasonal normal" in text


def test_missing_numbers_degrade_honestly():
    text = marine_data.describe_trend([], KAKINADA)
    assert "could not measure" in text.casefold()


# ── Slope ─────────────────────────────────────────────────────────────────


def test_linear_slope_detects_direction():
    rising = marine_data._linear_slope(np.linspace(0.5, 1.5, 30))
    falling = marine_data._linear_slope(np.linspace(1.5, 0.5, 30))

    assert rising > 0 and falling < 0
    assert abs(rising + falling) < 1e-9, "a mirrored series must give a mirrored slope"


def test_linear_slope_ignores_nan_gaps():
    """Cloud cover blanks days; a gap must not be read as a crash to zero."""
    series = np.linspace(1.0, 2.0, 20)
    series[5:9] = np.nan

    assert marine_data._linear_slope(series) > 0


def test_linear_slope_gives_up_on_sparse_data():
    assert marine_data._linear_slope([np.nan, np.nan, 1.0]) == 0.0


# ── Chart relevance ───────────────────────────────────────────────────────


def _chart(chart_id: str) -> ChartSpec:
    return ChartSpec(
        id=chart_id, title=chart_id, kind=ChartKind.LINE,
        series=[ChartSeries(name="s", points=[ChartPoint(x="2026-09-01T00:00", y=1.0)])],
    )


def test_wave_chart_is_dropped_from_a_productivity_answer():
    """The planner may over-dispatch; a 48-hour wave chart under "why has productivity
    declined?" is a non-sequitur on screen."""
    charts = build_charts(
        {
            "intent": Intent.DIAGNOSTIC,
            "sea_state": {"charts": [_chart("wave_48h")]},
            "marine": {"charts": [_chart("chlorophyll_trend")]},
        }
    )
    assert [c.id for c in charts] == ["chlorophyll_trend"]


def test_safety_answer_keeps_its_wave_chart():
    charts = build_charts(
        {"intent": Intent.SAFETY_CHECK, "sea_state": {"charts": [_chart("wave_48h")]}}
    )
    assert [c.id for c in charts] == ["wave_48h"]


def test_all_null_series_is_not_rendered():
    """An empty frame reads as a broken chart, not as missing data."""
    blank = ChartSpec(
        id="chlorophyll_trend", title="t", kind=ChartKind.LINE,
        series=[ChartSeries(name="s", points=[ChartPoint(x="2026-09-01T00:00", y=None)])],
    )
    assert build_charts({"intent": Intent.DIAGNOSTIC, "marine": {"charts": [blank]}}) == []
