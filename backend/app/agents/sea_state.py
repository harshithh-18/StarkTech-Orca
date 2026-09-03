"""Ocean / Sea-State Agent.

Owner: B · Phase: P2 · Type: Tool (no LLM)
Source: Open-Meteo Marine

The sea-state backbone: wave height, period, direction, swell, currents, sea-surface
temperature. Wave height is the single most decisive input to the safety verdict —
golden query #2 lives or dies here.

Purely deterministic. No LLM, no interpretation — fetch, slice, return evidence.
"""

from __future__ import annotations

import logging

from app.adapters import open_meteo_marine
from app.adapters.base import parse_hour
from app.schemas.enums import ChartKind
from app.schemas.response import ChartPoint, ChartSeries, ChartSpec, Evidence, Location

logger = logging.getLogger(__name__)

NAME = "sea_state"
ATTRIBUTION = open_meteo_marine.ATTRIBUTION

# Named in full wherever a tide value is cited. Modelled, not a port tide table — the
# distinction matters to anyone who has actually used one.
TIDE_SOURCE = "Open-Meteo Marine (modelled sea level, not a port tide table)"


async def fetch_sea_state(location: Location, time_window: dict) -> list[Evidence]:
    """Wave height, period, swell height, currents, SST — worst reading in the window.

    Delegates the offshore sampling policy to the adapter: the reading returned is the
    worst across the sampled area rather than the value at the harbour wall. See the
    module docstring of ``adapters/open_meteo_marine``.
    """
    return await open_meteo_marine.get_sea_state_evidence(
        location.lat,
        location.lon,
        time_window["start"],
        time_window["end"],
    )


async def fetch_forecast_chart(location: Location, hours: int = 48) -> ChartSpec:
    """48-hour wave-height series for the forecast chart.

    The title stays in English here; ``services.explainability`` localises it into the
    response language, so the chart builder doesn't need to know what language we're in.
    """
    cells = await open_meteo_marine.fetch_area(location.lat, location.lon, forecast_days=3)
    if not cells:
        raise open_meteo_marine.AdapterError(
            "no marine grid cell with data near this location — cannot build a wave chart"
        )

    # Chart the roughest cell in the sampled area, for consistency with the verdict: a
    # chart showing calmer water than the verdict cites would read as a contradiction.
    def peak_of(cell: dict) -> float:
        values = [v for v in (cell.get("hourly", {}).get("wave_height") or []) if v is not None]
        return max(values) if values else 0.0

    roughest = max(cells, key=peak_of)
    hourly = roughest.get("hourly", {})
    times = (hourly.get("time") or [])[:hours]
    waves = (hourly.get("wave_height") or [])[:hours]

    points = [
        ChartPoint(x=t, y=float(v) if v is not None else None)
        for t, v in zip(times, waves)
    ]

    return ChartSpec(
        id="wave_48h",
        title="Wave height, next 48 hours",
        kind=ChartKind.LINE,
        x_label="Time (UTC)",
        y_label="Wave height (m)",
        series=[ChartSeries(name="Wave height", unit="m", points=points)],
    )


async def fetch_tides(location: Location, hours: int = 48) -> tuple[ChartSpec, list[Evidence]]:
    """Tide curve plus the next high and low water.

    Source decision (recorded in docs/DATA_SOURCES.md): Open-Meteo Marine publishes
    ``sea_level_height_msl``, the modelled sea-surface height above mean sea level. That is
    the tidal signal, and it comes from the same request we already make for waves — so it
    costs nothing extra and stays consistent with the rest of the sea state.

    It is a **model**, not an INCOIS tide table for a specific port, and the evidence
    source string says so. For "should I cross the bar around dawn?" the modelled curve is
    the right precision; for a port's official chart datum it is not, and we do not claim
    to be one.
    """
    series = await open_meteo_marine.get_tide_series(location.lat, location.lon, hours)

    points = [
        ChartPoint(x=t, y=float(h) if h is not None else None)
        for t, h in zip(series["times"], series["heights"])
    ]

    chart = ChartSpec(
        id="tide",
        title="Tide, next 48 hours",
        kind=ChartKind.AREA,
        x_label="Time (UTC)",
        y_label="Height above mean sea level (m)",
        series=[ChartSeries(name="Tide", unit="m", points=points)],
    )

    # Only the next turning point of each kind: a list of eight is a table, and what the
    # user is actually asking is "when is the next high water".
    evidence: list[Evidence] = []
    for kind in ("high", "low"):
        turn = next((t for t in series["turns"] if t["kind"] == kind), None)
        if turn is None:
            continue
        evidence.append(
            Evidence(
                field=f"next_{kind}_tide",
                value=turn["height"],
                unit="m",
                source=TIDE_SOURCE,
                time=parse_hour(turn["time"]),
                location=series["location"],
            )
        )

    heights = [h for h in series["heights"] if h is not None]
    if heights:
        evidence.append(
            Evidence(
                field="tidal_range",
                value=round(max(heights) - min(heights), 2),
                unit="m",
                source=TIDE_SOURCE,
                location=series["location"],
            )
        )

    return chart, evidence
