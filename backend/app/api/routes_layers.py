"""GeoJSON map layers.

Owner: B · Phase: P1

    GET /api/layers/{layer} -> GeoJSON FeatureCollection

The frontend asks for a layer by the same enum value the response carries in
``map_layers``, so there is exactly one vocabulary for layers across the stack.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.enums import MapLayer

router = APIRouter(prefix="/api", tags=["layers"])


@router.get("/layers/{layer}")
async def get_layer(
    layer: MapLayer,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: float = 200.0,
) -> dict:
    """Return one map layer as a GeoJSON FeatureCollection.

    Bounded by ``radius_km`` around the point when given — shipping the whole Indian EEZ
    to a phone is not viable, and the fisherman only cares about what's near him.

    Layer sources:
      pfz_zones            adapters.incois_pfz  or  services.pfz_proxy
      eez_boundary/imbl    adapters.geojson_store (Marine Regions)
      mpa_zones            adapters.geojson_store (Protected Planet / WDPA)
      *_heatmap            adapters.copernicus (SST, chlorophyll) / open_meteo_marine (wave)

    TODO(P1, B): serve eez_boundary + pfz_zones from geojson_store
    TODO(P2, E): serve the heatmap layers as a coarse grid — downsample hard, a full
                 Copernicus grid is far too heavy for Leaflet
    TODO(P3, B): cache per (layer, rounded bbox); these barely change within a day
    """
    raise NotImplementedError("TODO(P1, B): return a GeoJSON FeatureCollection")
