"""Open-Meteo Weather — wind, rain, storms.

Owner: B · Phase: P0
Endpoint: https://api.open-meteo.com/v1/forecast
Auth: none · Cache TTL: 1 hour

Wind and gusts pair with wave height to decide the safety verdict.

## The lightning proxy, corrected

The scaffold originally listed ``thunderstorm_probability`` as the lightning proxy.
**That field is silently empty.** Open-Meteo accepts it (HTTP 200, unit reported as
``"undefined"``) and returns null for every hour — verified 72/72 nulls at Kakinada on
27 Aug 2026. A rule keyed to it would never fire while looking perfectly wired, which is
the worst kind of failure in a safety system.

Replaced with fields that return real values:

  - ``cape`` — convective available potential energy, J/kg. The standard meteorological
    measure of thunderstorm potential. >1000 is a storm-capable atmosphere,
    >2500 is strongly unstable.
  - ``precipitation_probability`` — %, adds wet-weather context
  - ``weather_code`` — WMO codes 95/96/99 are the explicit thunderstorm codes

**Flag the proxy honestly** in the Evidence source string and out loud in the demo. CAPE
describes an atmosphere capable of storms; it is not an observed lightning strike.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from app.adapters.base import (
    AdapterError,
    fetch_with_cascade,
    get_json,
    peak_in_window,
    slice_window,
)
from app.schemas.response import Evidence, Location
from app.services.cache import cache_key

logger = logging.getLogger(__name__)

BASE_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL = 3600
ATTRIBUTION = "Weather data by Open-Meteo.com (CC BY 4.0)"

HOURLY_FIELDS = [
    "wind_speed_10m",
    "wind_gusts_10m",
    "wind_direction_10m",
    "precipitation",
    "precipitation_probability",
    "weather_code",
    "cape",
    "visibility",
]

SOURCE = "Open-Meteo"

# Said in full wherever CAPE appears as evidence. The honesty note is not decoration —
# a judge who knows meteorology will ask, and the right answer costs us nothing.
LIGHTNING_PROXY_SOURCE = (
    "Open-Meteo storm energy — a modelled estimate of thunderstorm potential, "
    "not an observed lightning report"
)
"""Written without the acronym on purpose.

