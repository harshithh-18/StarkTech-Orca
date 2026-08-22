"""INCOIS PFZ parse spike — the P0 go/no-go decision.

Owner: B + E · Phase: P0 · Timebox: half a day
Deadline: **end of Day 2 (23 Aug)**

    python scripts/incois_spike.py

> ## This is the #1 technical risk in the project.
> INCOIS has no clean REST API — only WebGIS layers and HTML/text advisory pages.
> This script answers one question: **can we parse it reliably enough to depend on it?**

## The decision

**Scrape** — if the text advisory parses consistently across sectors and days, use INCOIS
as the primary source and the Copernicus proxy as corroboration.

**Proxy** — if it's flaky, ``services/pfz_proxy.py`` becomes primary and INCOIS becomes
best-effort enrichment.

Either way, **build the proxy.** It's the same method INCOIS uses (chlorophyll + SST
fronts), it makes ORCA's reasoning real rather than scraped, and when the two agree that
agreement is the strongest evidence in the product.

Write the decision into ``docs/DATA_SOURCES.md`` and say it at standup. Do not carry this
question into P1.

## What to check

  1. Does the advisory page load, and is it consistently shaped?
  2. Can we extract sector, validity window, and node lat/lons?
  3. Does it work across all 14 coastal sectors, or only some?
  4. What happens during the fishing ban period / on a cloudy day with no advisory?
     (Answer: none is issued. That's a normal state, not an error — make sure the parser
     can tell "none issued" apart from "we failed".)
  5. Is there a machine-readable WebGIS endpoint behind the geoportal that would be more
     stable than parsing HTML? **Check this first — it would change everything.**
"""

from __future__ import annotations

import argparse

TEXT_ADVISORY_URL = "https://incois.gov.in/MarineFisheries/TextDataHome"
PFZ_ADVISORY_URL = "https://incois.gov.in/MarineFisheries/PfzAdvisory"
GEOPORTAL_URL = "https://incois.gov.in/geoportal/MFASPFZ"

SECTORS = [
    # TODO(P0, B): fill in the 14 coastal sectors from the INCOIS page
]


def probe_endpoints() -> None:
    """Which of the three entry points respond, and what do they return?

    TODO(P0, B): GET each; print status, content-type and the first 500 bytes
    TODO(P0, B): open the geoportal in a browser with the network tab open and look for a
                 JSON/WFS call behind the WebGIS. A real endpoint beats any scraper.
    """
    raise NotImplementedError("TODO(P0, B)")


def try_parse_text_advisory(sector: str | None = None) -> dict:
    """Attempt a structured parse of the text advisory.

    TODO(P0, B): BeautifulSoup + lxml; extract sector, validity, node lat/lons
    TODO(P0, B): print what parsed and what didn't — the failures are the finding
    """
    raise NotImplementedError("TODO(P0, B)")


def assess_reliability() -> None:
    """Run the parse across every sector and report a success rate.

    TODO(P0, B+E): try all 14 sectors; print a table of parsed / failed / empty
    TODO(P0, B+E): print the recommendation — SCRAPE or PROXY — and paste it into
                   docs/DATA_SOURCES.md
    """
    raise NotImplementedError("TODO(P0, B+E)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--probe", action="store_true", help="just check the endpoints")
    parser.add_argument("--sector", default=None)
    parser.parse_args()

    # TODO(P0, B): probe → parse → assess, then WRITE DOWN THE DECISION
    raise NotImplementedError("TODO(P0, B)")


if __name__ == "__main__":
    main()
