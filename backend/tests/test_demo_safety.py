"""Demo-day safety: the cascade, and honest badging.

Owner: B (with C) · Phase: P3

Two things have to hold on stage:

  1. **The demo survives a dead network.** ``ORCA_USE_MOCK_DATA=true`` serves captured
     responses and every golden query still answers.
  2. **Nothing is silently faked.** If any adapter fell back to a canned response, the
     answer says so. This was broken: mock mode served data with ``used_mock_data=False``,
     which is precisely the "silently fake" failure the whole cascade exists to prevent.
"""

from __future__ import annotations

import pytest
from app.adapters import base
from app.services import cache


@pytest.fixture(autouse=True)
def _fresh_tiers():
    base.begin_tier_tracking()


async def _fails():
    raise base.AdapterError("network down")


async def _succeeds():
    return {"served": "live"}


# ── Tier tracking ─────────────────────────────────────────────────────────


def test_no_mock_reported_before_anything_runs():
    assert base.served_mock_data() is False
    assert base.tiers_used() == set()


@pytest.mark.asyncio
async def test_live_fetch_records_the_live_tier():
    key = cache.cache_key("tier_test", {"probe": "live"})
    result = await base.fetch_with_cascade(key, _succeeds, ttl_seconds=0, source="t")

    assert result.tier is base.DataTier.LIVE
    assert base.tiers_used() == {"live"}
    assert base.served_mock_data() is False


@pytest.mark.asyncio
async def test_cache_fallback_records_the_cache_tier():
    key = cache.cache_key("tier_test", {"probe": "cache"})
    cache.put(key, {"served": "cache"})

    result = await base.fetch_with_cascade(key, _fails, ttl_seconds=0, source="t")

    assert result.tier is base.DataTier.CACHE
    assert base.served_mock_data() is False, "stale cache is degraded, but it is not a mock"


@pytest.mark.asyncio
async def test_mock_fallback_is_recorded_and_badged():
    """The regression: mock mode answered with used_mock_data=False."""
    key = cache.cache_key("tier_test", {"probe": "mock-only"})
    cache.capture_mock(key, {"served": "mock"})

    result = await base.fetch_with_cascade(key, _fails, ttl_seconds=0, source="t")

    assert result.tier is base.DataTier.MOCK
    assert result.is_degraded
    assert base.served_mock_data() is True


@pytest.mark.asyncio
async def test_one_mock_among_many_live_calls_still_badges():
    """A partly-mocked answer is still not a live one — badge it."""
    live_key = cache.cache_key("tier_test", {"probe": "mixed-live"})
    mock_key = cache.cache_key("tier_test", {"probe": "mixed-mock"})
    cache.capture_mock(mock_key, {"served": "mock"})

    await base.fetch_with_cascade(live_key, _succeeds, ttl_seconds=0, source="t")
    await base.fetch_with_cascade(mock_key, _fails, ttl_seconds=0, source="t")

    assert base.tiers_used() == {"live", "mock"}
    assert base.served_mock_data() is True


def test_tracking_is_request_scoped():
    """A ContextVar, not a global — one user's fallback must not badge another's answer."""
    import contextvars

    base.begin_tier_tracking()
    base._record_tier(base.DataTier.MOCK)
    assert base.served_mock_data() is True

    # A fresh context (as a concurrent request gets) must not inherit it.
    assert contextvars.copy_context().run(lambda: base.served_mock_data()) is True
    ctx = contextvars.Context()
    assert ctx.run(lambda: base.served_mock_data()) is False


# ── Warming ───────────────────────────────────────────────────────────────


def test_golden_path_covers_every_demo_query():
    """Warming and the demo script must not drift apart."""
    queries = [entry["query"].casefold() for entry in cache.GOLDEN_PATH]

    assert any("fishing zone" in q for q in queries)
    assert any("safe" in q for q in queries)
    assert any("boundary" in q for q in queries)
    assert any("productivity" in q for q in queries)
    # At least one non-English query — multilingual is a demo beat, not a footnote.
    assert any(not q.isascii() for q in queries)


def test_cache_stats_reports_both_directories():
    stats = cache.stats()
    assert "cache" in stats and "mock" in stats
    assert "entries" in stats["cache"]
