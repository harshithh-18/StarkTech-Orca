"""Cache and mock fallback — the demo-safety layer.

Owner: B · Phase: P0 build, P3 harden

> ## Never demo on a cold live API call.
> Conference Wi-Fi drops. APIs rate-limit at the worst moment. This module is why that
> doesn't end the presentation.

Three rungs (see adapters/base.py):

  1. **live** — hit the source
  2. **cache** — SQLite or flat JSON under ``data/cache/``, keyed by (adapter, params_hash)
  3. **mock** — ``data/mock/``, canned but **real** responses captured during rehearsal

``ORCA_USE_MOCK_DATA=true`` forces rung 3 for the whole app.

**Mocks are captured from real calls, never hand-written.** A hand-written mock is a lie
you will eventually show to a judge; a captured one is yesterday's truth.
"""

from __future__ import annotations

from typing import Any


def cache_key(adapter: str, params: dict) -> str:
    """Stable key for a request.

    TODO(P0, B): sorted-params hash; round lat/lon to ~3 decimals so that near-identical
                 points share a cache entry (0.001° ≈ 100 m — far finer than any forecast
                 grid, so nothing is lost)
    """
    raise NotImplementedError("TODO(P0, B)")


def get(key: str, max_age_seconds: int | None = None) -> Any | None:
    """Read from cache. ``max_age_seconds=None`` returns an entry at any age.

    The stale read is deliberate: an hour-old forecast beats no forecast.

    TODO(P0, B)
    """
    raise NotImplementedError("TODO(P0, B)")


def put(key: str, value: Any) -> None:
    """Write through to cache with the current timestamp.

    TODO(P0, B)
    """
    raise NotImplementedError("TODO(P0, B)")


def get_mock(key: str) -> Any | None:
    """Load a canned response from data/mock/.

    TODO(P3, B)
    """
    raise NotImplementedError("TODO(P3, B)")


def capture_mock(key: str, value: Any) -> None:
    """Save a live response into data/mock/ for demo use.

    Run this during P3 rehearsal against real APIs so the demo set is real data.

    TODO(P3, B)
    """
    raise NotImplementedError("TODO(P3, B)")


def warm_all() -> None:
    """Pre-fetch every golden-path query so the demo runs from a warm cache.

    Run this on the demo machine BEFORE walking on stage. See docs/DEMO_SCRIPT.md.

    TODO(P3, B)
    """
    raise NotImplementedError("TODO(P3, B)")
