"""Cyclone and severe-weather detection.

Owner: B · Phase: P4 (the P2 TODO, resolved)
Cache TTL: 1 hour
Attribution: Open-Meteo (CC BY 4.0); IMD classification bands

## Why this is not an IMD scraper

The P2 plan was to parse IMD's bulletin page. It cannot be done, and this was verified
rather than assumed — every documented entry point returns HTTP 404:

    mausam.imd.gov.in/api/cyclone_api.php                     404
    rsmcnewdelhi.imd.gov.in/api/cyclone                       404
    mausam.imd.gov.in/responsive/rss/allIndiaWeatherReport.xml 404
    internal.imd.gov.in/pages/cyclone_mainpage.php            404

That is the same conclusion the team reached for INCOIS (docs/DATA_SOURCES.md), and the
same answer follows: build a **declared proxy** from a source that does respond, and label
it as a proxy everywhere it surfaces.

## What this actually does

Samples mean-sea-level pressure and sustained 10 m wind across a ring around the location
and classifies the result against **IMD's own published wind bands** for systems over the
north Indian Ocean:

    Low pressure area        < 31 km/h
    Depression               31–49 km/h
    Deep depression          50–61 km/h
    Cyclonic storm           62–88 km/h
    Severe cyclonic storm    89–117 km/h
    Very severe / above      ≥ 118 km/h

A system is reported only when **both** tests pass: gale-force sustained wind *and* a
pressure minimum below the tropical background. Wind alone is a squall; low pressure alone
is a monsoon trough. Requiring both is what stops this crying cyclone every July.

> ## This is not a cyclone warning.
> It is a model field, classified. IMD issues warnings; ORCA does not, and the evidence
> ``source`` string says so on every value. When IMD has a bulletin out, IMD's bulletin is
> the authority and this proxy is at best a corroboration. That sentence belongs in the
> demo narration as much as in this docstring.

The check always returns evidence — including an explicit "no system detected" — because
absence of a warning is not evidence of safety, and the trace should show that the check
actually ran.
"""

from __future__ import annotations

import asyncio
import logging
import math
from datetime import datetime, timedelta, timezone

from app.adapters.base import fetch_with_cascade, get_json, parse_hour
from app.schemas.response import Evidence, Location
from app.services.cache import cache_key

logger = logging.getLogger(__name__)

BASE_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL = 3600
ATTRIBUTION = (
    "Cyclone classification follows India Meteorological Department wind bands; "
    "fields from Open-Meteo.com (CC BY 4.0)"
)

SOURCE = "Open-Meteo pressure + wind, classified against IMD bands (modelled proxy, not an IMD bulletin)"

# IMD's classification for systems over the north Indian Ocean, by 3-minute sustained
# surface wind. Ordered strongest-first so the first match wins.
IMD_BANDS: list[tuple[float, str]] = [
    (118.0, "very severe cyclonic storm or above"),
    (89.0, "severe cyclonic storm"),
    (62.0, "cyclonic storm"),
    (50.0, "deep depression"),
    (31.0, "depression"),
]

CYCLONE_WIND_KMH = 62.0
"""At and above this, IMD calls it a cyclonic storm. Below it, this module reports the
system by name but does not raise ``cyclone_bulletin_active``."""

CYCLONE_PRESSURE_HPA = 1000.0
"""Tropical background over the Bay of Bengal sits near 1006–1010 hPa. A centre below
1000 hPa is a genuine depression rather than a diurnal wobble."""

# How far around the point to look for a system centre, and on how many bearings. A
# tropical cyclone's damaging wind field is hundreds of km across, so a 250 km ring
# catches one that is approaching rather than only one already overhead.
SEARCH_RADIUS_KM = 250.0
SEARCH_BEARINGS = list(range(0, 360, 60))

HOURLY_FIELDS = ["pressure_msl", "wind_speed_10m", "wind_gusts_10m"]

# How far ahead to look. A cyclone three days out is a planning fact, not an alert; two
# days is the window in which a fisherman's decision actually changes.
FORECAST_HOURS = 48


def classify(wind_kmh: float) -> str | None:
    """IMD band name for a sustained wind, or None below depression strength."""
    for floor, name in IMD_BANDS:
        if wind_kmh >= floor:
            return name
    return None


def _offset_point(lat: float, lon: float, bearing_deg: float, distance_km: float) -> tuple[float, float]:
    """Approximate destination point — enough to land in the right model cell."""
    bearing = math.radians(bearing_deg)
    d_lat = (distance_km / 111.32) * math.cos(bearing)
    d_lon = (distance_km / (111.32 * max(math.cos(math.radians(lat)), 1e-6))) * math.sin(bearing)
    return lat + d_lat, lon + d_lon


