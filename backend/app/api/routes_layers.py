"""GeoJSON map layers.

Owner: B · Phase: P1

    GET /api/layers/{layer} -> GeoJSON FeatureCollection

The frontend asks for a layer by the same enum value the response carries in
``map_layers``, so there is exactly one vocabulary for layers across the stack.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.enums import MapLayer
from app.schemas.response import ErrorDetail, ErrorResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["layers"])

EMPTY: dict = {"type": "FeatureCollection", "features": []}

# Which boundary file backs each boundary layer.
_BOUNDARY_LAYERS = {
    MapLayer.EEZ_BOUNDARY: "eez",
    MapLayer.IMBL_LINE: "imbl",
    MapLayer.MPA_ZONES: "mpa",
}


def _bbox_around(lat: float | None, lon: float | None, radius_km: float):
    """A degree bbox around a point, or None to serve the whole layer.

    Shipping the whole Indian EEZ to a phone is not viable, and the fisherman only cares
    about what is near him.
    """
    if lat is None or lon is None:
        return None
    import math

    d_lat = radius_km / 111.32
    d_lon = radius_km / (111.32 * max(math.cos(math.radians(lat)), 1e-6))
    return (lon - d_lon, lat - d_lat, lon + d_lon, lat + d_lat)


@router.get("/layers/{layer}")
async def get_layer(
    layer: MapLayer,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: float = 200.0,
    session_id: str | None = None,
) -> dict:
    """Return one map layer as a GeoJSON FeatureCollection.

    A layer whose data was never downloaded returns 503 with the command that fixes it,
    rather than an empty collection that renders as a silently blank map.
    """
    from app.adapters import geojson_store

    bbox = _bbox_around(lat, lon, radius_km)

    # ── Boundaries ────────────────────────────────────────────────────────
    if layer in _BOUNDARY_LAYERS:
        name = _BOUNDARY_LAYERS[layer]
        try:
            return geojson_store.as_geojson(name, bbox)
        except geojson_store.BoundaryDataMissing as exc:
            raise HTTPException(
                status_code=503,
                detail=ErrorResponse(
                    error=ErrorDetail(
                        code="ADAPTER_UNAVAILABLE",
                        message=str(exc),
                        hint="Run `python scripts/download_geojson.py` to download it.",
                    )
                ).model_dump(),
            ) from exc

    # ── Fishing zones ─────────────────────────────────────────────────────
    if layer is MapLayer.PFZ_ZONES:
        if lat is None or lon is None:
            raise HTTPException(
                status_code=422,
                detail=ErrorResponse(
                    error=ErrorDetail(
                        code="LOCATION_UNRESOLVED",
                        message="pfz_zones needs lat and lon.",
                        hint="Call /api/layers/pfz_zones?lat=16.99&lon=82.24",
                    )
                ).model_dump(),
            )

        from app.agents import marine_data
        from app.schemas.response import Location

        try:
            result = await marine_data.get_fishing_zones(
                Location(lat=lat, lon=lon), radius_km
            )
            return result["geojson"]
        except marine_data.NoZoneDataAvailable as exc:
            raise HTTPException(
                status_code=503,
                detail=ErrorResponse(
                    error=ErrorDetail(
                        code="ADAPTER_UNAVAILABLE",
                        message=str(exc),
                        hint="Run `python scripts/fetch_copernicus_subset.py` to enable "
                        "the computed PFZ proxy.",
                    )
                ).model_dump(),
            ) from exc

    # ── Route line, computed per query and held for the session ───────────
    if layer is MapLayer.ROUTE_LINE:
        from app.agents import route as route_agent

        if not session_id:
            return EMPTY
        return route_agent.recall(session_id) or EMPTY

    # ── The user's own pin is a client-side concern ───────────────────────
    if layer is MapLayer.USER_PIN:
        return EMPTY

    # ── Gridded heatmaps ──────────────────────────────────────────────────
    if layer in (MapLayer.CHLOROPHYLL_HEATMAP, MapLayer.SST_HEATMAP):
        if lat is None or lon is None:
            raise HTTPException(
                status_code=422,
                detail=ErrorResponse(
                    error=ErrorDetail(
                        code="LOCATION_UNRESOLVED",
                        message=f"{layer.value} needs lat and lon.",
                        hint=f"Call /api/layers/{layer.value}?lat=16.99&lon=82.24",
                    )
                ).model_dump(),
            )

        from app.adapters import copernicus

        field = "chl" if layer is MapLayer.CHLOROPHYLL_HEATMAP else "sst"
        box = _bbox_around(lat, lon, radius_km)
        bbox = (
            {"lon_min": box[0], "lat_min": box[1], "lon_max": box[2], "lat_max": box[3]}
            if box
            else None
        )
        try:
            return await copernicus.get_grid(field, bbox)
        except copernicus.CopernicusDataMissing as exc:
            raise HTTPException(
                status_code=503,
                detail=ErrorResponse(
                    error=ErrorDetail(
                        code="ADAPTER_UNAVAILABLE",
                        message=str(exc),
                        hint="Run `python scripts/fetch_copernicus_subset.py`.",
                    )
                ).model_dump(),
            ) from exc
        except Exception as exc:
            # The degradation rule is absolute: a map layer failing must not 500. It
            # costs the user one overlay, not the whole answer.
            logger.exception("layers: %s grid failed", layer.value)
            raise HTTPException(
                status_code=503,
                detail=ErrorResponse(
                    error=ErrorDetail(
                        code="ADAPTER_UNAVAILABLE",
                        message=f"Could not build the {layer.value} grid: {exc}",
                        hint="The other layers are unaffected; check the server logs.",
                    )
                ).model_dump(),
            ) from exc

    # ── Wave field ────────────────────────────────────────────────────────
    if layer is MapLayer.WAVE_HEATMAP:
        if lat is None or lon is None:
            raise HTTPException(
                status_code=422,
                detail=ErrorResponse(
                    error=ErrorDetail(
                        code="LOCATION_UNRESOLVED",
                        message="wave_heatmap needs lat and lon.",
                        hint="Call /api/layers/wave_heatmap?lat=16.99&lon=82.24",
                    )
                ).model_dump(),
            )

        from app.adapters import open_meteo_marine

        try:
            # Capped at 300 km: past that the grid spacing is coarser than the wave field
            # it is meant to show, and a 7×7 grid over half the Bay is decoration.
            grid = await open_meteo_marine.fetch_wave_grid(
                lat, lon, radius_km=min(radius_km, 300.0)
            )
        except Exception as exc:  # noqa: BLE001 - a layer must never 500
            logger.info("layers: wave grid unavailable (%s)", exc)
            return EMPTY

        if not grid:
            return EMPTY

        values = [cell["value"] for cell in grid]
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [cell["lon"], cell["lat"]]},
                    "properties": {
                        "value": cell["value"],
                        "field": "wave_height",
                        "time": cell["time"],
                    },
                }
                for cell in grid
            ],
            "properties": {
                "field": "wave_height",
                "unit": "m",
                "source": open_meteo_marine.ATTRIBUTION,
                "min": min(values),
                "max": max(values),
            },
        }

    # ── Detected thermal fronts ───────────────────────────────────────────
    if layer is MapLayer.OCEAN_FRONTS:
        from app.services import fronts

        box = _bbox_around(lat, lon, radius_km)
        bbox_dict = (
            {"lon_min": box[0], "lat_min": box[1], "lon_max": box[2], "lat_max": box[3]}
            if box
            else None
        )
        try:
            # Synchronous NumPy over a local NetCDF grid; off the event loop so a large
            # subset cannot stall every other request in flight.
            import anyio

            return await anyio.to_thread.run_sync(lambda: fronts.detect(bbox_dict))
        except Exception as exc:
            logger.info("layers: front detection unavailable (%s)", exc)
            raise HTTPException(
                status_code=503,
                detail=ErrorResponse(
                    error=ErrorDetail(
                        code="ADAPTER_UNAVAILABLE",
                        message=f"Could not detect thermal fronts: {exc}",
                        hint="Run `python scripts/fetch_copernicus_subset.py` to download "
                        "the SST subset this layer is computed from.",
                    )
                ).model_dump(),
            ) from exc

    # ── Hazard overlay ────────────────────────────────────────────────────
    # Drawn from the live conditions at the point, not from the answer: the answer's
    # alerts say *that* there is a hazard, this says *where* it is bad enough to matter.
    if layer is MapLayer.HAZARD_OVERLAY:
        if lat is None or lon is None:
            return EMPTY

        from app.adapters import open_meteo_marine
        from app.services.risk_rules import THRESHOLDS

        try:
            grid = await open_meteo_marine.fetch_wave_grid(
                lat, lon, radius_km=min(radius_km, 300.0)
            )
        except Exception as exc:  # noqa: BLE001
            logger.info("layers: hazard overlay unavailable (%s)", exc)
            return EMPTY

        limit = THRESHOLDS["wave_height"]["no_go"]
        hazardous = [cell for cell in grid if cell["value"] >= limit]
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [cell["lon"], cell["lat"]]},
                    "properties": {
                        "value": cell["value"],
                        "unit": "m",
                        "hazard": "wave_height_above_small_craft_limit",
                        "threshold": limit,
                        "time": cell["time"],
                        "source": open_meteo_marine.ATTRIBUTION,
                    },
                }
                for cell in hazardous
            ],
            "properties": {
                "field": "wave_height",
                "unit": "m",
                "threshold": limit,
                "source": open_meteo_marine.ATTRIBUTION,
            },
        }

    # ── The user's pin is client-side; nothing else is left ───────────────
    logger.info("layers: %s has no server-side data — returning an empty collection", layer.value)
    return EMPTY
