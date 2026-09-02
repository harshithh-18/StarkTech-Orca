"""Fetch the data ORCA needs, if it isn't already on disk.

Owner: B · Phase: P3 (deployment)

    python scripts/bootstrap_data.py

Run at container start. The Copernicus subsets and boundary GeoJSON are gitignored — they
are large, and WDPA prohibits redistribution — so a fresh deploy has neither and every
marine query would degrade. This fetches whatever is missing and leaves whatever is
already there alone, so restarts are fast and re-deploys are cheap.

**Idempotent and non-fatal.** If a source can't be reached the app still starts; the
affected agent reports a visible `skipped` step naming the fix, exactly as it does
locally. A deploy that boots degraded is far better than one that crash-loops.

## What it fetches

  - Copernicus SST + chlorophyll subsets  → queries #1 and #4
  - Marine Regions EEZ + IMBL             → query #3
  - RAG knowledge base                    → general marine questions

Not fetched: WDPA protected areas, which require accepting a licence in a browser. Their
absence costs the MPA breach alert and nothing else.
"""

from __future__ import annotations

import argparse
import logging
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

logger = logging.getLogger("bootstrap")

# Smaller than the local default. A hosted instance needs enough history for the
# productivity trend, not the full research window — and every megabyte is cold-start
# time on a free tier.
DEFAULT_DAYS_BACK = 45


def _run(description: str, command: list[str]) -> bool:
    """Run a step, reporting rather than raising. Returns True on success."""
    print(f"\n── {description}")
    try:
        result = subprocess.run(
            command,
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=1800,
            # Explicitly not raising: the return code is inspected below and a failed
            # fetch must leave the app booting, not abort the container.
            check=False,
        )
    except subprocess.TimeoutExpired:
        print("   ✗ timed out after 30 min — continuing without it")
        return False
    except Exception as exc:  # noqa: BLE001
        print(f"   ✗ {exc} — continuing without it")
        return False

    if result.returncode == 0:
        print("   ✓ done")
        return True

    tail = (result.stderr or result.stdout or "").strip().splitlines()[-3:]
    print(f"   ✗ exit {result.returncode} — continuing without it")
    for line in tail:
        print(f"     {line[:120]}")
    return False


def copernicus_present() -> bool:
    from app.config import get_settings

    directory = get_settings().copernicus_dir
    return (directory / "bay_of_bengal_sst.nc").exists() and (
        directory / "bay_of_bengal_chl.nc"
    ).exists()


def boundaries_present() -> bool:
    from app.config import get_settings

    directory = get_settings().geojson_dir
    return (directory / "india_eez.geojson").exists()


def knowledge_present() -> bool:
    from app.rag import store

    return store.available()


def bootstrap(days_back: int, force: bool = False) -> dict[str, bool]:
    """Fetch everything missing. Returns what is present afterwards."""
    python = sys.executable
    status: dict[str, bool] = {}

    # ── Copernicus ────────────────────────────────────────────────────────
    if copernicus_present() and not force:
        print("\n── Copernicus subsets: already present, skipping")
        status["copernicus"] = True
    elif not (os.environ.get("COPERNICUS_USERNAME") and os.environ.get("COPERNICUS_PASSWORD")):
        print(
            "\n── Copernicus subsets: COPERNICUS_USERNAME / COPERNICUS_PASSWORD not set"
            "\n   Queries #1 and #4 will report a visible 'skipped' step."
        )
        status["copernicus"] = False
    else:
        status["copernicus"] = _run(
            f"Copernicus subsets ({days_back} days)",
            [python, "scripts/fetch_copernicus_subset.py", "--days-back", str(days_back)],
        ) and copernicus_present()

    # ── Boundaries ────────────────────────────────────────────────────────
    if boundaries_present() and not force:
        print("\n── Boundary layers: already present, skipping")
        status["boundaries"] = True
    else:
        # Public WFS, no credentials needed.
        status["boundaries"] = _run(
            "Boundary layers (Marine Regions WFS)",
            [python, "scripts/download_geojson.py"],
        ) or boundaries_present()

    # ── Knowledge base ────────────────────────────────────────────────────
    if knowledge_present() and not force:
        print("\n── Knowledge base: already present, skipping")
        status["knowledge"] = True
    else:
        status["knowledge"] = _run(
            "Knowledge base (embeddings download on first run)",
            [python, "-m", "app.rag.ingest"],
        )

    return status


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--days-back", type=int, default=DEFAULT_DAYS_BACK)
    parser.add_argument("--force", action="store_true", help="re-fetch even if present")
    args = parser.parse_args()

    print("ORCA data bootstrap")
    print("=" * 62)
    status = bootstrap(args.days_back, args.force)

    print("\n" + "=" * 62)
    for name, ok in status.items():
        print(f"  {'✓' if ok else '✗'} {name}")

    missing = [name for name, ok in status.items() if not ok]
    if missing:
        print(
            f"\n  Starting anyway without: {', '.join(missing)}."
            f"\n  Affected queries degrade honestly with a visible skipped step."
        )
    else:
        print("\n  All data present — every golden query is live.")

    # Always exit 0: a degraded deploy must still boot.
    raise SystemExit(0)


if __name__ == "__main__":
    main()
