"""Health check.

Owner: B · Phase: P0

Deliberately dependency-free so it answers even when every upstream source is down —
it tells you the process is alive, not that the data is.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> dict:
    """Liveness probe. No dependencies, so it answers even when everything else is down."""
    from app.main import __version__

    return {"status": "ok", "version": __version__}


@router.get("/ready")
async def ready() -> dict:
    """Readiness: what is actually wired up right now.

    Worth checking on stage before demoing — it says in one call whether the boundary
    data loaded, whether an LLM key is live, and whether we are serving mocks.
    """
    from app.adapters import geojson_store
    from app.config import get_settings
    from app.services import llm

    settings = get_settings()

    copernicus_files = []
    if settings.copernicus_dir.exists():
        copernicus_files = [p.name for p in settings.copernicus_dir.glob("*.nc")]

    # Present-on-disk is not the same as usable: the subsets are NetCDF, and without a
    # working xarray reader in the *running* interpreter every SST/chlorophyll/PFZ/front
    # layer fails at request time while the files sit right there. Readiness must report
    # what the server can actually serve, not what is merely downloaded — so we try to
    # open one subset here rather than trusting the glob.
    copernicus_readable = _copernicus_readable(settings, copernicus_files)

    return {
        "status": "ok",
        "using_mock_data": settings.orca_use_mock_data,
        "llm": {
            "available": llm.available(),
            "providers": llm.providers(),
        },
        "boundary_layers": geojson_store.available_layers(),
        "copernicus_subsets": copernicus_files,
        "copernicus_readable": copernicus_readable,
        "notes": _notes(
            geojson_store.available_layers(),
            copernicus_files,
            copernicus_readable,
            llm.available(),
        ),
    }


def _copernicus_readable(settings, subsets: list[str]) -> bool | None:
    """Can the running interpreter actually open a Copernicus subset?

    Returns None when there is nothing to open (no subsets downloaded — a separate,
    already-reported state), True when one opens cleanly, and False when the files are
    present but the reader is missing or broken. That False is the signal that used to be
    invisible: files on disk, xarray absent from *this* process, every gridded layer down.
    """
    if not subsets:
        return None
    try:
        import xarray as xr  # noqa: F401

        path = settings.copernicus_dir / subsets[0]
        with xr.open_dataset(path):
            return True
    except Exception:  # ImportError, engine missing, corrupt file — all mean "can't serve"
        return False


def _notes(
    layers: list[str], subsets: list[str], copernicus_readable: bool | None, has_llm: bool
) -> list[str]:
    """Plain-English list of what is missing and how to fix it."""
    notes = []
    if not layers:
        notes.append(
            "No boundary data: geofencing (query #3) will report as skipped. "
            "Run `python scripts/download_geojson.py`."
        )
    if not subsets:
        notes.append(
            "No Copernicus subsets: the PFZ proxy (query #1) will report as skipped. "
            "Run `python scripts/fetch_copernicus_subset.py`."
        )
    elif copernicus_readable is False:
        notes.append(
            "Copernicus subsets are on disk but this server cannot READ them — the "
            "SST, chlorophyll, thermal-front and PFZ layers will all fail. The NetCDF "
            "reader is missing from the running interpreter. Reinstall into the active "
            "venv: `pip install -r backend/requirements.txt` (needs xarray + netCDF4), "
            "and make sure the server runs from that same venv."
        )
    if not has_llm:
        notes.append(
            "No LLM key configured: running on the deterministic path. Answers are "
            "correct but in English only. Set GEMINI_API_KEY or GROQ_API_KEY in .env."
        )
    if not notes:
        notes.append("All data sources and the LLM are configured.")
    return notes
