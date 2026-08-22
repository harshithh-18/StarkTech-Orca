"""The ORCA response contract.

Owner: C · Phase: P0 · Status: 🔒 FROZEN after Day 3 (24 Aug)

This is the source of truth for the shape of every answer ORCA gives. It is deliberately
the ONE fully-implemented module in the scaffold: frontend (D) and backend (B) both code
against it in parallel, so it has to be real from day one.

Changing anything here requires A + B + C + D sign-off and simultaneous edits to:
  - docs/API_CONTRACT.md
  - frontend/src/types/orca.ts

The two fields that make ORCA what it is are ``evidence`` and ``reasoning_trace``. They
default to empty lists and are never ``None``. An answer without evidence is a chatbot;
an answer with it is what the problem statement is actually asking for.
"""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.enums import (
    AlertType,
    ChartKind,
    Intent,
    Language,
    MapLayer,
    TraceStatus,
    Verdict,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Location(BaseModel):
    """A point on the water (or the coast next to it)."""

    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    name: str | None = Field(None, description="Human-readable, e.g. 'Kakinada'")
    source: str | None = Field(
        None, description="'gps' | 'geocoded' | 'session_context'"
    )


class Evidence(BaseModel):
    """One observed value that influenced the answer.

    Every number the user sees should be traceable to one of these. ``source`` is
    human-readable and names the model where relevant, e.g. "Open-Meteo Marine (ICON-Wave)"
    — it is rendered directly as a citation.
    """

    field: str = Field(..., description="Machine name, e.g. 'wave_height'")
    value: float | str | bool
    unit: str | None = Field(None, description="'m', 'km/h', 'mg/m³', '°C'")
    source: str = Field(..., description="Human-readable, rendered as a citation")
    time: datetime | None = Field(
        None, description="Validity time of the value — NOT the time we fetched it"
    )
    location: Location | None = Field(
        None, description="Only if different from the query location"
    )


class TraceStep(BaseModel):
    """One line in the Reasoning Trace panel.

    Emitted as it happens over ``WS /ws/trace/{session_id}`` so the panel fills in live —
    the user watches the platform think. ``message`` is always English: this is a
    developer- and judge-facing trace, not user-facing copy.
    """

    seq: int = Field(..., ge=0, description="Monotonic within a run; the panel sorts by it")
    agent: str = Field(..., description="Module name: 'planner', 'sea_state', 'risk', ...")
    status: TraceStatus = TraceStatus.OK
    message: str
    source: str | None = Field(None, description="Data source touched in this step")
    duration_ms: int | None = None


class ChartPoint(BaseModel):
    x: str = Field(..., description="ISO 8601 datetime string")
    y: float | None = Field(None, description="None renders as a gap, not a zero")


class ChartSeries(BaseModel):
    name: str
    unit: str | None = None
    points: list[ChartPoint] = Field(default_factory=list)


class ChartSpec(BaseModel):
    """A forecast or trend chart for the frontend to render (48-hr wave, chlorophyll trend)."""

    id: str = Field(..., description="'wave_48h', 'chlorophyll_trend'")
    title: str = Field(..., description="Localised into the response language")
    kind: ChartKind = ChartKind.LINE
    x_label: str = ""
    y_label: str = ""
    series: list[ChartSeries] = Field(default_factory=list)


class OrcaResponse(BaseModel):
    """What every graph run returns. See docs/API_CONTRACT.md for the field-by-field table."""

    model_config = ConfigDict(use_enum_values=False)

    # ── What was asked ────────────────────────────────────────────────────
    query: str
    session_id: str
    language: Language = Field(
        ..., description="Detected or overridden; `answer` is written IN this language"
    )
    intent: Intent
    location: Location | None = None

    # ── The answer ────────────────────────────────────────────────────────
    answer: str = Field(..., description="Short and glanceable, in `language`")
    verdict: Verdict | None = Field(None, description="None for non-safety intents")

    # ── Why (the whole point — report §9) ─────────────────────────────────
    evidence: list[Evidence] = Field(default_factory=list)
    reasoning_trace: list[TraceStep] = Field(default_factory=list)

    # ── What to render ────────────────────────────────────────────────────
    map_layers: list[MapLayer] = Field(default_factory=list)
    alerts: list[AlertType] = Field(default_factory=list)
    charts: list[ChartSpec] = Field(default_factory=list)

    # ── Provenance ────────────────────────────────────────────────────────
    generated_at: datetime = Field(default_factory=_utcnow)
    used_mock_data: bool = Field(
        False,
        description="True when served from data/mock/. The UI badges this — "
        "we degrade honestly, we never silently fake data.",
    )
    attribution: list[str] = Field(
        default_factory=list, description="Licence lines for every source touched"
    )

    def trace_messages(self) -> list[str]:
        """The flat string trace from implementation report §12.

        The contract stores structured steps (the panel needs agent + status + seq), but
        the report's shape is recoverable — this is the documented equivalence.
        """
        return [step.message for step in self.reasoning_trace]


class ErrorDetail(BaseModel):
    code: str = Field(..., description="'LOCATION_UNRESOLVED', 'ADAPTER_TIMEOUT', ...")
    message: str
    hint: str | None = Field(None, description="What the caller can do about it")


class ErrorResponse(BaseModel):
    error: ErrorDetail


class TraceEvent(BaseModel):
    """A frame on ``WS /ws/trace/{session_id}``.

    ``payload`` is a TraceStep for type='trace', an OrcaResponse for type='answer',
    and an ErrorDetail for type='error'.
    """

    type: str = Field(..., description="'trace' | 'answer' | 'error'")
    session_id: str
    payload: dict
