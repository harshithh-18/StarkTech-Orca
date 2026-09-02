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

import hashlib
import json
import logging
import time
from pathlib import Path
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

# Coordinates are rounded to this many decimals before hashing. 3 dp ≈ 100 m, which is far
# finer than any forecast grid we consume — so near-identical points share a cache entry
# and nothing meaningful is lost.
_COORD_PRECISION = 3


def cache_key(adapter: str, params: dict) -> str:
    """Stable key for a request.

    Params are sorted so key order can't produce two entries for one request, and
    float-valued coordinates are rounded so that 16.9899999 and 16.99 collide on purpose.
    """
    normalised: dict[str, Any] = {}
    for name in sorted(params):
        value = params[name]
        if isinstance(value, float):
            value = round(value, _COORD_PRECISION)
        elif isinstance(value, (list, tuple)):
            value = ",".join(str(v) for v in value)
        normalised[name] = value

    blob = json.dumps(normalised, sort_keys=True, separators=(",", ":"), default=str)
    digest = hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]
    return f"{adapter}:{digest}"


def _path_for(directory: Path, key: str) -> Path:
    """Map a cache key onto a filename. ':' is legal on POSIX but noisy — use '__'."""
    return directory / f"{key.replace(':', '__')}.json"


def get(key: str, max_age_seconds: int | None = None) -> Any | None:
    """Read from cache. ``max_age_seconds=None`` returns an entry at any age.

    The stale read is deliberate: an hour-old forecast beats no forecast.
    """
    path = _path_for(get_settings().cache_dir, key)
    if not path.exists():
        return None

    try:
        entry = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        # A corrupt cache entry must never take down a request.
        logger.warning("cache: unreadable entry %s (%s) — treating as a miss", key, exc)
        return None

    if max_age_seconds is not None:
        age = time.time() - entry.get("stored_at", 0)
        if age > max_age_seconds:
            return None

    return entry.get("value")


def age_of(key: str) -> float | None:
    """Seconds since this entry was written, or None if there's no entry.

    The trace says "served from cache (42 min old)" — that number comes from here.
    """
    path = _path_for(get_settings().cache_dir, key)
    if not path.exists():
        return None
    try:
        entry = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    return time.time() - entry.get("stored_at", 0)


def put(key: str, value: Any) -> None:
    """Write through to cache with the current timestamp."""
    cache_dir = get_settings().cache_dir
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = _path_for(cache_dir, key)

    payload = {"key": key, "stored_at": time.time(), "value": value}
    try:
        # Write to a temp file and rename: a crash mid-write must not leave a truncated
        # entry that poisons the fallback path we rely on during the demo.
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, default=str), encoding="utf-8")
        tmp.replace(path)
    except OSError as exc:
        logger.warning("cache: could not write %s (%s)", key, exc)


def get_mock(key: str) -> Any | None:
    """Load a canned response from data/mock/."""
    path = _path_for(get_settings().mock_dir, key)
    if not path.exists():
        return None
    try:
        entry = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("cache: unreadable mock %s (%s)", key, exc)
        return None
    # Mocks are captured with capture_mock, so they carry the same envelope as cache
    # entries. Tolerate a bare value too, for a hand-placed file.
    return entry.get("value") if isinstance(entry, dict) and "value" in entry else entry


def capture_mock(key: str, value: Any) -> None:
    """Save a live response into data/mock/ for demo use.

    Run this during P3 rehearsal against real APIs so the demo set is real data.
    """
    mock_dir = get_settings().mock_dir
    mock_dir.mkdir(parents=True, exist_ok=True)
    path = _path_for(mock_dir, key)
    payload = {"key": key, "stored_at": time.time(), "value": value}
    try:
        path.write_text(json.dumps(payload, default=str, indent=2), encoding="utf-8")
        logger.info("cache: captured mock %s", key)
    except OSError as exc:
        logger.warning("cache: could not capture mock %s (%s)", key, exc)


def warm_all() -> None:
    """Pre-fetch every golden-path query so the demo runs from a warm cache.

    Run this on the demo machine BEFORE walking on stage. See docs/DEMO_SCRIPT.md.

    TODO(P3, B): drive the golden-path queries through the graph so every adapter they
                 touch lands in the cache. Deferred with the rest of the demo-hardening
                 work — see the roadmap's P3 block.
    """
    raise NotImplementedError("TODO(P3, B)")
