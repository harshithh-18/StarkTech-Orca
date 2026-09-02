"""Download the boundary polygons used for geofencing.

Owner: E · Phase: P0

    python scripts/download_geojson.py

Produces in ``data/geojson/``:

  - ``india_eez.geojson``   India EEZ  — Marine Regions (EEZ v12)
  - ``india_imbl.geojson``  International Maritime Boundary Line — Marine Regions
  - ``india_mpa.geojson``   Marine Protected Areas — Protected Planet (WDPA)

Powers golden query #3.

## Both sources require a manual download step

Neither Marine Regions nor Protected Planet offers an unauthenticated direct link: both
put the file behind a short form and a terms checkbox. So this script does not pretend to
automate the fetch — it tells you exactly what to download, then **converts and filters
whatever you drop into the input directory** into the three files the app expects.

### 1. Marine Regions — EEZ and IMBL

  1. https://www.marineregions.org/downloads.php → *Maritime Boundaries*
  2. Take **World EEZ v12** (GeoJSON or shapefile). The form wants a name, email and
     organisation, then reveals the link.
  3. Drop the downloaded file (.geojson, .json, .zip or .shp) into ``data/geojson/raw/``.

### 2. Protected Planet — Marine Protected Areas

  1. https://www.protectedplanet.net/country/IND → **Download** → accept the terms
  2. Drop the zip into ``data/geojson/raw/``.

Then run this script again and it will filter to India, keep the marine designations, and
write the three output files.

⚠️ **WDPA prohibits redistribution.** ``data/`` is gitignored — never commit these.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

MARINE_REGIONS_URL = "https://www.marineregions.org/downloads.php"
PROTECTED_PLANET_URL = "https://www.protectedplanet.net/country/IND"

OUTPUTS = {
    "eez": "india_eez.geojson",
    "imbl": "india_imbl.geojson",
    "mpa": "india_mpa.geojson",
}

# Property names that identify India across the two products' differing schemas.
_INDIA_FIELDS = ("SOVEREIGN1", "TERRITORY1", "GEONAME", "ISO_SOV1", "ISO3", "PARENT_ISO")
_INDIA_VALUES = {"india", "ind"}


def _looks_indian(properties: dict) -> bool:
    for field in _INDIA_FIELDS:
        value = properties.get(field)
        if value and str(value).strip().casefold() in _INDIA_VALUES:
            return True
    return False


def _is_marine(properties: dict) -> bool:
    """WDPA marks marine areas in a MARINE field: '1' partial, '2' fully marine."""
    marine = properties.get("MARINE")
    return marine is not None and str(marine).strip() in {"1", "2", "true", "True"}


def _read_features(path: Path) -> list[dict]:
    """Load features from GeoJSON, a shapefile, or a zip, using whatever is installed."""
    suffix = path.suffix.casefold()

    if suffix in {".geojson", ".json"}:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("features", [])

    # Shapefiles and zips go through geopandas, which is already a dependency.
    try:
        import geopandas as gpd
    except ImportError:
        sys.exit(f"reading {path.name} needs geopandas: pip install -r backend/requirements.txt")

    frame = gpd.read_file(f"zip://{path}" if suffix == ".zip" else str(path))
    # The whole stack assumes WGS84 lon/lat; a projected CRS would put shapely distances
    # in metres-of-something and silently corrupt every geofence check.
    if frame.crs is not None and frame.crs.to_epsg() != 4326:
        frame = frame.to_crs(epsg=4326)
    return json.loads(frame.to_json())["features"]


def _write(features: list[dict], path: Path, label: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}),
        encoding="utf-8",
    )
    size_mb = path.stat().st_size / 1_048_576
    print(f"  ✓ {label:6} {path.name:22} {len(features):5} features  {size_mb:6.1f} MB")


def convert(raw_dir: Path, out_dir: Path) -> dict[str, int]:
    """Filter whatever is in raw_dir into the three files the app expects."""
    written: dict[str, int] = {}

    sources = [p for p in raw_dir.iterdir() if p.suffix.casefold() in
               {".geojson", ".json", ".zip", ".shp"}] if raw_dir.exists() else []

    if not sources:
        return written

    for path in sources:
        print(f"\nreading {path.name}…")
        try:
            features = _read_features(path)
        except Exception as exc:  # noqa: BLE001
            print(f"  ! could not read {path.name}: {exc}")
            continue

        indian = [f for f in features if _looks_indian(f.get("properties") or {})]
        print(f"  {len(features)} features, {len(indian)} Indian")
        if not indian:
            continue

        marine = [f for f in indian if _is_marine(f.get("properties") or {})]

        if marine:
            # A MARINE field means this is WDPA.
            _write(marine, out_dir / OUTPUTS["mpa"], "mpa")
            written["mpa"] = len(marine)
            continue

        # Otherwise Marine Regions: polygons are the EEZ, lines are the boundary.
        polygons = [f for f in indian
                    if (f.get("geometry") or {}).get("type", "").endswith("Polygon")]
        lines = [f for f in indian
                 if "LineString" in (f.get("geometry") or {}).get("type", "")]

        if polygons:
            # India's EEZ is MULTI-polygon — mainland, Andaman & Nicobar and Lakshadweep
            # are separate bodies. Keeping only the largest would put every island query
            # outside Indian waters.
            _write(polygons, out_dir / OUTPUTS["eez"], "eez")
            written["eez"] = len(polygons)
        if lines:
            _write(lines, out_dir / OUTPUTS["imbl"], "imbl")
            written["imbl"] = len(lines)

    return written


def sanity_check(out_dir: Path) -> None:
    """A point in the Bay of Bengal must be inside the EEZ; mid-ocean must not."""
    eez_path = out_dir / OUTPUTS["eez"]
    if not eez_path.exists():
        return

    try:
        from shapely.geometry import Point, shape
        from shapely.ops import unary_union
    except ImportError:
        return

    data = json.loads(eez_path.read_text(encoding="utf-8"))
    geometry = unary_union([shape(f["geometry"]) for f in data["features"]])

    inside = Point(82.5, 16.5)     # Bay of Bengal off Kakinada
    outside = Point(70.0, -20.0)   # mid Indian Ocean, far south

    print("\nsanity check")
    print(f"  Bay of Bengal (82.5E, 16.5N) inside EEZ: {geometry.contains(inside)}  (expect True)")
    print(f"  mid-ocean     (70.0E, 20.0S) inside EEZ: {geometry.contains(outside)}  (expect False)")


def print_instructions(raw_dir: Path) -> None:
    print("\nNothing to convert — no source files found in:")
    print(f"  {raw_dir}\n")
    print("Both sources need a manual download (each is behind a terms form):\n")
    print("  1. EEZ + IMBL — Marine Regions")
    print(f"     {MARINE_REGIONS_URL}")
    print("     → Maritime Boundaries → World EEZ v12 (GeoJSON or shapefile)\n")
    print("  2. Marine Protected Areas — Protected Planet (WDPA)")
    print(f"     {PROTECTED_PLANET_URL}")
    print("     → Download → accept the terms\n")
    print(f"Drop the downloaded files into {raw_dir} and run this script again.")
    print("It will filter to India and write india_eez / india_imbl / india_mpa.geojson.\n")
    print("⚠️  WDPA prohibits redistribution — data/ is gitignored, never commit these.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--out-dir", default=str(REPO_ROOT / "data" / "geojson"))
    parser.add_argument("--raw-dir", default=None,
                        help="where the manually-downloaded files are (default: <out-dir>/raw)")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    raw_dir = Path(args.raw_dir) if args.raw_dir else out_dir / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    print("ORCA boundary data")
    print(f"raw input : {raw_dir}")
    print(f"output    : {out_dir}")

    written = convert(raw_dir, out_dir)

    if not written:
        print_instructions(raw_dir)
        raise SystemExit(1)

    sanity_check(out_dir)

    missing = [name for name, filename in OUTPUTS.items() if not (out_dir / filename).exists()]
    if missing:
        print(f"\nStill missing: {', '.join(missing)}. Geofencing will report those as skipped.")
    else:
        print("\nAll three layers present — golden query #3 (geofencing) is now live.")


if __name__ == "__main__":
    main()