async def fetch_active_bulletins(lat: float, lon: float) -> list[dict]:
    """Systems detected around a point, strongest first.

    Each entry is ``{"band", "wind_kmh", "gust_kmh", "pressure_hpa", "lat", "lon",
    "time", "distance_km"}``. An empty list means no system reached depression strength
    anywhere in the searched area within the forecast window.
    """
    points = [(lat, lon)] + [
        _offset_point(lat, lon, bearing, SEARCH_RADIUS_KM) for bearing in SEARCH_BEARINGS
    ]

    params = {
        "latitude": ",".join(f"{p[0]:.3f}" for p in points),
        "longitude": ",".join(f"{p[1]:.3f}" for p in points),
        "hourly": ",".join(HOURLY_FIELDS),
        "forecast_days": 3,
        "timezone": "UTC",
    }
    key = cache_key("imd_proxy_cyclone", params)
    result = await fetch_with_cascade(
        key, lambda: get_json(BASE_URL, params), CACHE_TTL, SOURCE
    )

    payload = result.payload
    cells = payload if isinstance(payload, list) else [payload]

    horizon = datetime.now(timezone.utc) + timedelta(hours=FORECAST_HOURS)
    systems: list[dict] = []

    for cell in cells:
        hourly = cell.get("hourly") or {}
        times = hourly.get("time") or []
        winds = hourly.get("wind_speed_10m") or []
        gusts = hourly.get("wind_gusts_10m") or []
        pressures = hourly.get("pressure_msl") or []

        # The worst hour at this cell inside the window: strongest sustained wind, and
        # the pressure at that same hour — pairing them matters, because the lowest
        # pressure of the week and the strongest wind of the week may be different systems.
        worst_index, worst_wind = None, None
        for index, stamp in enumerate(times):
            if index >= len(winds) or winds[index] is None:
                continue
            try:
                when = parse_hour(stamp)
            except (ValueError, AttributeError):
                continue
            if when > horizon:
                break
            wind = float(winds[index])
            if worst_wind is None or wind > worst_wind:
                worst_index, worst_wind = index, wind

        if worst_index is None or worst_wind is None:
            continue

        band = classify(worst_wind)
        if band is None:
            continue

        pressure = (
            float(pressures[worst_index])
            if worst_index < len(pressures) and pressures[worst_index] is not None
            else None
        )
        # Wind without a pressure signature is a squall line or a strong monsoon flow,
        # not a tropical system. Both tests, or nothing.
        if pressure is None or pressure >= CYCLONE_PRESSURE_HPA:
            continue

        cell_lat = cell.get("latitude", lat)
        cell_lon = cell.get("longitude", lon)
        systems.append(
            {
                "band": band,
                "wind_kmh": round(worst_wind, 1),
                "gust_kmh": (
                    round(float(gusts[worst_index]), 1)
                    if worst_index < len(gusts) and gusts[worst_index] is not None
                    else None
                ),
                "pressure_hpa": round(pressure, 1),
                "lat": cell_lat,
                "lon": cell_lon,
                "time": times[worst_index],
                "distance_km": round(
                    math.dist(
                        (lat * 111.32, lon * 111.32 * math.cos(math.radians(lat))),
                        (cell_lat * 111.32, cell_lon * 111.32 * math.cos(math.radians(lat))),
                    ),
                    0,
                ),
            }
        )

    systems.sort(key=lambda s: s["wind_kmh"], reverse=True)
    return systems


async def get_alerts_near(lat: float, lon: float, radius_km: float = SEARCH_RADIUS_KM) -> list[Evidence]:
    """Cyclone evidence for a location. Never empty.

    Returns ``cyclone_bulletin_active=False`` with an explicit source when nothing is
    detected, so the reasoning trace can show the check ran. An empty list would be
    indistinguishable from the check never happening — and in a safety system those two
    must never look the same.
    """
    try:
        systems = await fetch_active_bulletins(lat, lon)
    except Exception as exc:  # noqa: BLE001 - a failed check is not an all-clear
        logger.info("imd_bulletins: cyclone proxy unavailable (%s)", exc)
        return [
            Evidence(
                field="cyclone_check_failed",
                value=str(exc)[:160],
                source=SOURCE,
                location=Location(lat=lat, lon=lon),
            )
        ]

    location = Location(lat=lat, lon=lon)

    if not systems:
        return [
            Evidence(
                field="cyclone_bulletin_active",
                value=False,
                source=SOURCE,
                location=location,
            )
        ]

    strongest = systems[0]
    centre = Location(
        lat=strongest["lat"], lon=strongest["lon"], source="cyclone_proxy_sample"
    )
    when = parse_hour(strongest["time"])

    evidence = [
        Evidence(
            field="cyclone_bulletin_active",
            # Only a cyclonic storm or worse trips the flag that raises the CYCLONE alert
            # and caps the verdict. A depression is reported, named, and left as context.
            value=strongest["wind_kmh"] >= CYCLONE_WIND_KMH,
            source=SOURCE,
            time=when,
            location=centre,
        ),
        Evidence(
            field="cyclone_system_class",
            value=strongest["band"],
            source=SOURCE,
            time=when,
            location=centre,
        ),
        Evidence(
            field="cyclone_sustained_wind",
            value=strongest["wind_kmh"],
            unit="km/h",
            source=SOURCE,
            time=when,
            location=centre,
        ),
        Evidence(
            field="cyclone_centre_pressure",
            value=strongest["pressure_hpa"],
            unit="hPa",
            source=SOURCE,
            time=when,
            location=centre,
        ),
        Evidence(
            field="cyclone_distance",
            value=strongest["distance_km"],
            unit="km",
            source=SOURCE,
            time=when,
            location=centre,
        ),
    ]

    logger.warning(
        "imd_bulletins: %s detected %.0f km away — sustained %.0f km/h, %.0f hPa at %s",
        strongest["band"], strongest["distance_km"], strongest["wind_kmh"],
        strongest["pressure_hpa"], strongest["time"],
    )
    return evidence


async def _spike() -> None:
    """Run the proxy against a named point and print what it found."""
    for name, lat, lon in (
        ("Kakinada", 16.99, 82.24),
        ("Chennai", 13.08, 80.27),
        ("Paradip", 20.26, 86.67),
    ):
        evidence = await get_alerts_near(lat, lon)
        print(f"\n{name} ({lat}, {lon})")
        for item in evidence:
            print(f"  {item.field:26} {item.value}  {item.unit or ''}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    asyncio.run(_spike())
