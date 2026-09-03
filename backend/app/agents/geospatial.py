"""Geospatial / Geofencing Agent.

Owner: E · Phase: P1 · Type: Tool (shapely — no LLM)
Sources: Marine Regions (EEZ, IMBL), Protected Planet (MPA)

Two jobs:
  - golden query #1: nearest PFZ, with **distance and bearing** from the user
  - golden query #3: proximity to EEZ / IMBL / Marine Protected Areas

The IMBL is the one that carries real consequences — crossing the International Maritime
Boundary Line is what gets boats detained. Alert on *approach*, not on breach; by the time
it's a breach the warning is worthless.

⚠️ Use geodesic distance (``pyproj.Geod``), never euclidean on lat/lon. At Indian
latitudes a degree of longitude is ~15% shorter than a degree of latitude — euclidean
error here is measured in kilometres, and kilometres are the difference between fishing
legally and being arrested.
"""

from __future__ import annotations

import logging

from pyproj import Geod
from shapely.geometry import Point, shape

from app.adapters import geojson_store
from app.schemas.enums import AlertType
from app.schemas.response import Evidence, Location

logger = logging.getLogger(__name__)

NAME = "geospatial"

_GEOD = Geod(ellps="WGS84")

# 16-point compass. A fisherman reads "north-east", not "045°".
_COMPASS = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
]

_COMPASS_WORDS = {
    "N": "north", "NNE": "north-northeast", "NE": "north-east", "ENE": "east-northeast",
    "E": "east", "ESE": "east-southeast", "SE": "south-east", "SSE": "south-southeast",
    "S": "south", "SSW": "south-southwest", "SW": "south-west", "WSW": "west-southwest",
    "W": "west", "WNW": "west-northwest", "NW": "north-west", "NNW": "north-northwest",
}

# ── What we call these boundaries when speaking to a person ───────────────
#
# The official names are acronyms of acronyms — EEZ, IMBL, MPA — and they were surfacing
# raw in answers, alert banners and map legends. A fisherman reading "you are 2 km from the
# IMBL" has to already know what an IMBL is before the warning means anything, which is
# exactly backwards for a warning.
#
# So every user-facing string uses BOUNDARY_LABELS, in the words a person would use. The
# official term is kept in BOUNDARY_TERMS and shown once, parenthetically, in the places a
# researcher or a port authority would look for it — the Layers list and the Sources view.
# Plain language for everyone; the technical name still findable by whoever needs it.
#
# The labels are written to slot into two sentence shapes without re-reading oddly:
#     "You are {distance} km from {label}"
#     "{inside|outside} {label}, boundary {distance} km away"
BOUNDARY_LABELS = {
    "eez": "India's own waters",
    "imbl": "the sea border with a neighbouring country",
    "mpa": "a protected marine area",
}

BOUNDARY_TERMS = {
    "eez": "Exclusive Economic Zone (EEZ)",
    "imbl": "International Maritime Boundary Line (IMBL)",
    "mpa": "Marine Protected Area (MPA)",
}

# One sentence each, for a first-time reader: what the boundary is, and whether being on
# the wrong side of it actually matters. The third clause is the one that counts — two of
# these three are informational and one gets boats seized.
BOUNDARY_MEANING = {
    "eez": (
        "the sea India controls, out to 200 nautical miles from the coast. Fishing "
        "outside it is not illegal — it is simply beyond India's own waters"
    ),
    "imbl": (
        "the line where India's waters meet another country's. Crossing it without "
        "permission is what gets fishing boats detained"
    ),
    "mpa": (
        "a conservation area for marine life, where fishing may be restricted or banned"
    ),
}

# Layers that are LINES, not regions. A line has no interior, so `contains()` is always
# False for them and saying "you are outside the boundary line" is meaningless — for
# these only the distance is reported.
LINE_LAYERS = {"imbl"}


def compass_point(bearing_deg: float) -> str:
    """Bearing in degrees → 16-point compass abbreviation."""
    index = int((bearing_deg % 360) / 22.5 + 0.5) % 16
    return _COMPASS[index]


def compass_word(bearing_deg: float) -> str:
    """Bearing in degrees → spoken compass direction ('north-east')."""
    return _COMPASS_WORDS[compass_point(bearing_deg)]


def distance_and_bearing(origin: Location, target: Location) -> tuple[float, float]:
    """Geodesic distance (km) and initial bearing (degrees true) between two points.

    WGS84 geodesic via pyproj — never euclidean. ``Geod.inv`` takes lon/lat order, which
    is the reverse of how Location stores them; getting that backwards silently produces
    plausible-looking nonsense, so it is spelled out here.
    """
    forward_azimuth, _, distance_m = _GEOD.inv(
        origin.lon, origin.lat, target.lon, target.lat
    )
    return distance_m / 1000.0, forward_azimuth % 360.0


def describe_offset(distance_km: float, bearing_deg: float) -> str:
    """'38 km north-east' — the phrasing a fisherman actually uses."""
    return f"{distance_km:.0f} km {compass_word(bearing_deg)}"


