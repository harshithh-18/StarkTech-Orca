"""FastAPI application entry point.

Owner: B · Phase: P0

    uvicorn app.main:app --reload --app-dir backend

The API layer holds no business logic — it validates, delegates to the graph, and
serialises. See docs/ARCHITECTURE.md.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings

__version__ = "0.2.0-p1"

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown.

    Expensive costs are paid ONCE here, not per request:
      - load EEZ / IMBL / MPA GeoJSON into shapely geometries
      - compile the LangGraph supervisor and open the checkpointer
    """
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.orca_log_level.upper(), logging.INFO),
        format="%(levelname)s %(name)s: %(message)s",
    )

    from app.adapters import geojson_store
    from app.graph.builder import init_graph

    # Boundary polygons: missing files are logged with the fix, never fatal.
    geojson_store.load_all()

    await init_graph()

    if settings.orca_use_mock_data:
        logger.warning("ORCA_USE_MOCK_DATA is ON — serving canned responses from data/mock/")

    logger.info("ORCA %s ready", __version__)
    yield

    from app.adapters.base import close_client
    from app.graph.builder import close_graph

    await close_client()
    await close_graph()
    logger.info("ORCA shut down cleanly")


def create_app() -> FastAPI:
    """Build the ORCA application."""
    settings = get_settings()

    app = FastAPI(
        title="ORCA",
        description="Marine EcOsystem Reasoning with Collaborative Agents",
        version=__version__,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.api import routes_health, routes_layers, routes_query, ws_trace

    app.include_router(routes_health.router)
    app.include_router(routes_query.router)
    app.include_router(routes_layers.router)
    app.include_router(ws_trace.router)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request, exc: HTTPException):
        """Emit the contract's error body shape.

        Routes raise HTTPException with an already-shaped ErrorResponse dict; anything
        else (a 404, a validation error) gets wrapped into the same shape so the frontend
        has exactly one error format to parse.
        """
        if isinstance(exc.detail, dict) and "error" in exc.detail:
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": str(exc.detail),
                    "hint": None,
                }
            },
        )

    return app


app = create_app()
