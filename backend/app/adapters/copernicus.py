"""Copernicus Marine — gridded chlorophyll-a and SST.

Owner: B (with E) · Phase: P0
Auth: free account (data.marine.copernicus.eu/register) · Quota: none

    OSTIA SST   SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001
    Global BGC  GLOBAL_ANALYSISFORECAST_BGC_001_028   (chlorophyll-a)

> ## Read from disk, never from the network at request time.
> ``scripts/fetch_copernicus_subset.py`` pre-downloads a Bay-of-Bengal + Arabian-Sea
> subset into ``data/copernicus/``. This adapter opens those files with xarray.
> Streaming NetCDF during a live demo is how you get a 40-second pause on stage.

This is the data that lets ORCA *reason about* fishing zones — chlorophyll plus SST fronts —
rather than echoing a scraped advisory. See services/pfz_proxy.py.
"""

from __future__ import annotations

from app.schemas.response import Evidence

CACHE_TTL = 86_400
ATTRIBUTION = "Generated using E.U. Copernicus Marine Service Information"

SST_DATASET = "SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001"
BGC_DATASET = "GLOBAL_ANALYSISFORECAST_BGC_001_028"

# Indian EEZ plus margin — keep in sync with scripts/fetch_copernicus_subset.py
BBOX = {"lon_min": 65.0, "lon_max": 95.0, "lat_min": 5.0, "lat_max": 25.0}


def open_sst(date: str | None = None):
    """Open the local OSTIA SST subset as an xarray Dataset.

    TODO(P0, E): xr.open_dataset from settings.copernicus_dir
    TODO(P0, E): fail with a clear message naming scripts/fetch_copernicus_subset.py if
                 the file is missing — a new teammate WILL hit this on day one
    """
    raise NotImplementedError("TODO(P0, E)")


def open_chlorophyll(date: str | None = None):
    """Open the local BGC chlorophyll subset as an xarray Dataset.

    TODO(P0, E)
    """
    raise NotImplementedError("TODO(P0, E)")


async def get_sst_at(lat: float, lon: float, date: str | None = None) -> Evidence:
    """Point-sample SST from the gridded subset.

    TODO(P1, E): .sel(..., method='nearest'); handle NaN over land explicitly
    """
    raise NotImplementedError("TODO(P1, E)")


async def get_chlorophyll_at(lat: float, lon: float, date: str | None = None) -> Evidence:
    """Point-sample chlorophyll-a (mg/m³) from the gridded subset.

    TODO(P1, E)
    """
    raise NotImplementedError("TODO(P1, E)")


async def get_grid(field: str, bbox: dict | None = None, downsample: int = 4) -> dict:
    """A coarse grid for the frontend heatmap layers.

    TODO(P2, E): downsample HARD before serialising. A full-resolution Copernicus grid
                 will freeze Leaflet on a phone — which is our actual target device.
    """
    raise NotImplementedError("TODO(P2, E)")
