"""Conditions dashboard and proactive watches.

Owner: B · Phase: P4

    GET    /api/conditions?lat=&lon=&name=   -> ConditionsSnapshot
    POST   /api/watch                        -> WatchStatus
    GET    /api/watch?session_id=            -> [WatchStatus]
    GET    /api/watch/{watch_id}             -> WatchStatus
    DELETE /api/watch/{watch_id}             -> {"cancelled": bool}

Neither path runs the agent graph: ``/api/conditions`` is a fixed bundle of adapters
reduced through the shared risk rules, and a watch is that same bundle on a timer. See the
module docstrings of ``services/conditions.py`` and ``services/watch.py`` for why.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from app.schemas.conditions import ConditionsSnapshot, WatchRequest, WatchStatus
from app.schemas.response import ErrorDetail, ErrorResponse, Location

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["conditions"])


@router.get(
    "/conditions",
    response_model=ConditionsSnapshot,
    responses={503: {"model": ErrorResponse}},
)
async def conditions(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    name: str | None = None,
) -> ConditionsSnapshot:
    """Live sea, weather and tide conditions at one point.

    Returns 503 only when *both* upstream models are unreachable and nothing is cached —
    one model being down degrades the snapshot (see ``degraded``) rather than failing it.
    """
    from app.adapters import base as adapter_base
    from app.services import conditions as conditions_service

    adapter_base.begin_tier_tracking()

    try:
        snapshot = await conditions_service.snapshot(
            Location(lat=lat, lon=lon, name=name, source="picked")
        )
    except Exception as exc:
        logger.exception("conditions: snapshot failed")
        raise HTTPException(
            status_code=503,
            detail=ErrorResponse(
                error=ErrorDetail(
                    code="CONDITIONS_UNAVAILABLE",
                    message=f"Could not read conditions for this location: {exc}",
                    hint="This point may be inland, or every forecast source may be "
                    "unreachable. Try a coastal location.",
                )
            ).model_dump(),
        ) from exc

    # No tiles at all means no model answered — a snapshot of nothing looks like calm
    # water on the dashboard, which is the one way this endpoint could be dangerous.
    if not snapshot.tiles:
        raise HTTPException(
            status_code=503,
            detail=ErrorResponse(
                error=ErrorDetail(
                    code="CONDITIONS_UNAVAILABLE",
                    message="No forecast model returned data for this location.",
                    hint="; ".join(snapshot.degraded)
                    or "The point may be inland — pick a coastal location.",
                )
            ).model_dump(),
        )

    return snapshot


@router.get("/harbours")
async def harbours() -> list[dict]:
    """India's fishing harbours — the list the location picker is built from.

    Served rather than hard-coded in the frontend so there is one list, not two: the same
    coordinates answer "where can I ask about?" in the picker and "where is the nearest
    coast?" when someone asks about the sea from an inland city.
    """
    from app.services import harbours as harbour_registry

    return harbour_registry.as_payload()


@router.post("/watch", response_model=WatchStatus)
async def create_watch(request: WatchRequest) -> WatchStatus:
    """Register a standing safety watch and run its first check immediately.

    Alerts are pushed over ``WS /ws/trace/{session_id}`` as ``type='alert'`` frames, and
    are also readable from ``GET /api/watch/{id}`` — a client that missed a frame while
    reconnecting can recover the history rather than silently losing a warning.
    """
    from app.services import watch as watch_service

    try:
        return await watch_service.register(request)
    except Exception as exc:
        logger.exception("watch: could not register")
        raise HTTPException(
            status_code=503,
            detail=ErrorResponse(
                error=ErrorDetail(
                    code="WATCH_UNAVAILABLE",
                    message=f"Could not start a watch here: {exc}",
                    hint="A watch needs a coastal or offshore point with forecast cover.",
                )
            ).model_dump(),
        ) from exc


@router.get("/watch", response_model=list[WatchStatus])
async def list_watches(session_id: str | None = None) -> list[WatchStatus]:
    """Active watches, optionally filtered to one session."""
    from app.services import watch as watch_service

    return watch_service.list_watches(session_id)


@router.get("/watch/{watch_id}", response_model=WatchStatus)
async def get_watch(watch_id: str) -> WatchStatus:
    """One watch and everything it has raised."""
    from app.services import watch as watch_service

    status = watch_service.get(watch_id)
    if status is None:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error=ErrorDetail(
                    code="WATCH_NOT_FOUND",
                    message="No such watch.",
                    hint="Watches are held in memory and do not survive a restart.",
                )
            ).model_dump(),
        )
    return status


@router.delete("/watch/{watch_id}")
async def delete_watch(watch_id: str) -> dict:
    """Stop a watch. Idempotent — cancelling an unknown watch is not an error."""
    from app.services import watch as watch_service

    return {"cancelled": await watch_service.cancel(watch_id)}
