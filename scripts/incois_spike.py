"""INCOIS PFZ parse spike — the P0 go/no-go decision.

Owner: B + E · Phase: P0 · Timebox: half a day

    python scripts/incois_spike.py

> ## ✅ DECIDED — 27 Aug 2026: **PROXY**.
> The evidence is reproduced by running this script. In short: there is no dependable
> machine-readable PFZ advisory, so ``services/pfz_proxy.py`` is the **primary** path and
> INCOIS is best-effort enrichment only.
>
> Findings:
>   - ``MarineFisheries/PfzAdvisory`` → HTTP 200, but the HTML is a navigation shell.
>     Zero ``<table>``, zero ``<form>``, zero ``<option>``, no coordinate-shaped strings,
>     and no AJAX/WFS URL anywhere in the markup. The content is client-side rendered.
>   - ``MarineFisheries/TextDataHome`` → **404**. The documented text-advisory URL is dead.
>   - ``geoportal/MFASPFZ`` → 302 → ``/geoportal/MFASPFZ/`` → **404**.
>   - No ERDDAP endpoint at ``incois.gov.in/erddap``.
>
> Recorded in docs/DATA_SOURCES.md. Re-run this script to check whether INCOIS has
> published something parseable since.

Building the proxy was never conditional on this: it is the same method INCOIS uses
(chlorophyll + SST fronts), it makes ORCA's reasoning real rather than scraped, and when
the two sources ever do agree, that agreement is the strongest evidence in the product.
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

TEXT_ADVISORY_URL = "https://incois.gov.in/MarineFisheries/TextDataHome"
PFZ_ADVISORY_URL = "https://incois.gov.in/MarineFisheries/PfzAdvisory"
GEOPORTAL_URL = "https://incois.gov.in/geoportal/MFASPFZ"
ERDDAP_URL = "https://incois.gov.in/erddap/index.html"

ENDPOINTS = [PFZ_ADVISORY_URL, TEXT_ADVISORY_URL, GEOPORTAL_URL, ERDDAP_URL]

# The 14 coastal sectors INCOIS issues advisories for.
SECTORS = [
    "Gujarat", "Maharashtra", "Goa", "Karnataka", "Kerala",
    "Tamil Nadu", "Puducherry", "Andhra Pradesh", "Odisha", "West Bengal",
    "Andaman & Nicobar", "Lakshadweep", "Daman & Diu", "Gulf of Mannar",
]


async def probe_endpoints() -> dict[str, dict]:
    """Which of the entry points respond, and what do they return?"""
    import httpx

    print("1. Endpoint probe")
    print("   " + "-" * 72)
    results = {}

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        for url in ENDPOINTS:
            try:
                response = await client.get(url)
                content_type = response.headers.get("content-type", "?").split(";")[0]
                results[url] = {
                    "status": response.status_code,
                    "content_type": content_type,
                    "bytes": len(response.content),
                    "text": response.text if response.status_code == 200 else "",
                }
                print(f"   {url[:56]:56} {response.status_code}  {content_type:24} {len(response.content):>7}b")
            except Exception as exc:  # noqa: BLE001
                results[url] = {"status": None, "error": str(exc)}
                print(f"   {url[:56]:56} FAILED  {exc}")

    return results


def analyse_markup(html: str) -> dict:
    """Is there any structured advisory content, or is this a client-rendered shell?"""
    lowered = html.lower()
    return {
        "tables": lowered.count("<table"),
        "forms": lowered.count("<form"),
        "options": len(re.findall(r"<option[^>]*>", lowered)),
        "coords": len(re.findall(r"\d{1,2}\.\d+\s*[°]?\s*[NnEe]\b", html)),
        "ajax_urls": len(
            set(re.findall(r'(?i)(?:url\s*:\s*|fetch\(|action=)["\']([^"\']{5,90})["\']', html))
        ),
    }


async def try_parse_text_advisory(sector: str | None = None) -> dict:
    """Attempt a structured parse using the real adapter parser."""
    import httpx
    from app.adapters.incois_pfz import parse_advisory_html

    print("\n2. Structured parse attempt")
    print("   " + "-" * 72)

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        response = await client.get(PFZ_ADVISORY_URL)

    if response.status_code != 200:
        print(f"   page returned HTTP {response.status_code} — nothing to parse")
        return {"status": "unreachable"}

    markup = analyse_markup(response.text)
    print(f"   <table> elements     : {markup['tables']}")
    print(f"   <form> elements      : {markup['forms']}")
    print(f"   <option> elements    : {markup['options']}")
    print(f"   coordinate-like spans: {markup['coords']}")
    print(f"   AJAX/action URLs     : {markup['ajax_urls']}")

    result = parse_advisory_html(response.text)
    print(f"\n   parser status : {result['status']}")
    print(f"   parser detail : {result['detail']}")
    print(f"   zones found   : {len(result['zones'])}")

    result["markup"] = markup
    return result


def assess_reliability(probe: dict, parse: dict) -> str:
    """Print the recommendation and return it."""
    print("\n3. Assessment")
    print("   " + "-" * 72)

    reachable = [u for u, r in probe.items() if r.get("status") == 200]
    dead = [u for u, r in probe.items() if r.get("status") not in (200, None)]

    print(f"   reachable endpoints : {len(reachable)}/{len(ENDPOINTS)}")
    for url in dead:
        print(f"     dead: {url} → HTTP {probe[url]['status']}")

    parsed_zones = len(parse.get("zones", []))
    markup = parse.get("markup", {})
    has_structure = bool(markup.get("tables") or markup.get("options") or markup.get("coords"))

    if parsed_zones > 0:
        decision = "SCRAPE"
        print(f"\n   {parsed_zones} advisory nodes parsed — INCOIS can be a primary source,")
        print("   with the Copernicus proxy as corroborating evidence.")
    elif parse.get("status") == "none_issued":
        decision = "INCONCLUSIVE"
        print("\n   INCOIS says no advisory is issued right now (normal during the ban")
        print("   period or heavy cloud). Re-run on a day when one is published.")
    else:
        decision = "PROXY"
        print("\n   No parseable advisory content:")
        print(f"     structured markup present: {has_structure}")
        print("   The page is a client-rendered shell and the documented text/geoportal")
        print("   URLs 404. INCOIS cannot be depended on.")

    print(f"\n   ==> DECISION: {decision}")
    if decision == "PROXY":
        print("       services/pfz_proxy.py is PRIMARY for golden query #1.")
        print("       INCOIS stays wired as best-effort enrichment only.")
        print("       Recorded in docs/DATA_SOURCES.md.")

    return decision


async def run(sector: str | None, probe_only: bool) -> None:
    print(__doc__.split("\n\n")[0])
    print()

    probe = await probe_endpoints()
    if probe_only:
        return

    parse = await try_parse_text_advisory(sector)
    assess_reliability(probe, parse)

    print("\n   Sectors INCOIS covers (for reference): " + ", ".join(SECTORS[:6]) + ", …")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--probe", action="store_true", help="just check the endpoints")
    parser.add_argument("--sector", default=None)
    args = parser.parse_args()

    asyncio.run(run(args.sector, args.probe))


if __name__ == "__main__":
    main()
