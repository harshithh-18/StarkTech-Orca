"""Pre-download the Copernicus Marine subsets ORCA reads at runtime.

Owner: E · Phase: P0

    copernicusmarine login                    # free account, once
    python scripts/fetch_copernicus_subset.py

Downloads Bay-of-Bengal + Arabian-Sea slices of SST and chlorophyll-a into
``data/copernicus/``. The app reads these from disk — it never streams NetCDF at request
time, because a 40-second pause on stage is a failed demo even if the data arrives.

Run this once in P0, then again the morning of the demo for fresh data.
"""

from __future__ import annotations

import argparse

SST_DATASET = "SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001"
BGC_DATASET = "GLOBAL_ANALYSISFORECAST_BGC_001_028"

# Indian EEZ plus margin. Keep in sync with app/adapters/copernicus.py BBOX.
BBOX = {"lon_min": 65.0, "lon_max": 95.0, "lat_min": 5.0, "lat_max": 25.0}


def fetch_sst(days_back: int, out_dir: str) -> None:
    """Download the OSTIA SST subset.

    TODO(P0, E): copernicusmarine.subset(dataset_id=SST_DATASET, **BBOX, ...)
    TODO(P0, E): request ~90 days back — query #4 needs a trend, not a snapshot
    """
    raise NotImplementedError("TODO(P0, E)")


def fetch_chlorophyll(days_back: int, out_dir: str) -> None:
    """Download the BGC chlorophyll-a subset.

    TODO(P0, E): variables=["chl"]; surface depth only — the full water column is far
                 more data than we need and slow to download
    """
    raise NotImplementedError("TODO(P0, E)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days-back", type=int, default=90)
    parser.add_argument("--out-dir", default="data/copernicus")
    parser.add_argument("--sst-only", action="store_true")
    parser.add_argument("--chl-only", action="store_true")
    parser.parse_args()

    # TODO(P0, E): dispatch to fetch_sst / fetch_chlorophyll and print the file sizes
    raise NotImplementedError("TODO(P0, E)")


if __name__ == "__main__":
    main()
