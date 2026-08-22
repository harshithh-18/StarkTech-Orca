"""FastAPI application entry point.

Owner: B · Phase: P0

    uvicorn app.main:app --reload --app-dir backend

The API layer holds no business logic — it validates, delegates to the graph, and
serialises. See docs/ARCHITECTURE.md.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

__version__ = "0.1.0-scaffold"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown.

    On startup we want to pay expensive costs ONCE, not per request:
      - load EEZ / IMBL / MPA GeoJSON into shapely geometries
      - open the Copernicus NetCDF subsets with xarray
      - compile the LangGraph supervisor
      - warm the cache if ORCA_USE_MOCK_DATA is set (demo path)
    """
    # TODO(P0, B): load geojson_store, compile graph, warm cache
    yield
    # TODO(P0, B): close httpx clients, flush cache


def create_app() -> FastAPI:
    """Build the ORCA application.

    TODO(P0, B): add CORSMiddleware from settings.cors_origins
    TODO(P0, B): mount routes_health, routes_query, routes_layers, ws_trace
    TODO(P3, B): exception handlers mapping adapter failures to the ErrorResponse
                 codes in docs/API_CONTRACT.md — a dead data source must never 500
    """
    app = FastAPI(
        title="ORCA",
        description="Marine EcOsystem Reasoning with Collaborative Agents",
        version=__version__,
        lifespan=lifespan,
    )
    return app


app = create_app()
