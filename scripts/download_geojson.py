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

# Marine Regions' own public GeoServer. EEZ and boundary lines come straight from here,
# so those two layers need no manual download at all — only WDPA still does.
WFS_URL = "https://geo.vliz.be/geoserver/MarineRegions/wfs"

OUTPUTS = {
    "eez": "india_eez.geojson",
    "imbl": "india_imbl.geojson",
    "mpa": "india_mpa.geojson",
}

# ── Which boundary lines count as "the IMBL" ──────────────────────────────
# Marine Regions returns 32 line features for India, and they are NOT interchangeable:
#
#   Treaty / Median line / Court ruling  → agreed boundaries with a NEIGHBOURING STATE.
#                                          These are the lines that get boats detained.
#   200 NM                               → the outer edge of the EEZ facing the high seas.
#                                          Crossing it is not an arrest risk, and the
#                                          `inside_eez` check already covers leaving
#                                          Indian waters.
#   Straight baseline                    → the coastal reference line the territorial sea
#                                          is measured FROM. It hugs the shore, so
#                                          including it would put a "boundary" a few km
#                                          from every fishing harbour and fire a proximity
#                                          alert on essentially every query.
#   Connection line                      → cartographic joins between segments.
#
# Only the first group goes into india_imbl.geojson.
IMBL_LINE_TYPES = {"Treaty", "Median line", "Court ruling"}

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


def _wfs_features(type_name: str, cql: str, timeout: int = 240) -> list[dict]:
    """GetFeature against the Marine Regions WFS, returned as GeoJSON features."""
    import urllib.parse
    import urllib.request

    query = urllib.parse.urlencode(
        {
            "service": "WFS",
            "version": "1.0.0",
            "request": "GetFeature",
            "typeName": type_name,
            "outputFormat": "application/json",
            "CQL_FILTER": cql,
        }
    )
    request = urllib.request.Request(
        f"{WFS_URL}?{query}", headers={"User-Agent": "ORCA/0.2 (marine advisory prototype)"}
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))

    # GeoServer reports errors as an XML ServiceExceptionReport, which json.loads would
    # already have rejected — so anything reaching here is well-formed GeoJSON.
    return payload.get("features", [])


def fetch_marine_regions(out_dir: Path) -> dict[str, int]:
    """Download India's EEZ and maritime boundary lines from the public WFS."""
    written: dict[str, int] = {}

    print("\nMarine Regions WFS (public — no form needed)")
    print(f"  {WFS_URL}")

    # ── EEZ polygons ──────────────────────────────────────────────────────
    try:
        print("  fetching EEZ polygons… (a few MB, ~30 s)")
        features = _wfs_features("MarineRegions:eez", "sovereign1='India'")
    except Exception as exc:  # noqa: BLE001
        print(f"  ! EEZ fetch failed: {exc}")
        features = []

    if features:
        for feature in features:
            props = feature.get("properties") or {}
            print(f"     {props.get('geoname','?')[:56]:58} {props.get('area_km2','?')} km²")
        _write(features, out_dir / OUTPUTS["eez"], "eez")
        written["eez"] = len(features)

    # ── Boundary lines ────────────────────────────────────────────────────
    try:
        print("  fetching maritime boundary lines…")
        lines = _wfs_features(
            "MarineRegions:eez_boundaries",
            "sovereign1='India' OR sovereign2='India'",
        )
    except Exception as exc:  # noqa: BLE001
        print(f"  ! boundary fetch failed: {exc}")
        lines = []

    if lines:
        keep = [
            line
            for line in lines
            if (line.get("properties") or {}).get("line_type") in IMBL_LINE_TYPES
        ]
        dropped = len(lines) - len(keep)
        print(
            f"     {len(lines)} lines → keeping {len(keep)} international boundaries, "
            f"dropping {dropped} (200 NM limits, straight baselines, connection lines)"
        )
        for line in keep:
            props = line["properties"]
            print(f"       {str(props.get('line_name'))[:52]:54} {props.get('line_type')}")
        if keep:
            _write(keep, out_dir / OUTPUTS["imbl"], "imbl")
            written["imbl"] = len(keep)

    return written


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


def print_mpa_instructions(raw_dir: Path) -> None:
    """WDPA is the one layer that still needs a human.

    Its licence has to be accepted by the person using the data — not clicked through by
    a script on their behalf.
    """
    print("\nMarine Protected Areas — optional, still manual")
    print(f"  {PROTECTED_PLANET_URL}")
    print("  → Download → accept the terms → drop the zip into:")
    print(f"     {raw_dir}")
    print("  then re-run this script; it filters to India's marine designations.\n")
    print("  ⚠️  WDPA prohibits redistribution — data/ is gitignored, never commit it.")
    print("  Geofencing works without it: EEZ containment and IMBL proximity are the two")
    print("  checks that carry real legal consequence.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--out-dir", default=str(REPO_ROOT / "data" / "geojson"))
    parser.add_argument("--raw-dir", default=None,
                        help="where the manually-downloaded files are (default: <out-dir>/raw)")
    parser.add_argument("--skip-wfs", action="store_true",
                        help="don't hit Marine Regions; only convert files in --raw-dir")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    raw_dir = Path(args.raw_dir) if args.raw_dir else out_dir / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    print("ORCA boundary data")
    print(f"raw input : {raw_dir}")
    print(f"output    : {out_dir}")

    written: dict[str, int] = {}

    # EEZ + IMBL come from the public WFS; no form, no manual step.
    if not args.skip_wfs:
        written.update(fetch_marine_regions(out_dir))

    # Anything dropped in raw/ by hand (WDPA, or a manual EEZ download) is converted too.
    written.update(convert(raw_dir, out_dir))

    if not written:
        print("\nNothing downloaded and nothing to convert.")
        print_mpa_instructions(raw_dir)
        raise SystemExit(1)

    sanity_check(out_dir)

    missing = [name for name, filename in OUTPUTS.items() if not (out_dir / filename).exists()]
    if "mpa" in missing:
        print_mpa_instructions(raw_dir)
    if missing:
        print(f"\nMissing: {', '.join(missing)} — those checks report as skipped.")
    if not missing:
        print("\nAll three layers present — golden query #3 (geofencing) is fully live.")
    elif missing == ["mpa"]:
        print("\nEEZ + IMBL are in place — golden query #3 (geofencing) is live.")


if __name__ == "__main__":
    main()
