"""The main query endpoint.

Owner: B · Phase: P1

    POST /api/query   QueryRequest -> OrcaResponse

This is the only route that runs the agent graph. It validates, invokes, and serialises —
no reasoning happens here.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.agents.base import discard_collector, reset_collector
from app.graph.builder import RECURSION_LIMIT, get_graph
from app.graph.state import PER_TURN_ACCUMULATORS, RESET
from app.schemas.enums import Intent
from app.schemas.request import QueryRequest
from app.schemas.response import ErrorDetail, ErrorResponse, OrcaResponse
from app.services import explainability

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["query"])


@router.post(
    "/query",
    response_model=OrcaResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
async def query(request: QueryRequest) -> OrcaResponse:
    """Run one turn of conversation through the ORCA supervisor graph.

    Flow (docs/ARCHITECTURE.md § "How a query flows"):
      1. build initial OrcaState from the request
      2. invoke the compiled graph with thread_id = request.session_id  (multi-turn memory)
      3. push each TraceStep to the WebSocket for this session as it's emitted
      4. hand the final state to services.explainability to assemble the response
    """
    from app.api.ws_trace import emit_answer, emit_error

    # Fresh collector per turn so seq restarts at 0 and the panel doesn't bleed turns.
    reset_collector(request.session_id)
    # Per-request, so the response credits Bhashini only if it actually translated.
    explainability.begin_translation_tracking()

    initial: dict = {
        "query": request.query,
        "session_id": request.session_id,
        "input_lat": request.lat,
        "input_lon": request.lon,
        "session_context": {},
        # Verdict state is per-turn too, and last-write-wins does not clear a field that
        # this turn's path never writes — a follow-up that isn't a safety question would
        # otherwise inherit the previous turn's verdict.
        "verdict": None,
        "verdict_reasons": [],
        "plan": [],
    }
    # Clear the append-reducer fields so this turn starts clean. The checkpointer keeps
    # the remembered location (that's the multi-turn feature); it must not also keep the
    # previous turn's evidence and trace.
    for field in PER_TURN_ACCUMULATORS:
        initial[field] = RESET

    if request.language is not None:
        initial["language"] = request.language

    config = {
        "configurable": {"thread_id": request.session_id},
        "recursion_limit": RECURSION_LIMIT,
    }

    try:
        graph = get_graph()
        final_state = await graph.ainvoke(initial, config=config)
    except RuntimeError as exc:
        logger.exception("query: graph unavailable")
        await emit_error(request.session_id, "GRAPH_UNAVAILABLE", str(exc))
        raise HTTPException(
            status_code=503,
            detail=ErrorResponse(
                error=ErrorDetail(
                    code="GRAPH_UNAVAILABLE",
                    message="The reasoning graph is not available.",
                    hint="Check the server logs; the app lifespan may have failed to start.",
                )
            ).model_dump(),
        ) from exc
    except Exception as exc:
        # A total graph failure is the one case that is genuinely a 500-class error, but
        # the contract says the client always gets a structured body.
        logger.exception("query: graph run failed")
        await emit_error(request.session_id, "GRAPH_FAILED", str(exc))
        raise HTTPException(
            status_code=503,
            detail=ErrorResponse(
                error=ErrorDetail(
                    code="GRAPH_FAILED",
                    message=f"The reasoning graph failed: {exc}",
                    hint="Retry, or check adapter connectivity in the logs.",
                )
            ).model_dump(),
        ) from exc
    finally:
        discard_collector(request.session_id)

    # A query we could not place is the one case worth a 422 rather than a degraded
    # answer — every specialist needs a point to work from, and guessing one would be
    # worse than asking. General questions don't need a location, so they pass through.
    if final_state.get("location") is None and final_state.get("intent") is not Intent.GENERAL:
        raise HTTPException(
            status_code=422,
            detail=ErrorResponse(
                error=ErrorDetail(
                    code="LOCATION_UNRESOLVED",
                    message="Could not resolve a location from the query.",
                    hint="Ask the user to share GPS or name a port, e.g. 'near Kakinada'.",
                )
            ).model_dump(),
        )

    response = explainability.assemble_response(final_state)

    # Liveness copy on the socket. The POST body above is the authoritative one.
    await emit_answer(request.session_id, response.model_dump(mode="json"))

    return response
