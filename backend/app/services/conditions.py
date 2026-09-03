"""The now-cast: conditions at a point, without anyone having to ask a question.

Owner: B · Phase: P4

Every other path through ORCA starts with a question. This one doesn't. The user picks a
harbour and the platform tells them, unprompted, what the sea is doing there — wave, wind,
gusts, tide, water temperature, visibility, storm energy — plus the safety verdict, the
next safe departure window, and which boundary they are nearest.

That covers the problem statement's *"what are the tide, weather and sea conditions near my
fishing location?"* without a conversational turn, and it gives the interface something
true to show before the first message is typed.

## Why this is a service and not an agent

It runs no planner and makes no choices: it is a fixed bundle of the same adapters the
specialists use, reduced through the same ``risk_rules``. Routing it through the graph
would add a language-detection round trip and a fan-out decision to a request that has no
language and no decision. Same data, same thresholds, no reasoning — so it lives here.

The verdict it reports is computed by ``risk_rules.evaluate``, byte for byte the function
the safety agent uses. If the dashboard and the chat answer ever disagreed, the dashboard
would be worse than useless; sharing the function is what stops that being possible.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.adapters import open_meteo_marine, open_meteo_weather
from app.adapters.base import LocationNotAtSea, parse_hour
from app.agents.geospatial import compass_word
from app.schemas.conditions import (
    ConditionsSnapshot,
    ConditionTile,
    NearestCoast,
    TideSummary,
)
from app.schemas.enums import AlertType, ChartKind, Verdict
from app.schemas.response import ChartPoint, ChartSeries, ChartSpec, Evidence, Location
from app.services import risk_rules, safe_window

logger = logging.getLogger(__name__)

# The tiles, in reading order. Wave first because it decides more verdicts than anything
# else; tide last because it is context rather than a hazard.
TILES: list[dict] = [
    {"field": "wave_height", "label": "Wave height", "icon": "wave", "source": "marine"},
    {"field": "wind_speed_10m", "label": "Wind", "icon": "wind", "source": "weather"},
    {"field": "wind_gusts_10m", "label": "Gusts", "icon": "gust", "source": "weather"},
    {"field": "swell_wave_height", "label": "Swell", "icon": "swell", "source": "marine"},
    {
        "field": "sea_surface_temperature",
        "label": "Sea temperature",
        "icon": "temperature",
        "source": "marine",
    },
    {"field": "visibility", "label": "Visibility", "icon": "visibility", "source": "weather"},
    {"field": "cape", "label": "Storm energy", "icon": "storm", "source": "weather"},
    {
        "field": "sea_level_height_msl",
        "label": "Tide",
        "icon": "tide",
        "source": "marine",
    },
]

# How far ahead the "now" reading may be taken from. Open-Meteo publishes on the hour, so
# the current hour is always within this; a gap larger than it means the forecast does not
# actually cover now and the tile should say so rather than show a stale number.
NOW_TOLERANCE_HOURS = 3


def _nearest_hour_index(times: list[str], target: datetime) -> int | None:
    """Index of the hourly slot closest to ``target``, or None if none is close enough."""
    best_index, best_gap = None, None
    for index, stamp in enumerate(times):
        try:
            gap = abs((parse_hour(stamp) - target).total_seconds())
        except (ValueError, AttributeError):
            continue
        if best_gap is None or gap < best_gap:
            best_index, best_gap = index, gap

    if best_gap is None or best_gap > NOW_TOLERANCE_HOURS * 3600:
        return None
    return best_index


def _band_for(field: str, value: float) -> str:
    """The colour the tile is painted: 'none' | 'go' | 'caution' | 'no_go'.

    Fields with no safety threshold — sea temperature, tide height — get ``'none'``, not
    ``'go'``. Painting the tide green would read as "the tide has been checked and is
    safe", which is not a claim anyone made: there is no tide threshold to check it
    against. Context is drawn as context.
    """
    if field not in risk_rules.THRESHOLDS:
        return "none"
    return risk_rules.breaches(field, value) or "go"


async def _marine_series(lat: float, lon: float) -> dict:
    """Hourly marine series at the roughest sampled cell, plus the nearest-cell tide.

    The roughest cell, not the harbour cell, for the same reason the sea-state agent uses
    it: the fishing ground is offshore and the harbour wall is always calmer than the
    place the boat is going. The tide is taken from the *nearest* cell instead, because
    tide is about the harbour bar, not the fishing ground.
    """
    cells = await open_meteo_marine.fetch_area(lat, lon, forecast_days=3)
    if not cells:
        # The typed exception, not a generic AdapterError: `snapshot` distinguishes "there
        # is no sea here" from "the sea model is down" and answers them differently.
        raise LocationNotAtSea(
            f"there is no sea within {open_meteo_marine.SAMPLE_RADIUS_KM:.0f} km of this "
            f"location"
        )

    def peak_of(cell: dict) -> float:
        values = [v for v in (cell.get("hourly", {}).get("wave_height") or []) if v is not None]
        return max(values) if values else 0.0

    roughest = max(cells, key=peak_of)
    nearest = min(
        cells,
        key=lambda c: (c.get("latitude", lat) - lat) ** 2 + (c.get("longitude", lon) - lon) ** 2,
    )
    return {"roughest": roughest, "nearest": nearest}


def _tide_summary(hourly: dict, cell: dict, now: datetime) -> TideSummary | None:
    """Next high and low water from the hourly sea-level series."""
    times = hourly.get("time") or []
    heights = hourly.get(open_meteo_marine.TIDE_FIELD) or []
    if not any(h is not None for h in heights):
        return None

    next_high: dict | None = None
    next_low: dict | None = None
    for i in range(1, len(heights) - 1):
        previous, current, following = heights[i - 1], heights[i], heights[i + 1]
        if previous is None or current is None or following is None:
            continue
        try:
            when = parse_hour(times[i])
        except (ValueError, IndexError, AttributeError):
            continue
        if when < now:
            continue

        is_high = current >= previous and current >= following and current > min(previous, following)
        is_low = current <= previous and current <= following and current < max(previous, following)
        if is_high and next_high is None:
            next_high = {"time": when, "height": round(current, 2)}
        elif is_low and next_low is None:
            next_low = {"time": when, "height": round(current, 2)}
        if next_high and next_low:
            break

    known = [h for h in heights if h is not None]
    return TideSummary(
        next_high_time=next_high["time"] if next_high else None,
        next_high_m=next_high["height"] if next_high else None,
        next_low_time=next_low["time"] if next_low else None,
        next_low_m=next_low["height"] if next_low else None,
        range_m=round(max(known) - min(known), 2) if known else None,
        state=_tide_state(next_high, next_low),
        source=f"Open-Meteo Marine (modelled sea level) at "
        f"{cell.get('latitude', 0):.2f},{cell.get('longitude', 0):.2f}",
    )


def _tide_state(next_high: dict | None, next_low: dict | None) -> str:
    """'rising' | 'falling' | 'unknown' — whichever turning point comes first tells us."""
    if next_high and next_low:
        return "rising" if next_high["time"] < next_low["time"] else "falling"
    if next_high:
        return "rising"
    if next_low:
        return "falling"
    return "unknown"


def _chart(chart_id: str, title: str, y_label: str, unit: str, times, values, kind=ChartKind.LINE) -> ChartSpec | None:
    """Build a chart spec, or None when the series is entirely null."""
    points = [
        ChartPoint(x=t, y=float(v) if v is not None else None)
        for t, v in zip(times[:48], values[:48])
    ]
    if not any(p.y is not None for p in points):
        return None
    return ChartSpec(
        id=chart_id,
        title=title,
        kind=kind,
        x_label="Time (UTC)",
        y_label=y_label,
        series=[ChartSeries(name=title, unit=unit, points=points)],
    )


async def snapshot(location: Location, now: datetime | None = None) -> ConditionsSnapshot:
    """Everything true about the sea at one point, right now.

    Both upstream models are fetched concurrently and **either may fail without failing the
    snapshot**: the tiles that model backs are simply absent, and ``degraded`` names what is
    missing. The same degradation rule the agents follow — an offline weather model costs
    the user the wind tiles, not the page.
    """
    reference = now or datetime.now(timezone.utc)

    marine_task = asyncio.create_task(_marine_series(location.lat, location.lon))
    weather_task = asyncio.create_task(
        open_meteo_weather.fetch(location.lat, location.lon, forecast_days=3)
    )
    marine_result, weather_result = await asyncio.gather(
        marine_task, weather_task, return_exceptions=True
    )

    degraded: list[str] = []

    marine_hourly: dict = {}
    tide_hourly: dict = {}
    marine_cell: dict = {}
    tide_cell: dict = {}
    coastal = True
    if isinstance(marine_result, LocationNotAtSea):
        # Not a degraded snapshot — a different question. There is no sea here, so there
        # is nothing to be cautious about, and reporting CAUTION would imply there is a
        # rough sea nearby that we failed to read.
        logger.info("conditions: %.3f,%.3f has no sea within range", location.lat, location.lon)
        coastal = False
    elif isinstance(marine_result, BaseException):
        logger.info("conditions: marine unavailable (%s)", marine_result)
        degraded.append(f"sea state unavailable: {marine_result}")
    else:
        marine_cell = marine_result["roughest"]
        tide_cell = marine_result["nearest"]
        marine_hourly = marine_cell.get("hourly") or {}
        tide_hourly = tide_cell.get("hourly") or {}

    weather_hourly: dict = {}
    if isinstance(weather_result, BaseException):
        logger.info("conditions: weather unavailable (%s)", weather_result)
        degraded.append(f"weather unavailable: {weather_result}")
    else:
        weather_hourly = weather_result.get("hourly") or {}

    # ── Tiles ─────────────────────────────────────────────────────────────
    tiles: list[ConditionTile] = []
    evidence: list[Evidence] = []

    for spec in TILES:
        hourly = marine_hourly if spec["source"] == "marine" else weather_hourly
        # Tide reads from the nearest cell, everything marine from the roughest.
        if spec["field"] == open_meteo_marine.TIDE_FIELD:
            hourly = tide_hourly
        times = hourly.get("time") or []
        values = hourly.get(spec["field"]) or []
        index = _nearest_hour_index(times, reference) if times else None
        if index is None or index >= len(values) or values[index] is None:
            continue

        value = float(values[index])
        source = (
            open_meteo_weather.LIGHTNING_PROXY_SOURCE
            if spec["field"] == "cape"
            else (
                open_meteo_marine.SOURCE
                if spec["source"] == "marine"
                else open_meteo_weather.SOURCE
            )
        )
        unit = (
            open_meteo_marine.UNITS.get(spec["field"])
            if spec["source"] == "marine"
            else open_meteo_weather.UNITS.get(spec["field"])
        )

        # Peak over the next 24 h alongside the current reading: "1.1 m now, 2.6 m by
        # 18:00" is the fact that changes a decision, and a bare now-cast hides it.
        horizon_end = reference + timedelta(hours=24)
        peak_value, peak_time = None, None
        for i, stamp in enumerate(times):
            if i >= len(values) or values[i] is None:
                continue
            try:
                hour = parse_hour(stamp)
            except (ValueError, AttributeError):
                continue
            if not (reference <= hour <= horizon_end):
                continue
            candidate = float(values[i])
            if peak_value is None:
                peak_value, peak_time = candidate, hour
                continue
            worse = (
                candidate < peak_value
                if spec["field"] in risk_rules.LOWER_IS_WORSE
                else candidate > peak_value
            )
            if worse:
                peak_value, peak_time = candidate, hour

        tiles.append(
            ConditionTile(
                field=spec["field"],
                label=spec["label"],
                icon=spec["icon"],
                value=round(value, 2),
                unit=unit,
                band=_band_for(spec["field"], value),
                source=source,
                time=parse_hour(times[index]),
                peak_value=round(peak_value, 2) if peak_value is not None else None,
                peak_time=peak_time,
                peak_band=(
                    _band_for(spec["field"], peak_value)
                    if peak_value is not None
                    else "none"
                ),
                threshold=risk_rules.THRESHOLDS.get(spec["field"], {}).get("caution"),
            )
        )

        if spec["field"] in risk_rules.THRESHOLDS:
            # Only threshold-bearing fields become evidence: the verdict below is
            # ``risk_rules.evaluate`` over exactly this list, so anything else in it would
            # be decoration the user could not check.
            evidence.append(
                Evidence(
                    field=spec["field"],
                    value=round(peak_value if peak_value is not None else value, 2),
                    unit=unit,
                    source=source,
                    time=peak_time or parse_hour(times[index]),
                    location=Location(
                        lat=(marine_cell if spec["source"] == "marine" else {}).get(
                            "latitude", location.lat
                        ),
                        lon=(marine_cell if spec["source"] == "marine" else {}).get(
                            "longitude", location.lon
                        ),
                        source="forecast_grid_sample",
                    ),
                )
            )

    # ── Verdict ───────────────────────────────────────────────────────────
    alerts: list[AlertType] = []
    nearest_coast: NearestCoast | None = None

    if not coastal:
        # No sea, no verdict. Running the rules here would return CAUTION because the
        # sea-state agent is "missing" — a warning about a sea that is not there.
        from app.services import harbours

        harbour, distance_km, bearing = harbours.nearest(location)
        nearest_coast = NearestCoast(
            name=harbour.name,
            state=harbour.state,
            lat=harbour.lat,
            lon=harbour.lon,
            distance_km=round(distance_km, 0),
            bearing=compass_word(bearing),
        )
        verdict = Verdict.NOT_APPLICABLE
        reasons = [
            (
                f"{location.name or 'This location'} is inland. There is no sea within "
                f"{int(open_meteo_marine.SAMPLE_RADIUS_KM)} km of it, so there are no "
                f"waves, tides or sea conditions to report."
            ),
            (
                f"The nearest coast is {harbour.name} in {harbour.state}, about "
                f"{distance_km:.0f} km {compass_word(bearing)}."
            ),
        ]

        # The weather readings that did arrive are still true, and still worth showing —
        # but their bands are small-craft *marine* limits, and a green "Wind 12 km/h" tile
        # 280 km from the sea claims a boating safety check that nobody performed. The
        # numbers stay; the safety colouring does not.
        tiles = [tile.model_copy(update={"band": "none", "peak_band": "none"}) for tile in tiles]
        evidence = []
    else:
        skipped = []
        if not marine_hourly:
            skipped.append("sea_state")
        if not weather_hourly:
            skipped.append("weather")

        # Imported here rather than at module scope: the risk agent pulls in the LLM and
        # translation stacks, and the conditions endpoint needs neither.
        from app.agents import risk as risk_agent

        assessment = risk_agent.assess(evidence, skipped_agents=skipped)
        verdict = assessment["verdict"]
        reasons = assessment["reasons"][:3]
        alerts = list(assessment.get("alerts") or [])

    # ── Next safe departure window ────────────────────────────────────────
    combined_times = (marine_hourly.get("time") or weather_hourly.get("time") or [])
    series: dict[str, list] = {}
    for field in safe_window.MARINE_SERIES:
        if marine_hourly.get(field):
            series[field] = marine_hourly[field]
    for field in safe_window.WEATHER_SERIES:
        values = weather_hourly.get(field)
        if not values:
            continue
        # The two models are both hourly from the same start, but never assume it — align
        # on timestamps so a one-hour offset can't shift the wind series against the waves.
        series[field] = _align(
            weather_hourly.get("time") or [], values, combined_times
        )

    empty_window = {"next": None, "windows": [], "blocked_by": [], "horizon_hours": 0}

    # A "departure window" for a place with no sea is nonsense — it would be scored purely
    # on inland wind against a small-craft wave-and-swell rulebook, and would confidently
    # offer someone in Hyderabad a five-hour sailing window on Thursday morning.
    window = (
        safe_window.next_window(combined_times, series, reference)
        if coastal and combined_times and series
        else empty_window
    )

    # ── Charts ────────────────────────────────────────────────────────────
    charts: list[ChartSpec] = []
    if marine_hourly.get("time"):
        wave = _chart(
            "wave_48h",
            "Wave height, next 48 hours",
            "Wave height (m)",
            "m",
            marine_hourly["time"],
            marine_hourly.get("wave_height") or [],
        )
        if wave:
            charts.append(wave)
    if tide_hourly.get("time"):
        tide_chart = _chart(
            "tide",
            "Tide, next 48 hours",
            "Height above MSL (m)",
            "m",
            tide_hourly["time"],
            tide_hourly.get(open_meteo_marine.TIDE_FIELD) or [],
            kind=ChartKind.AREA,
        )
        if tide_chart:
            charts.append(tide_chart)
    if weather_hourly.get("time"):
        wind = _chart(
            "wind_48h",
            "Wind gusts, next 48 hours",
            "Gusts (km/h)",
            "km/h",
            weather_hourly["time"],
            weather_hourly.get("wind_gusts_10m") or [],
        )
        if wind:
            charts.append(wind)

    from app.adapters import base as adapter_base

    attribution = []
    if marine_hourly:
        attribution.append(open_meteo_marine.ATTRIBUTION)
    if weather_hourly and open_meteo_weather.ATTRIBUTION not in attribution:
        attribution.append(open_meteo_weather.ATTRIBUTION)

    return ConditionsSnapshot(
        location=location,
        observed_at=reference,
        tiles=tiles,
        verdict=verdict,
        reasons=reasons,
        alerts=alerts,
        coastal=coastal,
        nearest_coast=nearest_coast,
        tide=_tide_summary(tide_hourly, tide_cell, reference) if tide_hourly else None,
        next_window=window.get("next"),
        windows=window.get("windows") or [],
        blocked_by=window.get("blocked_by") or [],
        charts=charts,
        evidence=evidence,
        degraded=degraded,
        used_mock_data=adapter_base.served_mock_data(),
        attribution=attribution,
    )


def _align(source_times: list[str], values: list, target_times: list[str]) -> list:
    """Re-index ``values`` from ``source_times`` onto ``target_times``.

    Missing hours become None rather than being dropped, so every series handed to
    ``safe_window`` is the same length as the timeline it is scored against. An unaligned
    series is the one bug in this file that would produce a confidently wrong safe window.
    """
    if source_times == target_times:
        return list(values)

    lookup = {stamp: values[i] for i, stamp in enumerate(source_times) if i < len(values)}
    return [lookup.get(stamp) for stamp in target_times]


def verdict_label(verdict: Verdict) -> str:
    """Plain-English label for a verdict, for logs and the trace."""
    return {
        Verdict.GO: "safe to go",
        Verdict.CAUTION: "caution",
        Verdict.NO_GO: "do not go to sea",
        Verdict.NOT_APPLICABLE: "not applicable",
    }[verdict]
