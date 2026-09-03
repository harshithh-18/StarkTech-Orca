"""Departure-window tests.

Owner: C (with E) · Phase: P4

Second only to ``test_risk_rules`` in consequence. These decide when a boat is told it may
leave harbour, and the failure mode is not an ugly screen — it is someone putting to sea in
a gap the code invented.

Three properties matter and each is pinned below:

  1. a window contains **no** breaching hour — not "mostly safe", none
  2. a window is at least ``MIN_WINDOW_HOURS`` long, or it is not offered
  3. what the code calls safe agrees with ``risk_rules``, because both call the same
     ``breaches()`` — a divergence here is the bug that would be hardest to spot
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.services import risk_rules, safe_window
from app.services.safe_window import find_windows, next_window, score_hours


def hours(count: int, start: datetime | None = None) -> list[str]:
    """`count` consecutive hourly ISO stamps, from `start` (default: now, on the hour)."""
    origin = start or datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return [(origin + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(count)]


# ── Scoring ───────────────────────────────────────────────────────────────


def test_calm_hours_all_score_go():
    times = hours(6)
    scored = score_hours(times, {"wave_height": [0.5] * 6, "wind_gusts_10m": [15.0] * 6})
    assert [hour["band"] for hour in scored] == ["go"] * 6
    assert all(hour["reasons"] == [] for hour in scored)


def test_an_hour_past_the_no_go_threshold_scores_no_go():
    scored = score_hours(hours(3), {"wave_height": [0.5, 3.0, 0.5]})
    assert [hour["band"] for hour in scored] == ["go", "no_go", "go"]
    assert "wave height" in scored[1]["reasons"][0]


def test_an_hour_with_no_readings_scores_unknown_not_safe():
    """None, not 'go'. Absence of evidence is not evidence of safety."""
    scored = score_hours(hours(3), {"wave_height": [0.5, None, 0.5]})
    assert scored[1]["band"] is None


def test_fields_without_a_threshold_are_ignored_entirely():
    """Sea temperature has no limit, so a hot hour is not a dangerous hour."""
    scored = score_hours(hours(2), {"sea_surface_temperature": [31.0, 32.0]})
    assert [hour["band"] for hour in scored] == [None, None]


def test_visibility_is_scored_as_lower_is_worse():
    scored = score_hours(hours(2), {"visibility": [20000.0, 300.0]})
    assert [hour["band"] for hour in scored] == ["go", "no_go"]


# ── Grouping ──────────────────────────────────────────────────────────────


def test_a_window_never_contains_a_breaching_hour():
    times = hours(12)
    waves = [0.5] * 5 + [3.0] + [0.5] * 6  # one gale hour in the middle
    windows = find_windows(score_hours(times, {"wave_height": waves}))

    assert len(windows) == 2
    for window in windows:
        start = times.index(window["start"])
        end = times.index(window["end"])
        assert all(waves[i] < risk_rules.THRESHOLDS["wave_height"]["caution"]
                   for i in range(start, end + 1))


def test_a_gap_shorter_than_the_minimum_is_not_a_window():
    """Two hours between two gales is not an opportunity; it is how people get caught."""
    times = hours(10)
    waves = [3.0] * 4 + [0.5, 0.5] + [3.0] * 4
    assert find_windows(score_hours(times, {"wave_height": waves})) == []


def test_a_run_exactly_at_the_minimum_is_a_window():
    times = hours(10)
    waves = [3.0] * 3 + [0.5] * safe_window.MIN_WINDOW_HOURS + [3.0] * 3
    windows = find_windows(score_hours(times, {"wave_height": waves}))
    assert len(windows) == 1
    assert windows[0]["hours"] == safe_window.MIN_WINDOW_HOURS


def test_unknown_hours_break_a_window():
    """A run either side of a data gap is two windows, not one long one."""
    times = hours(12)
    waves = [0.5] * 5 + [None] + [0.5] * 6
    windows = find_windows(score_hours(times, {"wave_height": waves}))
    assert len(windows) == 2


def test_caution_hours_are_excluded_by_default_and_included_on_request():
    times = hours(8)
    # 1.8 m is over the 1.5 m caution limit but under the 2.5 m no-go limit.
    waves = [0.5] * 4 + [1.8] * 4
    scored = score_hours(times, {"wave_height": waves})

    clear = find_windows(scored, include_caution=False)
    workable = find_windows(scored, include_caution=True)

    assert len(clear) == 1 and clear[0]["hours"] == 4
    assert len(workable) == 1 and workable[0]["hours"] == 8
    assert workable[0]["quality"] == "workable"
    assert clear[0]["quality"] == "clear"


# ── The headline answer ───────────────────────────────────────────────────


def test_next_window_prefers_a_clear_window_over_a_workable_one():
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    times = hours(16, now)
    waves = [1.8] * 8 + [0.5] * 8  # workable first, clear after

    result = next_window(times, {"wave_height": waves}, now)
    assert result["next"]["quality"] == "clear"


def test_next_window_falls_back_to_workable_when_nothing_is_clear():
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    times = hours(12, now)

    result = next_window(times, {"wave_height": [1.8] * 12}, now)
    assert result["next"]["quality"] == "workable"


def test_no_window_at_all_is_reported_as_none_not_as_a_guess():
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    times = hours(12, now)

    result = next_window(times, {"wave_height": [4.0] * 12}, now)
    assert result["next"] is None
    assert result["windows"] == []
    assert "no window" in safe_window.summarise(result)


def test_blocked_by_names_the_condition_keeping_the_boat_in_harbour():
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    times = hours(12, now)
    waves = [4.0] * 4 + [0.5] * 8

    result = next_window(times, {"wave_height": waves}, now)
    assert result["blocked_by"], "a blocked departure must say what is blocking it"
    assert "wave height" in result["blocked_by"][0]


def test_hours_beyond_the_decision_horizon_are_not_offered():
    """A 16-day marine forecast must not produce a 'safe window' nine days out."""
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    times = hours(24 * 10, now)
    # Rough for the whole decision horizon, calm only well beyond it.
    waves = [4.0] * (safe_window.MAX_LOOKAHEAD_HOURS + 2) + [0.5] * (
        24 * 10 - safe_window.MAX_LOOKAHEAD_HOURS - 2
    )

    result = next_window(times, {"wave_height": waves}, now)
    assert result["next"] is None
    assert result["horizon_hours"] <= safe_window.MAX_LOOKAHEAD_HOURS + 2


def test_windows_agree_with_the_risk_rules_that_produce_the_verdict():
    """The property that matters most: one source of truth for 'is this hour safe'.

    Scored independently here against ``risk_rules.breaches``. If ``safe_window`` ever
    grew its own thresholds, this is the test that would catch it.
    """
    times = hours(48)
    waves = [0.4 + (i % 9) * 0.35 for i in range(48)]
    gusts = [10.0 + (i % 7) * 8.0 for i in range(48)]

    windows = find_windows(
        score_hours(times, {"wave_height": waves, "wind_gusts_10m": gusts})
    )

    for window in windows:
        start = times.index(window["start"])
        end = times.index(window["end"])
        for i in range(start, end + 1):
            assert risk_rules.breaches("wave_height", waves[i]) is None
            assert risk_rules.breaches("wind_gusts_10m", gusts[i]) is None
