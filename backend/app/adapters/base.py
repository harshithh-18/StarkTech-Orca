"""Adapter conventions and shared plumbing.

Owner: B · Phase: P0

Every external data source gets exactly one adapter here, and adapters are the **only**
place HTTP lives. Agents call adapters. This seam is what lets us swap live INCOIS for the
Copernicus proxy, or for a cached mock on demo day, without editing a single agent.

## The cascade — live → cache → mock

Non-negotiable, and it is what keeps the demo alive:

  1. **live** — hit the source
  2. **cache** — on failure or within TTL, serve the last good response from data/cache/
  3. **mock** — on total failure, or when ORCA_USE_MOCK_DATA=true, serve data/mock/

An adapter **never raises past its caller** on a network failure. It returns the best rung
available and records which one it used, so the response can badge ``used_mock_data`` and
the trace can say so. We degrade honestly; we never silently fake.

## Every adapter must

  - return ``Evidence`` objects, not raw JSON
  - declare ``ATTRIBUTION`` and ``CACHE_TTL`` module constants
  - be runnable standalone: ``python -m app.adapters.open_meteo_marine``
  - be documented in docs/DATA_SOURCES.md
  - be tested against a recorded fixture — no live network calls in tests
"""

from __future__ import annotations

import asyncio
import contextvars
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import httpx

from app.config import get_settings
from app.services import cache

logger = logging.getLogger(__name__)

# Short on purpose. A query that takes 30 s on stage has already failed, even if it
# eventually answers — we would rather fall back to a warm cache entry than make the
# audience watch a spinner.
DEFAULT_TIMEOUT_SECONDS = 10.0

_client: httpx.AsyncClient | None = None

# Which cascade rungs served this request. The response has to badge `used_mock_data`
# honestly — "we degrade honestly, we never silently fake data" is the whole contract —
# but agents call adapters for Evidence and discard the tier, so it is recorded here
# instead. A ContextVar, not a global: requests run concurrently on one event loop and a
# global would badge one user's answer with another's fallback.
_tiers_used: contextvars.ContextVar[set[str] | None] = contextvars.ContextVar(
    "orca_tiers_used", default=None
)


def begin_tier_tracking() -> None:
    """Start recording cascade rungs for the current request."""
    _tiers_used.set(set())


def _record_tier(tier: DataTier) -> None:
    used = _tiers_used.get()
    if used is not None:
        used.add(tier.value)


def tiers_used() -> set[str]:
    """Rungs that served data on this request ('live', 'cache', 'mock')."""
    return set(_tiers_used.get() or set())


def served_mock_data() -> bool:
    """True when ANY adapter fell back to a canned response on this request."""
    return "mock" in tiers_used()


class AdapterError(Exception):
    """Raised *inside* an adapter when a live fetch fails.

    Never escapes ``fetch_with_cascade`` — it is the signal to drop to the next rung.
    """


class DataTier(str, Enum):
    """Which rung of the cascade actually served a response."""

    LIVE = "live"
    CACHE = "cache"
    MOCK = "mock"


class AdapterResult:
    """What every adapter returns: the payload plus how we got it."""

    def __init__(self, payload: Any, tier: DataTier, source: str, fetched_at: Any = None):
        self.payload = payload
        self.tier = tier
        self.source = source
        self.fetched_at = fetched_at

    @property
    def is_degraded(self) -> bool:
        """True when this did not come from a live call — the UI badges it."""
        return self.tier is not DataTier.LIVE

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<AdapterResult {self.source} tier={self.tier.value}>"


def get_client() -> httpx.AsyncClient:
    """Shared httpx.AsyncClient with sane timeouts, reused process-wide.

    Reused rather than per-request so connections stay warm — reconnecting to
    Open-Meteo on every specialist call adds up across a fan-out.
    """
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(DEFAULT_TIMEOUT_SECONDS, connect=5.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            headers={"User-Agent": "ORCA/0.1 (marine advisory research prototype)"},
            follow_redirects=True,
        )
    return _client


