"""The main query endpoint.

Owner: B · Phase: P1

    POST /api/query   QueryRequest -> OrcaResponse

This is the only route that runs the agent graph. It validates, invokes, and serialises —
no reasoning happens here.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.request import QueryRequest
from app.schemas.response import OrcaResponse

router = APIRouter(prefix="/api", tags=["query"])


@router.post("/query", response_model=OrcaResponse)
async def query(request: QueryRequest) -> OrcaResponse:
    """Run one turn of conversation through the ORCA supervisor graph.

    Flow (docs/ARCHITECTURE.md § "How a query flows"):
      1. build initial OrcaState from the request
      2. invoke the compiled graph with thread_id = request.session_id  (multi-turn memory)
      3. push each TraceStep to the WebSocket for this session as it's emitted
      4. hand the final state to services.explainability to assemble the response

    TODO(P1, B): wire graph.builder.build_graph() and invoke it
    TODO(P1, B): stream trace steps to ws_trace via the session's connection
    TODO(P2, A): pass conversation history so "…and is it safe there?" resolves context
    TODO(P3, B): map adapter/LLM failures onto the ErrorResponse codes in the contract.
                 A missing data source degrades the answer — it never 500s.
    """
    raise NotImplementedError("TODO(P1, B): invoke the supervisor graph")
