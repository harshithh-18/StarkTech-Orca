"""Static boundary polygons: EEZ, IMBL, Marine Protected Areas.

Owner: B (with E) · Phase: P0
Sources: Marine Regions (EEZ v11/v12), Protected Planet (WDPA)

Downloaded once by ``scripts/download_geojson.py`` into ``data/geojson/`` (gitignored —
WDPA prohibits redistribution), loaded into shapely geometries **at application startup**
and held in memory. These change on a scale of years; there is no reason to re-read them
per request.
"""

from __future__ import annotations

from typing import Any

ATTRIBUTION_EEZ = "Maritime boundaries © Flanders Marine Institute (Marine Regions)"
ATTRIBUTION_WDPA = "Protected area data © UNEP-WCMC and IUCN, Protected Planet (WDPA)"

EEZ_FILE = "india_eez.geojson"
IMBL_FILE = "india_imbl.geojson"
MPA_FILE = "india_mpa.geojson"

_geometries: dict[str, Any] = {}


def load_all() -> None:
    """Load every boundary file into shapely geometries. Called once at startup.

    TODO(P0, E): read the three files from settings.geojson_dir into _geometries
    TODO(P0, E): if a file is missing, name scripts/download_geojson.py in the error —
                 don't make a teammate guess why geofencing is empty
    TODO(P1, E): build an STRtree index; a linear scan over WDPA polygons per request will
                 be noticeably slow
    """
    raise NotImplementedError("TODO(P0, E)")


def get_geometry(name: str) -> Any:
    """Return a loaded geometry collection by name ('eez', 'imbl', 'mpa').

    TODO(P0, E)
    """
    raise NotImplementedError("TODO(P0, E)")


def as_geojson(name: str, bbox: tuple[float, float, float, float] | None = None) -> dict:
    """Serve a boundary layer to the frontend, clipped to a bbox.

    TODO(P1, B): clip to bbox and SIMPLIFY before sending. The full Indian EEZ polygon is
                 several MB — unusable on a phone, which is the actual target device.
    """
    raise NotImplementedError("TODO(P1, B)")
