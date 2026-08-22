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

from enum import Enum
from typing import Any


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


async def fetch_with_cascade(
    key: str,
    fetch_live: Any,
    ttl_seconds: int | None = None,
) -> AdapterResult:
    """Run the live → cache → mock cascade for one keyed request.

    ``key`` is ``f"{adapter}:{params_hash}"``.

    TODO(P0, B): serve fresh cache within TTL without touching the network
    TODO(P0, B): on live success, write through to cache and return LIVE
    TODO(P0, B): on live failure, return stale cache (any age) before giving up
    TODO(P3, B): honour settings.orca_use_mock_data by skipping straight to MOCK
    TODO(P3, B): log every fallback loudly — a silent fallback during rehearsal is how you
                 end up on stage not knowing you're on mocks
    """
    raise NotImplementedError("TODO(P0, B)")


def get_client() -> Any:
    """Shared httpx.AsyncClient with sane timeouts and retry.

    TODO(P0, B): httpx.AsyncClient(timeout=10s, limits=...), reused process-wide.
                 Short timeouts matter more than completeness — a query that takes 30s on
                 stage has already failed, even if it eventually answers.
    """
    raise NotImplementedError("TODO(P0, B)")
