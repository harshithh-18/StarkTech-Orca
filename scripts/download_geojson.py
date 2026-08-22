"""Download the boundary polygons used for geofencing.

Owner: E · Phase: P0

    python scripts/download_geojson.py

Fetches into ``data/geojson/``:

  - India EEZ + maritime boundaries  — Marine Regions (EEZ v11/v12)
  - International Maritime Boundary Line — Marine Regions
  - Marine Protected Areas           — Protected Planet (WDPA)

Powers golden query #3. Run once in P0.

⚠️ Marine Regions and WDPA may both require accepting terms or a manual download step. If
the automated fetch fails, download by hand and drop the files in with the expected names —
say so at standup rather than leaving the directory silently empty.
"""

from __future__ import annotations

import argparse

MARINE_REGIONS_URL = "https://www.marineregions.org/downloads.php"
PROTECTED_PLANET_URL = "https://www.protectedplanet.net/en/thematic-areas/marine-protected-areas"

OUTPUTS = {
    "eez": "india_eez.geojson",
    "imbl": "india_imbl.geojson",
    "mpa": "india_mpa.geojson",
}


def download_eez(out_dir: str) -> None:
    """India EEZ polygon.

    TODO(P0, E): download, filter to India, write india_eez.geojson
    TODO(P0, E): India's EEZ is MULTI-polygon — mainland, Andaman & Nicobar, and
                 Lakshadweep are separate. Do not keep only the largest one.
    TODO(P1, E): also write a simplified version for the frontend; the full polygon is
                 several MB and unusable on a phone
    """
    raise NotImplementedError("TODO(P0, E)")


def download_imbl(out_dir: str) -> None:
    """International Maritime Boundary Line.

    The most consequential boundary in the product — crossing it is what gets boats
    detained. Verify the geometry visually before trusting it.

    TODO(P0, E)
    """
    raise NotImplementedError("TODO(P0, E)")


def download_mpa(out_dir: str) -> None:
    """Marine Protected Areas in Indian waters.

    TODO(P0, E): filter WDPA to India + marine designation
    TODO(P0, E): WDPA prohibits redistribution — keep it gitignored, never commit
    """
    raise NotImplementedError("TODO(P0, E)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", default="data/geojson")
    parser.add_argument("--only", choices=list(OUTPUTS), default=None)
    parser.parse_args()

    # TODO(P0, E): run the downloads and print a point-in-polygon sanity check —
    #              a point in the Bay of Bengal must be inside the EEZ, one in the
    #              mid-Indian Ocean must not
    raise NotImplementedError("TODO(P0, E)")


if __name__ == "__main__":
    main()
