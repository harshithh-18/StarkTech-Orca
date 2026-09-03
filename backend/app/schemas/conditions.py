"""The conditions and alerts contracts.

Owner: C · Phase: P4

``schemas/response.py`` is frozen — it describes what a *conversational turn* returns, and
nothing here changes it. These are separate contracts for the two paths that don't start
with a question:

  - ``GET  /api/conditions``  → ``ConditionsSnapshot`` — the live dashboard
  - ``POST /api/watch``       → ``Watch`` — a standing safety watch on a location
  - ``GET  /api/watch/{id}``  → ``WatchStatus`` — what that watch has found

Mirrored in ``frontend/src/types/orca.ts``, same rule as the response contract: changing a
field here means changing it there in the same commit.
"""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.schemas.enums import AlertType, Verdict
from app.schemas.response import ChartSpec, Evidence, Location


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ConditionTile(BaseModel):
    """One reading on the conditions dashboard.

    Carries its own threshold band so the UI never re-derives safety colour from a raw
    number — if the tile said "amber" and the verdict said GO, the interface would be
    lying, and the only way to make that impossible is to compute the band once, here.
    """

    field: str = Field(..., description="Threshold key, e.g. 'wave_height'")
    label: str = Field(..., description="Human-readable, English; the UI localises it")
    icon: str = Field(..., description="Icon key the frontend maps to a glyph")
    value: float
    unit: str | None = None
    band: str = Field(
        "go",
        description="'none' (no threshold exists — context, not a safety claim) | "
        "'go' | 'caution' | 'no_go'",
    )
    source: str
    time: datetime | None = Field(None, description="Validity time of `value`")

    peak_value: float | None = Field(
        None, description="Worst reading in the next 24 h — what changes a decision"
    )
    peak_time: datetime | None = None
    peak_band: str = Field(
        "none",
        description="Band of `peak_value`. Separate from `band` on purpose: a reading can "
        "be inside the limits now and past them by evening, and a single colour cannot "
        "say both. The UI paints the bar by `band` and marks the peak by this.",
    )
    threshold: float | None = Field(
        None, description="The caution limit, so the UI can draw the bar against it"
    )


class TideSummary(BaseModel):
    """Next high and low water. Modelled sea level, not a port tide table."""

    next_high_time: datetime | None = None
    next_high_m: float | None = None
    next_low_time: datetime | None = None
    next_low_m: float | None = None
    range_m: float | None = Field(None, description="Spring/neap range over the forecast")
    state: str = Field("unknown", description="'rising' | 'falling' | 'unknown'")
    source: str = ""


class NearestCoast(BaseModel):
    """Where the sea actually is, for a point that has none.

    Not an error payload — an answer. Someone asking about the sea from an inland city has
    asked a reasonable question about the wrong place, and the useful reply names the
    harbour they should be asking about and offers to switch to it.
    """

    name: str
    state: str
    lat: float
    lon: float
    distance_km: float
    bearing: str = Field(..., description="Spoken compass direction, e.g. 'south-east'")


class SafeWindow(BaseModel):
    """A run of consecutive hours whose every reading is inside the limits."""

    start: str = Field(..., description="ISO 8601 UTC")
    end: str
    hours: int
    quality: str = Field("clear", description="'clear' (all GO) | 'workable' (some CAUTION)")


class ConditionsSnapshot(BaseModel):
    """Everything true about the sea at one point, without anyone asking a question."""

    location: Location
    observed_at: datetime = Field(default_factory=_utcnow)

    tiles: list[ConditionTile] = Field(default_factory=list)
    verdict: Verdict = Verdict.NOT_APPLICABLE
    reasons: list[str] = Field(default_factory=list)
    alerts: list[AlertType] = Field(default_factory=list)
    tide: TideSummary | None = None

    next_window: SafeWindow | None = Field(
        None, description="The next safe departure window, or None inside the horizon"
    )
    windows: list[SafeWindow] = Field(default_factory=list)
    blocked_by: list[str] = Field(
        default_factory=list, description="What is keeping the boat in harbour right now"
    )

    charts: list[ChartSpec] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)

    coastal: bool = Field(
        True,
        description="False when this point has no sea within range. Then there is no "
        "sea state, no tide and no safety verdict to give — not a degraded one, none. "
        "The UI shows `nearest_coast` instead of a verdict card.",
    )
    nearest_coast: NearestCoast | None = Field(
        None, description="Populated whenever `coastal` is False — where to go instead"
    )

    degraded: list[str] = Field(
        default_factory=list, description="Which upstream models were unavailable, and why"
    )
    used_mock_data: bool = False
    attribution: list[str] = Field(default_factory=list)


# ── Proactive watches ─────────────────────────────────────────────────────


class WatchRequest(BaseModel):
    """Register a standing watch on a location.

    A watch is the difference between a system you have to ask and a system that warns
    you. The fisherman sets it before sailing; ORCA re-checks conditions and boundary
    proximity on a timer and pushes anything that changed for the worse.
    """

    session_id: str = Field(..., description="Where alerts are pushed — the trace socket")
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    name: str | None = None
    language: str = Field("en", description="ISO 639-1; alert text is written in it")
    interval_seconds: int = Field(
        900, ge=120, le=7200, description="How often to re-check. 15 min by default."
    )


class WatchAlert(BaseModel):
    """One thing the watch found that the user should know about."""

    type: AlertType
    severity: str = Field("warning", description="'info' | 'warning' | 'critical'")
    title: str
    detail: str
    raised_at: datetime = Field(default_factory=_utcnow)
    location: Location | None = None
    evidence: list[Evidence] = Field(default_factory=list)


class Watch(BaseModel):
    """A registered watch."""

    id: str
    session_id: str
    location: Location
    language: str = "en"
    interval_seconds: int = 900
    created_at: datetime = Field(default_factory=_utcnow)
    last_checked_at: datetime | None = None
    active: bool = True


class WatchStatus(BaseModel):
    """A watch plus everything it has raised."""

    watch: Watch
    verdict: Verdict = Verdict.NOT_APPLICABLE
    alerts: list[WatchAlert] = Field(default_factory=list)
    checks: int = 0
