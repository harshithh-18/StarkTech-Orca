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

import asyncio
import itertools
import logging
from datetime import datetime, timezone
from typing import Any, Protocol

from app.schemas.enums import TraceStatus
from app.schemas.response import Evidence, Location, TraceStep

logger = logging.getLogger(__name__)


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
        # itertools.count is atomic under CPython's GIL for the single next() call, which
        # is all the mutual exclusion parallel graph nodes need to get unique seq values.
        self._seq = itertools.count()

    def step(
        self,
        agent: str,
        message: str,
        status: TraceStatus = TraceStatus.OK,
        source: str | None = None,
        duration_ms: int | None = None,
    ) -> TraceStep:
        """Record one step and push it to the panel.

        The WebSocket send is fire-and-forget: a dead or slow socket must never block or
        fail an agent run. If nobody is listening, the step still lands in the response.
        """
        step = TraceStep(
            seq=next(self._seq),
            agent=agent,
            status=status,
            message=message,
            source=source,
            duration_ms=duration_ms,
        )
        self._steps.append(step)
        logger.info("trace[%s] %s %s: %s", self.session_id, status.value, agent, message)

        self._emit(step)
        return step

    def _emit(self, step: TraceStep) -> None:
        """Schedule the WebSocket push without waiting for it."""
        try:
            # Imported here rather than at module scope: api/ sits above agents/ in the
            # layering, and a top-level import would invert the dependency direction.
            from app.api.ws_trace import emit_trace

            loop = asyncio.get_running_loop()
            task = loop.create_task(emit_trace(self.session_id, step))
            # Hold a reference so the task isn't garbage-collected mid-flight, and
            # swallow anything it raises — the socket is never allowed to break a run.
            self._pending = getattr(self, "_pending", set())
            self._pending.add(task)
            task.add_done_callback(self._pending.discard)
        except RuntimeError:
            # No running loop (a synchronous test, or the CLI spikes). Nothing to emit to.
            pass
        except Exception as exc:  # noqa: BLE001 - the trace socket is never load-bearing
            logger.debug("trace: could not emit step (%s)", exc)

    @property
    def steps(self) -> list[TraceStep]:
        return list(self._steps)


# ── Per-run collector registry ────────────────────────────────────────────
# The collector owns monotonic `seq` numbering across parallel nodes, so it must be
# shared for the whole run — but it holds a live socket reference and cannot go into
# checkpointed graph state. Keyed by session_id outside the state instead.
_collectors: dict[str, TraceCollector] = {}


def get_collector(session_id: str) -> TraceCollector:
    """The trace collector for this run, created on first use."""
    collector = _collectors.get(session_id)
    if collector is None:
        collector = TraceCollector(session_id)
        _collectors[session_id] = collector
    return collector


def reset_collector(session_id: str) -> TraceCollector:
    """Start a fresh collector for a new turn, so seq restarts at 0."""
    collector = TraceCollector(session_id)
    _collectors[session_id] = collector
    return collector


def discard_collector(session_id: str) -> None:
    """Drop a finished run's collector so a long demo doesn't leak them."""
    _collectors.pop(session_id, None)


def make_evidence(
    field: str,
    value: float | str | bool,
    source: str,
    unit: str | None = None,
    time: Any | None = None,
    location: Location | None = None,
) -> Evidence:
    """Construct an Evidence entry.

    Keep ``source`` human-readable and name the model — "Open-Meteo Marine (ICON-Wave)",
    not "open_meteo". It is rendered verbatim as a citation under the answer.
    """
    if isinstance(time, str):
        try:
            time = datetime.fromisoformat(time.replace("Z", "+00:00"))
        except ValueError:
            time = None
    if isinstance(time, datetime) and time.tzinfo is None:
        time = time.replace(tzinfo=timezone.utc)

    return Evidence(
        field=field,
        value=value,
        unit=unit,
        source=source,
        time=time,
        location=location,
    )