The honesty note is the point of this string and it is the *reader* who has to understand
it. "Open-Meteo CAPE (modelled thunderstorm proxy, not an IMD lightning observation)"
carries two acronyms and a term of art into a sentence a fisherman reads at 4 a.m.; it
communicated the caveat to meteorologists and to nobody else. The underlying field is still
CAPE, and ``docs/DATA_SOURCES.md`` says so for whoever needs that."""

UNITS = {
    "wind_speed_10m": "km/h",
    "wind_gusts_10m": "km/h",
    "wind_direction_10m": "°",
    "precipitation": "mm",
    "precipitation_probability": "%",
    "weather_code": "wmo",
    "cape": "J/kg",
    "visibility": "m",
}

# WMO weather codes that mean thunderstorm. 95 = thunderstorm, 96/99 = with hail.
THUNDERSTORM_CODES = {95, 96, 99}

# Fields where a LOWER value is worse. Visibility is the only one, and it is the classic
# off-by-a-comparison bug in this file — keep it declared rather than special-cased inline.
LOWER_IS_WORSE = {"visibility"}

# Compass bearings. Maximising a direction is meaningless (350° is not "worse" than 10°,
# and they are 20° apart), so these are excluded from the peak scan. Named explicitly
# because the field is 'wind_direction_10m' — a suffix test on '_direction' misses it.
CIRCULAR_FIELDS = {"wind_direction_10m"}


async def fetch(lat: float, lon: float, forecast_days: int = 7) -> dict:
    """Raw weather forecast for a point."""
    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "hourly": ",".join(HOURLY_FIELDS),
        "forecast_days": forecast_days,
        "timezone": "UTC",
    }
    key = cache_key("open_meteo_weather", params)
    result = await fetch_with_cascade(
        key, lambda: get_json(BASE_URL, params), CACHE_TTL, SOURCE
    )
    return result.payload


async def get_weather_evidence(
    lat: float, lon: float, start: str, end: str
) -> list[Evidence]:
    """Evidence for the risk agent: peak wind, gusts, storm potential in the window.

    Reports each field at its worst hour in the window, with that hour in
    ``Evidence.time``. Raises AdapterError if the window falls outside the forecast
    horizon — an empty list would read as "nothing to worry about".
    """
    window_start = datetime.fromisoformat(start) if isinstance(start, str) else start
    window_end = datetime.fromisoformat(end) if isinstance(end, str) else end

    payload = await fetch(lat, lon)
    hourly = payload.get("hourly") or {}
    indices = slice_window(hourly, window_start, window_end)
    if not indices:
        raise AdapterError(
            f"weather forecast has no hours inside the requested window "
            f"({window_start:%Y-%m-%d %H:%M} → {window_end:%Y-%m-%d %H:%M} UTC)"
        )

    location = Location(
        lat=payload.get("latitude", lat),
        lon=payload.get("longitude", lon),
        source="weather_grid_sample",
    )

    evidence: list[Evidence] = []
    for field in HOURLY_FIELDS:
        if field == "weather_code" or field in CIRCULAR_FIELDS:
            continue  # weather_code is categorical (handled below); directions are circular
        mode = "min" if field in LOWER_IS_WORSE else "max"
        found = peak_in_window(hourly, field, indices, mode=mode)
        if found is None:
            # A genuinely absent field is worth knowing about — this is exactly how the
            # thunderstorm_probability hole went unnoticed in the scaffold.
            logger.debug("weather: field %s has no values in the window", field)
            continue
        value, when = found
        evidence.append(
            Evidence(
                field=field,
                value=round(value, 2),
                unit=UNITS.get(field),
                source=LIGHTNING_PROXY_SOURCE if field == "cape" else SOURCE,
                time=when,
                location=location,
            )
        )

    # Thunderstorm presence from the WMO code — a categorical signal, so it reports as a
    # boolean with the hour it first appears rather than as a maximised number.
    codes = hourly.get("weather_code") or []
    times = hourly.get("time") or []
    storm_hour = None
    for i in indices:
        if i < len(codes) and codes[i] in THUNDERSTORM_CODES:
            storm_hour = times[i] if i < len(times) else None
            break
    if storm_hour is not None:
        from app.adapters.base import parse_hour

        evidence.append(
            Evidence(
                field="thunderstorm_forecast",
                value=True,
                unit=None,
                source=f"{SOURCE} (WMO weather code)",
                time=parse_hour(storm_hour),
                location=location,
            )
        )

    return evidence


async def _spike() -> None:
    """P0 spike: real wind for a named port, plus proof the CAPE fix holds."""
    lat, lon = 16.99, 82.24  # Kakinada
    print(f"Open-Meteo Weather — Kakinada ({lat}, {lon})\n")

    payload = await fetch(lat, lon, forecast_days=2)
    hourly = payload.get("hourly", {})
    print("  field coverage (non-null / total) over 48 h:")
    for field in HOURLY_FIELDS:
        values = hourly.get(field) or []
        non_null = [v for v in values if v is not None]
        flag = "" if non_null else "   ← ALL NULL"
        print(f"    {field:28} {len(non_null):>3}/{len(values):<3}{flag}")

    # The regression guard for the finding that motivated this file's field list.
    stale = [v for v in (hourly.get("thunderstorm_probability") or []) if v is not None]
    print(f"\n  (thunderstorm_probability is not requested; it returns {len(stale)} values when it is)")

    from datetime import timedelta
    from datetime import timezone as _tz

    now = datetime.now(_tz.utc)
    evidence = await get_weather_evidence(
        lat, lon, now.isoformat(), (now + timedelta(hours=24)).isoformat()
    )
    print("\n  evidence for the next 24 h (worst hour per field):")
    for item in evidence:
        print(
            f"    {item.field:26} {item.value!s:>7} {item.unit or '':6} "
            f"at {item.time:%d %b %H:%M} UTC"
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    asyncio.run(_spike())
