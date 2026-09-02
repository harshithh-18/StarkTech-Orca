"""Demo-day preparation — run this BEFORE you walk on stage.

Owner: B · Phase: P3

    python scripts/prepare_demo.py            # warm the cache, then capture mocks
    python scripts/prepare_demo.py --check    # just report what's ready

> ## Never demo on a cold live API call.
> Conference Wi-Fi drops. Free tiers rate-limit at the worst possible moment. This script
> runs the whole golden path against the real sources, then promotes everything the cache
> captured into ``data/mock/``.
>
> After it succeeds you can set ``ORCA_USE_MOCK_DATA=true`` and the entire demo runs with
> the network unplugged — on real data captured minutes earlier, not invented.

Run it the morning of the demo, on the demo machine, on good Wi-Fi.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))


def _tick(ok: bool) -> str:
    return "✓" if ok else "✗"


async def check() -> bool:
    """Report what is configured and what is missing. Returns True if demo-ready."""
    from app.adapters import geojson_store
    from app.config import get_settings
    from app.i18n import bhashini
    from app.rag import store as rag_store
    from app.services import cache, llm

    settings = get_settings()
    geojson_store.load_all()

    copernicus = sorted(p.name for p in settings.copernicus_dir.glob("*.nc"))
    boundaries = geojson_store.available_layers()
    stats = cache.stats()

    print("\nORCA demo readiness")
    print("─" * 62)

    rows = [
        ("Copernicus subsets", bool(copernicus), ", ".join(copernicus) or "none — query #1 and #4 degrade"),
        ("Boundary layers", bool(boundaries), ", ".join(boundaries) or "none — query #3 degrades"),
        ("LLM providers", llm.available(), ", ".join(llm.providers()) or "none — English only, still correct"),
        ("Bhashini NMT", bhashini.available(), "configured" if bhashini.available() else "not set — LLM translates instead"),
        ("Knowledge base", rag_store.available(), "ready" if rag_store.available() else "empty — run `python -m app.rag.ingest`"),
        ("Warm cache", stats["cache"]["entries"] > 0, f"{stats['cache']['entries']} entries"),
        ("Captured mocks", stats["mock"]["entries"] > 0, f"{stats['mock']['entries']} entries"),
    ]
    for label, ok, detail in rows:
        print(f"  {_tick(ok)} {label:20} {detail}")

    print(f"\n  ORCA_USE_MOCK_DATA is currently: {settings.orca_use_mock_data}")

    # Only the mock set is genuinely required to survive a dead network.
    ready = stats["mock"]["entries"] > 0
    if ready:
        print("\n  Offline-safe. Set ORCA_USE_MOCK_DATA=true in .env to demo without Wi-Fi.")
    else:
        print("\n  NOT offline-safe yet — run this script without --check to capture mocks.")
    return ready


async def warm_and_capture() -> bool:
    from app.adapters import geojson_store
    from app.adapters.base import close_client
    from app.config import get_settings
    from app.graph.builder import close_graph, init_graph
    from app.services import cache

    settings = get_settings()
    if settings.orca_use_mock_data:
        print(
            "\n⚠️  ORCA_USE_MOCK_DATA=true, so warming would just re-read the existing\n"
            "   mocks instead of fetching anything live. Set it to false, re-run this,\n"
            "   then set it back to true for the demo."
        )
        return False

    geojson_store.load_all()
    await init_graph()

    print("\nWarming the golden path against live sources…")
    print("─" * 62)
    try:
        results = await cache.warm_all()
        for query, outcome in results.items():
            print(f"  {_tick(not outcome.startswith('FAILED'))} {query:50} {outcome}")

        promoted = cache.promote_cache_to_mocks()
        print(f"\n  Captured {promoted} responses into {settings.mock_dir}")
    finally:
        await close_client()
        await close_graph()

    return True


async def main_async(args) -> None:
    if not args.check:
        await warm_and_capture()
    ready = await check()

    if not args.check and ready:
        print("\nNext: set ORCA_USE_MOCK_DATA=true in .env and restart the backend.")
        print("Then pull the Wi-Fi and run the golden path once as a rehearsal.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--check", action="store_true", help="report readiness without fetching anything"
    )
    asyncio.run(main_async(parser.parse_args()))


if __name__ == "__main__":
    main()
