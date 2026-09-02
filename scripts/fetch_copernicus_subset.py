"""Pre-download the Copernicus Marine subsets ORCA reads at runtime.

Owner: E · Phase: P0

    copernicusmarine login                    # free account, once
    python scripts/fetch_copernicus_subset.py

Downloads Bay-of-Bengal + Arabian-Sea slices of SST and chlorophyll-a into
``data/copernicus/``. The app reads these from disk — it never streams NetCDF at request
time, because a 40-second pause on stage is a failed demo even if the data arrives.

Run this once in P0, then again the morning of the demo for fresh data.

## Getting an account (this is the blocker for golden query #1)

1. Register free at https://data.marine.copernicus.eu/register and confirm the email.
2. ``pip install copernicusmarine`` (already in backend/requirements.txt).
3. ``copernicusmarine login`` — it stores credentials in ~/.copernicusmarine/.
   Alternatively put COPERNICUS_USERNAME / COPERNICUS_PASSWORD in .env and this script
   passes them through.
4. Run this script. Expect a few hundred MB and several minutes on a good connection.

Until this runs, ``services/pfz_proxy`` cannot compute zones and the marine agent reports
a visible `skipped` step naming this script. Nothing else in ORCA is blocked by it.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

# ⚠️ subset() takes a DATASET id, not a PRODUCT id. A product contains many datasets, and
# passing the product id fails with "Please check that the dataset exists". The product
# ids are kept alongside because they are what we cite in the evidence attribution.
#
# Resolve these yourself with:
#   copernicusmarine describe --product-id <PRODUCT_ID>
SST_PRODUCT = "SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001"
SST_DATASET = "METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2"

BGC_PRODUCT = "GLOBAL_ANALYSISFORECAST_BGC_001_028"
# The 'pft' (plankton functional types) daily-mean dataset is the one carrying `chl`.
# Its siblings hold nutrients, optics, carbon and zooplankton — none of which we use.
BGC_DATASET = "cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m"

# Indian EEZ plus margin. Keep in sync with app/adapters/copernicus.py BBOX.
BBOX = {"lon_min": 65.0, "lon_max": 95.0, "lat_min": 5.0, "lat_max": 25.0}

# Filenames the adapter expects. Changing one means changing app/adapters/copernicus.py.
SST_FILE = "bay_of_bengal_sst.nc"
CHLOROPHYLL_FILE = "bay_of_bengal_chl.nc"

# Candidate variable names, tried in order — product versions differ.
SST_VARIABLES = ["analysed_sst"]
CHLOROPHYLL_VARIABLES = ["chl"]


def _credentials() -> dict:
    """Pass .env credentials through if present; otherwise rely on `copernicusmarine login`."""
    username = os.environ.get("COPERNICUS_USERNAME", "").strip()
    password = os.environ.get("COPERNICUS_PASSWORD", "").strip()
    if username and password:
        return {"username": username, "password": password}
    return {}


def _subset(dataset_id, variables, out_dir, filename, days_back, depth_surface_only):
    import copernicusmarine

    # UTC explicitly: the products are published on UTC days, and a local-midnight
    # "today" can ask for a date the dataset does not have yet.
    #
    # End yesterday, not today: these are near-real-time products and the latest UTC day
    # is typically not published yet. Asking for it prints an alarming "your subset
    # selection exceeds the dataset coordinates" warning for no benefit.
    end = datetime.now(timezone.utc).date() - timedelta(days=1)
    start = end - timedelta(days=days_back)

    kwargs = dict(
        dataset_id=dataset_id,
        variables=variables,
        minimum_longitude=BBOX["lon_min"],
        maximum_longitude=BBOX["lon_max"],
        minimum_latitude=BBOX["lat_min"],
        maximum_latitude=BBOX["lat_max"],
        start_datetime=f"{start.isoformat()}T00:00:00",
        end_datetime=f"{end.isoformat()}T00:00:00",
        output_directory=str(out_dir),
        output_filename=filename,
        overwrite=True,
        **_credentials(),
    )
    if depth_surface_only:
        # Surface only. The full water column is far more data than we need and slow.
        kwargs["minimum_depth"] = 0.0
        kwargs["maximum_depth"] = 1.0

    print(f"  dataset  {dataset_id}")
    print(f"  vars     {variables}")
    print(f"  bbox     lon {BBOX['lon_min']}–{BBOX['lon_max']}, "
          f"lat {BBOX['lat_min']}–{BBOX['lat_max']}")
    print(f"  window   {start} → {end}  ({days_back} days)")

    copernicusmarine.subset(**kwargs)


def fetch_sst(days_back: int, out_dir: Path) -> None:
    """Download the OSTIA SST subset.

    ~90 days back by default: golden query #4 needs a trend, not a snapshot.
    """
    print(f"\nSST → {out_dir / SST_FILE}")
    _subset(SST_DATASET, SST_VARIABLES, out_dir, SST_FILE, days_back, False)


def fetch_chlorophyll(days_back: int, out_dir: Path) -> None:
    """Download the BGC chlorophyll-a subset (surface depth only)."""
    print(f"\nChlorophyll → {out_dir / CHLOROPHYLL_FILE}")
    _subset(BGC_DATASET, CHLOROPHYLL_VARIABLES, out_dir, CHLOROPHYLL_FILE, days_back, True)


def report(out_dir: Path) -> None:
    """Print what landed, so a partial download is obvious rather than silent."""
    print("\n" + "─" * 66)
    ok = True
    for filename, label in ((SST_FILE, "SST"), (CHLOROPHYLL_FILE, "chlorophyll")):
        path = out_dir / filename
        if path.exists():
            size_mb = path.stat().st_size / 1_048_576
            print(f"  ✓ {label:12} {path.name:28} {size_mb:8.1f} MB")
        else:
            ok = False
            print(f"  ✗ {label:12} {filename:28} MISSING")

    if ok:
        print("\nBoth subsets are in place — the PFZ proxy (golden query #1) is now live.")
        print("Verify with:  curl 'localhost:8000/api/layers/pfz_zones?lat=16.99&lon=82.24'")
    else:
        print("\nSomething did not download. ORCA still runs; the marine agent will")
        print("report a visible 'skipped' step until both files exist.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--days-back", type=int, default=90,
                        help="history window; query #4 needs a trend (default: 90)")
    parser.add_argument("--out-dir", default=str(REPO_ROOT / "data" / "copernicus"))
    parser.add_argument("--sst-only", action="store_true")
    parser.add_argument("--chl-only", action="store_true")
    args = parser.parse_args()

    try:
        import copernicusmarine  # noqa: F401
    except ImportError:
        sys.exit(
            "copernicusmarine is not installed.\n"
            "  pip install -r backend/requirements.txt"
        )

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Copernicus Marine subset download")
    print(f"output: {out_dir}")

    try:
        if not args.chl_only:
            fetch_sst(args.days_back, out_dir)
        if not args.sst_only:
            fetch_chlorophyll(args.days_back, out_dir)
    except Exception as exc:
        print(f"\nDownload failed: {exc}\n")
        print("Most common causes:")
        print("  • Not logged in        → run `copernicusmarine login`")
        print("  • No account yet       → https://data.marine.copernicus.eu/register")
        print("  • 'dataset does not exist' → you may be passing a PRODUCT id where a")
        print("    DATASET id is required. List a product's datasets with:")
        print(f"      copernicusmarine describe --product-id {SST_PRODUCT}")
        print("  • Requested window predates the dataset → try a smaller --days-back")
        report(out_dir)
        raise SystemExit(1) from exc

    report(out_dir)


if __name__ == "__main__":
    main()
