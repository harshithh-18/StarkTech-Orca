"""Agent protocol and shared helpers.

Owner: A · Phase: P1

The contract every agent honours:
  - it appends **at least one** TraceStep (an agent that touches data silently is a bug —
    the trace panel *is* the product)
  - it appends **Evidence** for every value that influences the answer
  - it calls adapters, never httpx directly
  - it never imports another agent — cross-agent needs route through the graph
"""

from __future__ import annotations

from typing import Any, Protocol

from app.schemas.enums import TraceStatus
from app.schemas.response import Evidence, TraceStep


class Agent(Protocol):
    """Structural type for a specialist."""

    name: str

    async def run(self, **kwargs: Any) -> dict:
        """Do the work; return {'evidence': [...], 'reasoning_trace': [...], ...}."""
        ...


class TraceCollector:
    """Per-run trace accumulator, handed to each agent.

    Owns ``seq`` numbering so steps order correctly even when parallel specialists finish
    out of order, and forwards each step to the WebSocket as it lands.
    """

    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self._steps: list[TraceStep] = []

    def step(
        self,
        agent: str,
        message: str,
        status: TraceStatus = TraceStatus.OK,
        source: str | None = None,
        duration_ms: int | None = None,
    ) -> TraceStep:
        """Record one step and push it to the panel.

        TODO(P1, A): assign the next seq, append, and fire-and-forget to ws_trace.emit_trace
                     — a dead socket must never break an agent run.
        """
        raise NotImplementedError("TODO(P1, A)")

    @property
    def steps(self) -> list[TraceStep]:
        return list(self._steps)


def make_evidence(
    field: str,
    value: float | str | bool,
    source: str,
    unit: str | None = None,
    time: Any | None = None,
) -> Evidence:
    """Construct an Evidence entry.

    Keep ``source`` human-readable and name the model — "Open-Meteo Marine (ICON-Wave)",
    not "open_meteo". It is rendered verbatim as a citation under the answer.

    TODO(P1, C)
    """
    raise NotImplementedError("TODO(P1, C)")
