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

    return {
        "status": "ok",
        "using_mock_data": settings.orca_use_mock_data,
        "llm": {
            "available": llm.available(),
            "providers": llm.providers(),
        },
        "boundary_layers": geojson_store.available_layers(),
        "copernicus_subsets": copernicus_files,
        "notes": _notes(geojson_store.available_layers(), copernicus_files, llm.available()),
    }


def _notes(layers: list[str], subsets: list[str], has_llm: bool) -> list[str]:
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
    if not has_llm:
        notes.append(
            "No LLM key configured: running on the deterministic path. Answers are "
            "correct but in English only. Set GEMINI_API_KEY or GROQ_API_KEY in .env."
        )
    if not notes:
        notes.append("All data sources and the LLM are configured.")
    return notes
