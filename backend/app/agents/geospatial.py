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

from app.schemas.response import Evidence, Location


def distance_and_bearing(origin: Location, target: Location) -> tuple[float, float]:
    """Geodesic distance (km) and initial bearing (degrees true) between two points.

    TODO(P1, E): pyproj.Geod(ellps='WGS84').inv() — NOT euclidean
    """
    raise NotImplementedError("TODO(P1, E)")


async def nearest_zone(location: Location, zones: dict) -> dict:
    """Nearest zone from a GeoJSON FeatureCollection, with distance + bearing.

    TODO(P1, E): shapely nearest; return {'zone', 'distance_km', 'bearing_deg', 'evidence'}
    TODO(P1, E): give the bearing a compass name too ("38 km NE") — a fisherman reads
                 "north-east", not "045°"
    """
    raise NotImplementedError("TODO(P1, E)")


async def check_geofences(location: Location, buffer_km: float = 10.0) -> list[Evidence]:
    """Containment and proximity vs EEZ, IMBL and MPA polygons.

    Returns evidence for: which zones contain the point, and distance to the nearest
    boundary of each type. ``buffer_km`` is the proximity-alert threshold.

    TODO(P1, E): load polygons via adapters.geojson_store (cached at startup)
    TODO(P1, E): shapely contains() + geodesic distance to boundary
    TODO(P2, E): emit GEOFENCE_BREACH when inside, GEOFENCE_PROXIMITY when within buffer
    TODO(P2, E): handle the antimeridian and multi-polygon EEZs (Andaman & Nicobar,
                 Lakshadweep are separate polygons from the mainland)
    """
    raise NotImplementedError("TODO(P1, E)")
