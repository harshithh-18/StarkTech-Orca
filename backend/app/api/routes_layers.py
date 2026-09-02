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

    # ── The user's own pin is a client-side concern ───────────────────────
    if layer is MapLayer.USER_PIN:
        return EMPTY

    # ── Heatmaps ──────────────────────────────────────────────────────────
    # TODO(P2, E): serve sst/chlorophyll/wave heatmaps as a coarse grid via
    #              adapters.copernicus.get_grid — downsampled hard, a full Copernicus
    #              grid is far too heavy for Leaflet on a phone.
    logger.info("layers: %s is not implemented yet — returning an empty collection", layer.value)
    return EMPTY
