"""Static boundary polygons: EEZ, IMBL, Marine Protected Areas.

Owner: B (with E) · Phase: P0
Sources: Marine Regions (EEZ v11/v12), Protected Planet (WDPA)

Downloaded once by ``scripts/download_geojson.py`` into ``data/geojson/`` (gitignored —
WDPA prohibits redistribution), loaded into shapely geometries **at application startup**
and held in memory. These change on a scale of years; there is no reason to re-read them
per request.

A missing file is a normal state during development, not a crash: ``load_all`` logs
exactly which files are absent and names the script that fetches them, and the geofencing
agent then reports the check as skipped rather than silently reporting "all clear".
"""

from __future__ import annotations

import json
import logging
from typing import Any

from shapely.geometry import shape
from shapely.ops import unary_union

from app.config import get_settings

logger = logging.getLogger(__name__)

ATTRIBUTION_EEZ = "Maritime boundaries © Flanders Marine Institute (Marine Regions)"
ATTRIBUTION_WDPA = "Protected area data © UNEP-WCMC and IUCN, Protected Planet (WDPA)"

EEZ_FILE = "india_eez.geojson"
IMBL_FILE = "india_imbl.geojson"
MPA_FILE = "india_mpa.geojson"

FILES = {"eez": EEZ_FILE, "imbl": IMBL_FILE, "mpa": MPA_FILE}

_geometries: dict[str, Any] = {}
_collections: dict[str, dict] = {}
_loaded = False


class BoundaryDataMissing(FileNotFoundError):
    """Raised when a boundary layer is requested but was never downloaded."""


def load_all() -> None:
    """Load every boundary file into shapely geometries. Called once at startup."""
    global _loaded
    settings = get_settings()
    directory = settings.geojson_dir

    missing = []
    for key, filename in FILES.items():
        path = directory / filename
        if not path.exists():
            missing.append(filename)
            continue

        try:
            collection = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("geojson_store: could not read %s (%s)", path, exc)
            continue

        features = collection.get("features") or []
        shapes = []
        for feature in features:
            try:
                shapes.append(shape(feature["geometry"]))
            except (KeyError, TypeError, ValueError) as exc:
                logger.debug("geojson_store: skipping bad feature in %s (%s)", filename, exc)

        if not shapes:
            logger.warning("geojson_store: %s contains no usable geometry", filename)
            continue

        # unary_union keeps India's EEZ as the multi-polygon it is — mainland, Andaman &
        # Nicobar and Lakshadweep are separate bodies, and keeping only the largest would
        # silently place every island query outside Indian waters.
        _geometries[key] = unary_union(shapes)
        _collections[key] = collection
        logger.info(
            "geojson_store: loaded %s (%d features)", filename, len(features)
        )

    if missing:
        logger.warning(
            "geojson_store: %s not found in %s — geofencing will report as skipped. "
            "Run `python scripts/download_geojson.py` to fetch them.",
            ", ".join(missing),
            directory,
        )

    _loaded = True


def is_loaded(name: str) -> bool:
    """True when this layer's geometry is in memory."""
    return name in _geometries


def available_layers() -> list[str]:
    """Which boundary layers actually loaded."""
    return sorted(_geometries)


def get_geometry(name: str) -> Any:
    """Return a loaded geometry collection by name ('eez', 'imbl', 'mpa').

    Returns None when the layer was never loaded, so callers can skip the check rather
    than fail the run.
    """
    if not _loaded:
        load_all()
    return _geometries.get(name)


def require_geometry(name: str) -> Any:
    """Like ``get_geometry`` but raises with the fix, for the layers endpoint."""
    geometry = get_geometry(name)
    if geometry is None:
        raise BoundaryDataMissing(
            f"boundary layer '{name}' ({FILES.get(name, '?')}) is not in "
            f"{get_settings().geojson_dir}. Run `python scripts/download_geojson.py` "
            f"to download it."
        )
    return geometry


def as_geojson(name: str, bbox: tuple[float, float, float, float] | None = None) -> dict:
    """Serve a boundary layer to the frontend, clipped to a bbox and simplified.

    The full Indian EEZ polygon is several MB — unusable on a phone, which is the actual
    target device. Clipping to the viewport and simplifying keeps it renderable.
    """
    geometry = require_geometry(name)

    if bbox is not None:
        from shapely.geometry import box

        lon_min, lat_min, lon_max, lat_max = bbox
        try:
            geometry = geometry.intersection(box(lon_min, lat_min, lon_max, lat_max))
        except Exception as exc:  # noqa: BLE001 - a clip failure should not 500
            logger.warning("geojson_store: bbox clip of %s failed (%s)", name, exc)

    if geometry.is_empty:
        return {"type": "FeatureCollection", "features": []}

    # ~0.01° ≈ 1 km. Far finer than anything visible at the zoom levels a phone uses,
    # and it cuts the payload by an order of magnitude.
    simplified = geometry.simplify(0.01, preserve_topology=True)

    from shapely.geometry import mapping

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": mapping(simplified),
                "properties": {
                    "layer": name,
                    "source": ATTRIBUTION_WDPA if name == "mpa" else ATTRIBUTION_EEZ,
                },
            }
        ],
    }
