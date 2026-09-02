"""WebSocket stream for the Reasoning Trace panel.

Owner: B (with D) · Phase: P2

    WS /ws/trace/{session_id} -> stream of TraceEvent

This is the endpoint that makes ORCA *look* agentic. The frontend opens it before posting
the query, then watches steps arrive as each agent completes. Judges cannot see planning
and tool selection unless we show it to them — this is how we show it.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.schemas.response import TraceStep

logger = logging.getLogger(__name__)

router = APIRouter(tags=["trace"])

# session_id -> active WebSocket. In-memory is fine: single process, one demo machine.
_connections: dict[str, WebSocket] = {}


@router.websocket("/ws/trace/{session_id}")
async def trace_socket(websocket: WebSocket, session_id: str) -> None:
    """Hold a connection open for one conversation session."""
    await websocket.accept()

    # A reconnect mid-run replaces the old entry rather than being refused, so the panel
    # recovers instead of going blank.
    previous = _connections.get(session_id)
    if previous is not None:
        logger.info("ws: session %s reconnected, replacing the old socket", session_id)
    _connections[session_id] = websocket
    logger.info("ws: session %s connected (%d open)", session_id, len(_connections))

    try:
        while True:
            # We don't expect client messages; receiving is how we detect a disconnect.
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("ws: session %s disconnected", session_id)
    except Exception as exc:  # noqa: BLE001 - a dead socket is routine, not an error
        logger.debug("ws: session %s closed (%s)", session_id, exc)
    finally:
        # Only drop our own entry: a reconnect may already have replaced it.
        if _connections.get(session_id) is websocket:
            _connections.pop(session_id, None)


async def _send(session_id: str, event_type: str, payload: dict) -> None:
    """Send one frame, swallowing every failure.

    Fire-and-forget by contract: a closed or slow socket can never block or fail an agent
    run. If nobody is listening, the trace still ships in the POST response body.
    """
    websocket = _connections.get(session_id)
    if websocket is None:
        return  # no socket for this session (e.g. a curl caller) — not an error

    try:
        await websocket.send_text(
            json.dumps(
                {"type": event_type, "session_id": session_id, "payload": payload},
                default=str,
            )
        )
    except Exception as exc:  # noqa: BLE001 - never let the socket break a run
        logger.debug("ws: could not send %s to %s (%s)", event_type, session_id, exc)
        _connections.pop(session_id, None)


async def emit_trace(session_id: str, step: TraceStep) -> None:
    """Push one trace step to the session's panel."""
    await _send(session_id, "trace", step.model_dump(mode="json"))


async def emit_answer(session_id: str, response: dict) -> None:
    """Push the final OrcaResponse as a ``type='answer'`` frame.

    The same response also returns on the POST body — that one is authoritative, this is
    for liveness.
    """
    await _send(session_id, "answer", response)


async def emit_error(session_id: str, code: str, message: str) -> None:
    """Push an error frame so the panel can stop spinning."""
    await _send(session_id, "error", {"code": code, "message": message})


def active_sessions() -> list[str]:
    """Session ids with a live socket. Used by /ready."""
    return list(_connections)
