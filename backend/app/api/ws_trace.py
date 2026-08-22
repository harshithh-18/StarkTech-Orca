"""WebSocket stream for the Reasoning Trace panel.

Owner: B (with D) · Phase: P2

    WS /ws/trace/{session_id} -> stream of TraceEvent

This is the endpoint that makes ORCA *look* agentic. The frontend opens it before posting
the query, then watches steps arrive as each agent completes. Judges cannot see planning
and tool selection unless we show it to them — this is how we show it.
"""

from __future__ import annotations

from fastapi import APIRouter, WebSocket

from app.schemas.response import TraceStep

router = APIRouter(tags=["trace"])

# session_id -> active WebSocket. In-memory is fine: single process, one demo machine.
# TODO(P3, B): drop stale entries on disconnect so a long demo doesn't leak sockets.
_connections: dict[str, WebSocket] = {}


@router.websocket("/ws/trace/{session_id}")
async def trace_socket(websocket: WebSocket, session_id: str) -> None:
    """Hold a connection open for one conversation session.

    TODO(P2, B): accept, register in _connections, keep alive until disconnect
    TODO(P3, B): tolerate reconnects mid-run — the panel should recover, not go blank
    """
    raise NotImplementedError("TODO(P2, B): accept and register the connection")


async def emit_trace(session_id: str, step: TraceStep) -> None:
    """Push one trace step to the session's panel.

    Called by graph nodes as they complete. Must be **fire-and-forget**: a closed or slow
    socket can never block or fail the agent run. Swallow the error, log it, move on.

    TODO(P2, B): look up the connection and send TraceEvent(type='trace', ...)
    TODO(P2, B): no-op silently when the session has no socket (e.g. a curl caller)
    """
    raise NotImplementedError("TODO(P2, B): send the trace event")


async def emit_answer(session_id: str, response: dict) -> None:
    """Push the final OrcaResponse as a ``type='answer'`` frame.

    The same response also returns on the POST body — that one is authoritative, this is
    for liveness.

    TODO(P2, B)
    """
    raise NotImplementedError("TODO(P2, B): send the answer event")