async def nearest_zone(location: Location, zones: dict) -> dict:
    """Nearest zone from a GeoJSON FeatureCollection, with distance + bearing.

    Returns {'zone', 'distance_km', 'bearing_deg', 'description', 'evidence'}, or an
    empty dict when the collection has no features.
    """
    features = (zones or {}).get("features") or []
    if not features:
        return {}

    origin = Point(location.lon, location.lat)

    best = None
    for feature in features:
        try:
            geometry = shape(feature["geometry"])
        except (KeyError, TypeError, ValueError) as exc:
            logger.debug("geospatial: skipping malformed feature (%s)", exc)
            continue

        # shapely's nearest_points works in degrees; use it only to FIND the nearest
        # candidate, then measure the winner geodesically. Ranking in degrees is safe
        # here because the candidates are all within a few hundred km of each other.
        representative = geometry.centroid if geometry.geom_type != "Point" else geometry
        planar_distance = origin.distance(representative)
        if best is None or planar_distance < best[0]:
            best = (planar_distance, feature, representative)

    if best is None:
        return {}

    _, feature, representative = best
    target = Location(lat=representative.y, lon=representative.x, source="zone_centroid")
    distance_km, bearing_deg = distance_and_bearing(location, target)
    description = describe_offset(distance_km, bearing_deg)

    properties = feature.get("properties") or {}
    source = properties.get("source", "computed PFZ proxy")

    evidence = [
        Evidence(
            field="nearest_zone_distance",
            value=round(distance_km, 1),
            unit="km",
            source=source,
            location=target,
        ),
        Evidence(
            field="nearest_zone_bearing",
            value=compass_point(bearing_deg),
            unit=None,
            source=source,
            location=target,
        ),
    ]

    return {
        "zone": feature,
        "distance_km": round(distance_km, 1),
        "bearing_deg": round(bearing_deg, 1),
        "description": description,
        "evidence": evidence,
    }


async def check_geofences(location: Location, buffer_km: float = 10.0) -> list[Evidence]:
    """Containment and proximity vs EEZ, IMBL and MPA polygons.

    Returns evidence for which zones contain the point and the distance to the nearest
    boundary of each type. ``buffer_km`` is the proximity-alert threshold.

    Raises FileNotFoundError (from the store) when no boundary data is on disk, so the
    caller emits a `skipped` step naming the download script rather than reporting the
    boat as safely inside nothing.
    """
    evidence: list[Evidence] = []
    origin = Point(location.lon, location.lat)

    for key in ("eez", "imbl", "mpa"):
        geometry = geojson_store.get_geometry(key)
        if geometry is None:
            logger.info("geospatial: no %s geometry loaded — skipping that check", key)
            continue

        label = BOUNDARY_LABELS[key]
        attribution = (
            geojson_store.ATTRIBUTION_WDPA if key == "mpa" else geojson_store.ATTRIBUTION_EEZ
        )

        is_line = key in LINE_LAYERS
        inside = False if is_line else geometry.contains(origin)

        # Distance to the *boundary*, not the interior: inside a polygon the distance to
        # the shape itself is zero, which tells the user nothing about how close the line
        # is. A line layer is already its own boundary.
        target_geometry = geometry if is_line else geometry.boundary
        nearest_km, nearest_bearing = _geodesic_to_geometry(location, target_geometry)

        if not is_line:
            evidence.append(
                Evidence(
                    field=f"inside_{key}",
                    value=bool(inside),
                    unit=None,
                    source=attribution,
                    location=location,
                )
            )
        if nearest_km is not None:
            evidence.append(
                Evidence(
                    field=f"distance_to_{key}",
                    value=round(nearest_km, 1),
                    unit="km",
                    source=attribution,
                    location=location,
                )
            )
            logger.debug(
                "geospatial: %s — inside=%s, boundary %.1f km %s",
                label,
                inside,
                nearest_km,
                compass_word(nearest_bearing or 0),
            )

    return evidence


def _geodesic_to_geometry(location: Location, geometry) -> tuple[float | None, float | None]:
    """Geodesic distance and bearing from a point to the nearest vertex of a geometry.

    Uses shapely's nearest_points to locate the closest position in degree space, then
    measures that one pair geodesically — planar ranking is fine for choosing the nearest
    candidate, but the number we report must be a real distance.
    """
    from shapely.ops import nearest_points

    try:
        origin = Point(location.lon, location.lat)
        _, closest = nearest_points(origin, geometry)
    except Exception as exc:  # noqa: BLE001 - a bad polygon must not fail the run
        logger.debug("geospatial: nearest_points failed (%s)", exc)
        return None, None

    target = Location(lat=closest.y, lon=closest.x)
    return distance_and_bearing(location, target)


def derive_geofence_alerts(evidence: list[Evidence], buffer_km: float = 10.0) -> list[AlertType]:
    """GEOFENCE_BREACH when inside a restricted zone, GEOFENCE_PROXIMITY when near one.

    ## What is and is not a breach

    Only two things raise a breach: being **inside a Marine Protected Area**, and being
    **across an IMBL**. Everything else is lawful.

    In particular, ``inside_eez == False`` is NOT a breach, and treating it as one was a
    real bug — it fired at Kakinada, a home harbour, because the EEZ polygon covers water
    and a quayside point sits just outside it. It would also fire in international waters,
    where any vessel may lawfully be. An alert that cries wolf at the harbour wall trains
    the user to ignore the one that matters.

    The IMBL is the line with consequences: crossing it is what gets boats detained, so
    the alert has to arrive on *approach*, not after the fact.
    """
    alerts: list[AlertType] = []
    by_field = {e.field: e for e in evidence}

    inside_mpa = by_field.get("inside_mpa")
    if inside_mpa is not None and bool(inside_mpa.value):
        alerts.append(AlertType.GEOFENCE_BREACH)

    for key in ("imbl", "mpa"):
        entry = by_field.get(f"distance_to_{key}")
        if entry is None:
            continue
        try:
            distance = float(entry.value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        if distance <= buffer_km and AlertType.GEOFENCE_BREACH not in alerts:
            alerts.append(AlertType.GEOFENCE_PROXIMITY)
            break

    return alerts
