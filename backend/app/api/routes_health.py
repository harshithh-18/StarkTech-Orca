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
    """Liveness probe.

    TODO(P3, B): add a sibling /ready that reports per-adapter reachability and whether
                 the mock fallback is active — useful on stage to check before demoing.
    """
    raise NotImplementedError("TODO(P0, B): return {'status': 'ok', 'version': ...}")
