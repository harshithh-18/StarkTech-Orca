"""When is it next safe to sail?

Owner: E · Phase: P4

``risk_rules`` answers "is it safe *now*". That is the question the user asked, but it is
rarely the question they need answered: told NO_GO at 04:00, a fisherman's next words are
always *"then when?"*. This module answers that, over the same thresholds and with the
same arithmetic, so a window it reports can never disagree with the verdict.

The method, deliberately boring:

  1. take the hourly wave / wind / gust / CAPE / visibility series for the location
  2. score **every hour independently** with ``risk_rules.breaches``
  3. group the runs of consecutive GO hours
  4. return the runs that are long enough to be a fishing trip

No LLM, no smoothing, no interpolation. An hour that breaches a threshold is out, and a
window is a maximal run of hours that don't. That makes the output trivially checkable
against the same chart the user is looking at — which is the point of an explainable
system.

## What "long enough" means

``MIN_WINDOW_HOURS = 4``. A two-hour gap between two gales is not an opportunity; it is
how people get caught out. Four hours is short enough to catch a genuine morning lull on
this coast and long enough to be worth launching for.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.services.risk_rules import LOWER_IS_WORSE, THRESHOLDS

logger = logging.getLogger(__name__)

MIN_WINDOW_HOURS = 4
"""Shorter than this is not a window, it is a gap between two hazards."""

MAX_LOOKAHEAD_HOURS = 72
"""Beyond three days the forecast is not decision-grade, and saying so is more useful
than offering a window nobody should plan around."""

# Which hourly series feeds which threshold. Wave and swell come from the marine model,
# the rest from the weather model — both are keyed by the same field names the thresholds
# use, so there is no translation layer to get wrong.
MARINE_SERIES = ("wave_height", "swell_wave_height")
WEATHER_SERIES = ("wind_speed_10m", "wind_gusts_10m", "cape", "visibility")


class Window(dict):
    """A run of consecutive safe hours. A dict so it serialises without a schema change."""


def _worst_band(field: str, value: float) -> str | None:
    """'no_go' | 'caution' | None for one reading — the same call risk_rules makes."""
    from app.services.risk_rules import breaches

    return breaches(field, value)


def score_hours(
    times: list[str],
    series: dict[str, list[float | None]],
) -> list[dict]:
    """Score each hour: ``{"time", "band", "reasons"}`` with band in go/caution/no_go.

    ``series`` maps a threshold field name to a list aligned with ``times``. Fields with
    no threshold are ignored rather than silently treated as safe, and an hour where every
    series is null scores ``None`` — unknown is not the same as safe, and the caller
    excludes unknown hours from windows.
    """
    scored: list[dict] = []

    for index, stamp in enumerate(times):
        band = "go"
        reasons: list[str] = []
        seen_any = False

        for field, values in series.items():
            if field not in THRESHOLDS or index >= len(values):
                continue
            value = values[index]
            if value is None:
                continue
            seen_any = True

            hit = _worst_band(field, float(value))
            if hit is None:
                continue
            limits = THRESHOLDS[field]
            comparator = "below" if field in LOWER_IS_WORSE else "over"
            reasons.append(
                f"{field.replace('_10m', '').replace('_', ' ')} "
                f"{float(value):g} {limits['unit']} {comparator} "
                f"{limits[hit]:g} {limits['unit']}"
            )
            if hit == "no_go":
                band = "no_go"
            elif band != "no_go":
                band = "caution"

        scored.append(
            {"time": stamp, "band": band if seen_any else None, "reasons": reasons}
        )

    return scored


def find_windows(
    scored: list[dict],
    include_caution: bool = False,
    min_hours: int = MIN_WINDOW_HOURS,
) -> list[Window]:
    """Maximal runs of safe hours, longest-first among those that start soonest.

    ``include_caution`` widens the definition from "clear" to "workable". It is off by
    default: a window offered to someone about to put to sea should mean all conditions
    are inside the limits, not that they are merely survivable. The conditions endpoint
    asks for both and labels them differently.
    """
    acceptable = {"go", "caution"} if include_caution else {"go"}

    windows: list[Window] = []
    run_start: int | None = None

    def close_run(start: int, end_exclusive: int) -> None:
        length = end_exclusive - start
        if length < min_hours:
            return
        bands = {scored[i]["band"] for i in range(start, end_exclusive)}
        windows.append(
            Window(
                start=scored[start]["time"],
                end=scored[end_exclusive - 1]["time"],
                hours=length,
                quality="clear" if bands == {"go"} else "workable",
            )
        )

    for index, hour in enumerate(scored):
        if hour["band"] in acceptable:
            if run_start is None:
                run_start = index
        elif run_start is not None:
            close_run(run_start, index)
            run_start = None

    if run_start is not None:
        close_run(run_start, len(scored))

    return windows


def next_window(
    times: list[str],
    series: dict[str, list[float | None]],
    now: datetime | None = None,
) -> dict:
    """The headline answer: the next safe window, and why the hours before it are not.

    Returns ``{"next": Window | None, "windows": [...], "blocked_by": [str], "horizon_hours"}``.

    ``blocked_by`` names the conditions keeping the boat in harbour *right now*, which is
    what turns "wait until 14:00" into something the user can sanity-check against the
    forecast chart in front of them.
    """
    from app.adapters.base import parse_hour

    reference = now or datetime.now(timezone.utc)
    horizon = reference + timedelta(hours=MAX_LOOKAHEAD_HOURS)

    # Trim to the decision horizon before scoring, so a 16-day marine forecast doesn't
    # offer a "safe window" nine days out that nobody should act on.
    keep: list[int] = []
    for index, stamp in enumerate(times):
        try:
            hour = parse_hour(stamp)
        except (ValueError, AttributeError):
            continue
        if reference - timedelta(hours=1) <= hour <= horizon:
            keep.append(index)

    if not keep:
        return {"next": None, "windows": [], "blocked_by": [], "horizon_hours": 0}

    trimmed_times = [times[i] for i in keep]
    trimmed_series = {
        field: [values[i] if i < len(values) else None for i in keep]
        for field, values in series.items()
    }

    scored = score_hours(trimmed_times, trimmed_series)
    clear = find_windows(scored, include_caution=False)
    workable = find_windows(scored, include_caution=True)

    # Prefer a clear window; offer a workable one only when there is no clear one inside
    # the horizon, and label it so the difference is visible rather than implied.
    chosen = clear[0] if clear else (workable[0] if workable else None)

    blocked_by: list[str] = []
    if scored and scored[0]["band"] not in (None, "go"):
        blocked_by = scored[0]["reasons"]

    return {
        "next": chosen,
        "windows": (clear or workable)[:4],
        "blocked_by": blocked_by,
        "horizon_hours": len(trimmed_times),
    }


def summarise(result: dict) -> str:
    """One English sentence for the trace and for the answer text.

    English only, like every other trace message; ``services.explainability`` translates
    it if the answer is going out in another language.
    """
    window = result.get("next")
    if window is None:
        return (
            f"no window of {MIN_WINDOW_HOURS}+ safe hours in the next "
            f"{result.get('horizon_hours', 0)} hours of forecast"
        )

    from app.adapters.base import parse_hour

    try:
        start = parse_hour(window["start"])
        end = parse_hour(window["end"])
        when = f"{start:%a %d %b %H:%M}–{end:%H:%M} UTC"
    except (ValueError, KeyError, AttributeError):
        when = f"{window.get('start')}–{window.get('end')}"

    return f"next {window['quality']} window {when} ({window['hours']} h)"
