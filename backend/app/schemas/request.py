"""Inbound request schema.

Owner: C · Phase: P0 · Status: 🔒 FROZEN after Day 3

Mirrored in ``frontend/src/types/orca.ts``. See docs/API_CONTRACT.md.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.enums import Language


class QueryRequest(BaseModel):
    """One turn of conversation.

    ``session_id`` does double duty: it keys the LangGraph checkpointer (so
    "…and is it safe there?" can resolve the previous turn's location) and it addresses
    the WebSocket trace stream. The client generates it and opens the socket BEFORE
    posting, so no trace steps are missed.
    """

    query: str = Field(..., min_length=1, max_length=1000, description="Raw text, any language")
    session_id: str = Field(..., description="Client-generated UUID; keys memory + trace socket")

    lat: float | None = Field(None, ge=-90, le=90, description="Device GPS, if granted")
    lon: float | None = Field(None, ge=-180, le=180)

    language: Language | None = Field(
        None, description="Override. None ⇒ auto-detect, which is the normal path."
    )
    reply_with_audio: bool = Field(False, description="Stretch — triggers TTS on the response")