async def close_client() -> None:
    """Close the shared client. Called from the FastAPI lifespan shutdown."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None


async def fetch_with_cascade(
    key: str,
    fetch_live: Callable[[], Awaitable[Any]],
    ttl_seconds: int | None = None,
    source: str = "",
) -> AdapterResult:
    """Run the live → cache → mock cascade for one keyed request.

    ``key`` is ``f"{adapter}:{params_hash}"`` from ``services.cache.cache_key``.

    Order of operations:
      1. mock, if ORCA_USE_MOCK_DATA is set (the demo switch short-circuits everything)
      2. fresh cache within TTL — no network touched at all
      3. live, writing through to cache on success
      4. stale cache of any age
      5. mock
      6. give up and raise — the caller turns this into a `skipped` trace step
    """
    settings = get_settings()
    ttl = ttl_seconds if ttl_seconds is not None else settings.orca_cache_ttl_seconds

    # ── Rung 3, jumped to deliberately: the demo-day switch ───────────────
    if settings.orca_use_mock_data:
        mocked = cache.get_mock(key)
        if mocked is not None:
            logger.info("cascade[%s]: ORCA_USE_MOCK_DATA is on → serving MOCK", key)
            _record_tier(DataTier.MOCK)
            return AdapterResult(mocked, DataTier.MOCK, source)
        logger.warning(
            "cascade[%s]: ORCA_USE_MOCK_DATA is on but no mock exists — falling through "
            "to the live path",
            key,
        )

    # ── Rung 2a: fresh cache, no network ──────────────────────────────────
    fresh = cache.get(key, max_age_seconds=ttl)
    if fresh is not None:
        logger.debug("cascade[%s]: fresh cache hit", key)
        _record_tier(DataTier.CACHE)
        return AdapterResult(fresh, DataTier.CACHE, source)

    # ── Rung 1: live ──────────────────────────────────────────────────────
    try:
        payload = await fetch_live()
        cache.put(key, payload)
        _record_tier(DataTier.LIVE)
        return AdapterResult(
            payload, DataTier.LIVE, source, fetched_at=datetime.now(timezone.utc)
        )
    except (httpx.HTTPError, AdapterError, asyncio.TimeoutError, ValueError) as exc:
        # Loud on purpose. A silent fallback during rehearsal is how you end up on stage
        # not knowing you're on stale data.
        logger.warning("cascade[%s]: live fetch failed (%s) — trying cache", key, exc)

    # ── Rung 2b: stale cache, any age ─────────────────────────────────────
    stale = cache.get(key, max_age_seconds=None)
    if stale is not None:
        age = cache.age_of(key) or 0
        logger.warning(
            "cascade[%s]: serving STALE cache (%.0f min old)", key, age / 60
        )
        _record_tier(DataTier.CACHE)
        return AdapterResult(stale, DataTier.CACHE, source)

    # ── Rung 3: mock ──────────────────────────────────────────────────────
    mocked = cache.get_mock(key)
    if mocked is not None:
        logger.warning("cascade[%s]: serving MOCK — no live and no cache", key)
        _record_tier(DataTier.MOCK)
        return AdapterResult(mocked, DataTier.MOCK, source)

    # Every rung is exhausted. The caller catches this and emits a `skipped` trace step;
    # the run continues without this specialist's evidence.
    raise AdapterError(
        f"{source or key}: live fetch failed and no cache or mock entry exists"
    )


def parse_hour(stamp: str) -> datetime:
    """Parse an Open-Meteo hourly timestamp ('2026-08-27T06:00') as UTC.

    We request ``timezone=UTC`` everywhere, so the naive stamps the API returns are UTC —
    but they arrive without an offset, and comparing a naive datetime to an aware one
    raises. Normalising here keeps every window comparison in one timezone.
    """
    parsed = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def slice_window(
    hourly: dict, start: datetime | None, end: datetime | None
) -> list[int]:
    """Indices of the hourly arrays that fall inside [start, end].

    An empty result means the window lies outside the forecast horizon — the caller must
    treat that as "no data for that time", not as calm conditions.
    """
    times = hourly.get("time") or []
    indices = []
    for i, stamp in enumerate(times):
        try:
            hour = parse_hour(stamp)
        except (ValueError, AttributeError):
            continue
        if start is not None and hour < start:
            continue
        if end is not None and hour > end:
            continue
        indices.append(i)
    return indices


def peak_in_window(
    hourly: dict,
    field: str,
    indices: list[int],
    mode: str = "max",
) -> tuple[float, datetime] | None:
    """The worst value of ``field`` within the window, and the hour it occurs.

    ``mode='min'`` for fields where lower is worse (visibility). Returns None when the
    field is absent or entirely null across the window — which is how we detect a land
    cell, since Open-Meteo returns nulls rather than an error over land.

    The peak, not the mean, is deliberate: a safety verdict cares about the worst hour a
    boat would be out in, and "rough at 06:00" is the actionable fact.
    """
    values = hourly.get(field)
    times = hourly.get("time") or []
    if not values:
        return None

    best_value: float | None = None
    best_index: int | None = None
    for i in indices:
        if i >= len(values):
            break
        value = values[i]
        if value is None:
            continue
        if best_value is None or (value > best_value if mode == "max" else value < best_value):
            best_value = float(value)
            best_index = i

    if best_value is None or best_index is None:
        return None

    try:
        when = parse_hour(times[best_index])
    except (ValueError, IndexError, AttributeError):
        when = datetime.now(timezone.utc)
    return best_value, when


def has_any_values(hourly: dict, field: str) -> bool:
    """True if ``field`` has at least one non-null value.

    The land test. Open-Meteo's marine endpoint returns HTTP 200 with an all-null series
    for an inland point rather than an error, so an adapter that only checks the status
    code will happily report "no waves" for Hyderabad.
    """
    values = hourly.get(field)
    return bool(values) and any(v is not None for v in values)


async def get_json(url: str, params: dict) -> Any:
    """GET a JSON endpoint, raising AdapterError on anything unexpected.

    Adapters use this as their ``fetch_live`` body so that HTTP-shaped failures and
    body-shaped failures both arrive at the cascade as one exception type. Returns a dict
    for a single-point query and a list for a comma-separated multi-point one.
    """
    client = get_client()
    response = await client.get(url, params=params)
    if response.status_code != 200:
        raise AdapterError(
            f"GET {url} returned HTTP {response.status_code}: {response.text[:200]}"
        )
    try:
        return response.json()
    except ValueError as exc:
        raise AdapterError(f"GET {url} returned non-JSON: {exc}") from exc
