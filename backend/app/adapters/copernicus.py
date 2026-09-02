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

A missing subset is a normal state until the account is set up: every entry point raises
``CopernicusDataMissing`` naming the fetch script, and the marine agent turns that into a
visible `skipped` trace step.
"""

from __future__ import annotations

import logging
from pathlib import Path

from app.config import get_settings
from app.schemas.response import Evidence, Location

logger = logging.getLogger(__name__)

CACHE_TTL = 86_400
ATTRIBUTION = "Generated using E.U. Copernicus Marine Service Information"

# Product ids — what we cite in the evidence `source` string, because the product is the
# citable unit in Copernicus documentation.
SST_DATASET = "SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001"
BGC_DATASET = "GLOBAL_ANALYSISFORECAST_BGC_001_028"

# Dataset ids — what scripts/fetch_copernicus_subset.py actually downloads. A product
# contains many datasets and `copernicusmarine subset` needs the dataset id, so these two
# levels are not interchangeable. Kept here so both places stay in sync.
SST_DATASET_ID = "METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2"
BGC_DATASET_ID = "cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m"

SST_FILE = "bay_of_bengal_sst.nc"
CHLOROPHYLL_FILE = "bay_of_bengal_chl.nc"

# Indian EEZ plus margin — keep in sync with scripts/fetch_copernicus_subset.py
BBOX = {"lon_min": 65.0, "lon_max": 95.0, "lat_min": 5.0, "lat_max": 25.0}

# Variable names as the products publish them. Listed as candidates because the exact
# name varies between product versions, and guessing wrong reads as "no data".
SST_VARIABLES = ("analysed_sst", "sst", "thetao")
CHLOROPHYLL_VARIABLES = ("chl", "CHL", "chlorophyll")

_datasets: dict[str, object] = {}


class CopernicusDataMissing(FileNotFoundError):
    """The NetCDF subset has not been downloaded yet."""


def _open(filename: str, label: str):
    """Open a local NetCDF subset, caching the handle for the process lifetime."""
    if filename in _datasets:
        return _datasets[filename]

    path: Path = get_settings().copernicus_dir / filename
    if not path.exists():
        raise CopernicusDataMissing(
            f"{label} subset not found at {path}. Register free at "
            f"data.marine.copernicus.eu/register, then run "
            f"`python scripts/fetch_copernicus_subset.py` to download it."
        )

    import xarray as xr

    dataset = xr.open_dataset(path)
    _datasets[filename] = dataset
    logger.info("copernicus: opened %s (%s)", filename, label)
    return dataset


def _pick_variable(dataset, candidates: tuple[str, ...], label: str) -> str:
    """Find the data variable, tolerating naming differences between product versions."""
    for name in candidates:
        if name in dataset.variables:
            return name
    raise CopernicusDataMissing(
        f"no recognised {label} variable in the subset (looked for {candidates}, "
        f"found {list(dataset.data_vars)})"
    )


def open_sst(date: str | None = None):
    """Open the local OSTIA SST subset as an xarray Dataset."""
    return _open(SST_FILE, "SST")


def open_chlorophyll(date: str | None = None):
    """Open the local BGC chlorophyll subset as an xarray Dataset."""
    return _open(CHLOROPHYLL_FILE, "chlorophyll")


def _coord_names(dataset) -> tuple[str, str]:
    """Latitude/longitude coordinate names, which differ across products."""
    lat = next((n for n in ("latitude", "lat", "nav_lat") if n in dataset.coords), None)
    lon = next((n for n in ("longitude", "lon", "nav_lon") if n in dataset.coords), None)
    if lat is None or lon is None:
        raise CopernicusDataMissing(
            f"subset has no recognisable lat/lon coordinates (found {list(dataset.coords)})"
        )
    return lat, lon


def _sample(dataset, variable: str, lat: float, lon: float) -> float | None:
    """Nearest-neighbour point sample, returning None over land (NaN)."""
    import numpy as np

    lat_name, lon_name = _coord_names(dataset)
    selection = dataset[variable].sel({lat_name: lat, lon_name: lon}, method="nearest")

    # Collapse any remaining dimension (usually time) to the most recent value.
    while selection.ndim > 0:
        selection = selection.isel({selection.dims[0]: -1})

    value = float(selection.values)
    if np.isnan(value):
        return None
    return value


async def get_sst_at(lat: float, lon: float, date: str | None = None) -> Evidence:
    """Point-sample SST from the gridded subset."""
    dataset = open_sst(date)
    variable = _pick_variable(dataset, SST_VARIABLES, "SST")
    value = _sample(dataset, variable, lat, lon)

    if value is None:
        raise CopernicusDataMissing(
            f"SST is NaN at {lat:.3f},{lon:.3f} — the point is over land or outside the subset"
        )

    # OSTIA publishes kelvin; convert when the magnitude says so rather than trusting the
    # attribute, which is missing in some product versions.
    unit = str(getattr(dataset[variable], "units", "")).lower()
    if "k" == unit.strip() or value > 200:
        value -= 273.15

    return Evidence(
        field="sea_surface_temperature",
        value=round(value, 2),
        unit="°C",
        source=f"Copernicus Marine ({SST_DATASET})",
        location=Location(lat=lat, lon=lon, source="copernicus_grid"),
    )


async def get_chlorophyll_at(lat: float, lon: float, date: str | None = None) -> Evidence:
    """Point-sample chlorophyll-a (mg/m³) from the gridded subset."""
    dataset = open_chlorophyll(date)
    variable = _pick_variable(dataset, CHLOROPHYLL_VARIABLES, "chlorophyll")
    value = _sample(dataset, variable, lat, lon)

    if value is None:
        raise CopernicusDataMissing(
            f"chlorophyll is NaN at {lat:.3f},{lon:.3f} — over land or outside the subset"
        )

    return Evidence(
        field="chlorophyll",
        value=round(value, 3),
        unit="mg/m³",
        source=f"Copernicus Marine ({BGC_DATASET})",
        location=Location(lat=lat, lon=lon, source="copernicus_grid"),
    )


def _latest_2d(array, lat_name: str, lon_name: str, box: dict):
    """Clip to the bbox and collapse to the most recent 2-D (lat, lon) slice."""
    clipped = array.sel(
        {
            lat_name: slice(box["lat_min"], box["lat_max"]),
            lon_name: slice(box["lon_min"], box["lon_max"]),
        }
    )
    # Drop time (and depth, on the BGC product) by taking the latest / shallowest.
    while clipped.ndim > 2:
        clipped = clipped.isel({clipped.dims[0]: -1})
    return clipped


class Grid:
    """A 2-D field with its own coordinate axes.

    SST and chlorophyll ship at different resolutions (0.05° vs 0.25°), and they are
    deliberately NOT regridded onto a common axis here: the SST gradient must be computed
    at native resolution or real ocean fronts — 10–20 km wide — get smeared away by the
    coarser grid. ``services.pfz_proxy`` computes the gradient first, then samples it onto
    the chlorophyll grid.
    """

    def __init__(self, values, lats, lons, unit: str = ""):
        self.values = values
        self.lats = lats
        self.lons = lons
        self.unit = unit

    @property
    def shape(self):
        return self.values.shape

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Grid {self.shape} lat {self.lats.min():.2f}–{self.lats.max():.2f}>"


def load_grids(bbox: dict | None = None) -> tuple[Grid, Grid]:
    """Return (chlorophyll_grid, sst_grid), each on its OWN native axes.

    Deliberately not co-registered — see ``Grid``. Regridding happens in the proxy, after
    the gradient has been computed at full resolution.
    """
    import numpy as np

    box = bbox or BBOX
    chl_ds = open_chlorophyll()
    sst_ds = open_sst()

    chl_var = _pick_variable(chl_ds, CHLOROPHYLL_VARIABLES, "chlorophyll")
    sst_var = _pick_variable(sst_ds, SST_VARIABLES, "SST")

    chl_lat, chl_lon = _coord_names(chl_ds)
    sst_lat, sst_lon = _coord_names(sst_ds)

    chl = _latest_2d(chl_ds[chl_var], chl_lat, chl_lon, box)
    sst = _latest_2d(sst_ds[sst_var], sst_lat, sst_lon, box)

    sst_values = np.asarray(sst.values, dtype=float)
    # OSTIA publishes kelvin. Detect by magnitude rather than trusting the attribute,
    # which is absent in some product versions.
    if np.nanmedian(sst_values) > 200:
        sst_values = sst_values - 273.15

    return (
        Grid(
            np.asarray(chl.values, dtype=float),
            np.asarray(chl[chl_lat].values, dtype=float),
            np.asarray(chl[chl_lon].values, dtype=float),
            "mg/m³",
        ),
        Grid(sst_values, np.asarray(sst[sst_lat].values, dtype=float),
             np.asarray(sst[sst_lon].values, dtype=float), "°C"),
    )


async def get_grid(field: str, bbox: dict | None = None, downsample: int = 4) -> dict:
    """A coarse grid for the frontend heatmap layers.

    Downsampled hard before serialising: a full-resolution Copernicus grid will freeze
    Leaflet on a phone, which is our actual target device.
    """
    import numpy as np

    chl, sst, lats, lons = load_grids(bbox)
    values = chl if field.startswith("chl") else sst

    values = values[::downsample, ::downsample]
    lats = lats[::downsample]
    lons = lons[::downsample]

    points = []
    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            value = values[i, j]
            if np.isnan(value):
                continue
            points.append(
                {"lat": round(float(lat), 3), "lon": round(float(lon), 3),
                 "value": round(float(value), 3)}
            )

    return {
        "field": field,
        "unit": "mg/m³" if field.startswith("chl") else "°C",
        "source": ATTRIBUTION,
        "points": points,
    }
