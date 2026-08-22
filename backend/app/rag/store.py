"""ChromaDB vector store for advisory text and rules.

Owner: C · Phase: P2

What goes in:
  - INCOIS advisory text (PFZ bulletins, Ocean State Forecast, marine heat wave notices)
  - geofencing rules and what each zone type actually prohibits
  - marine safety guidance and small-craft advisory definitions
  - a marine FAQ for out-of-golden-path questions

What does NOT go in: forecast values. Numbers come from adapters as evidence, never from
retrieval — a retrieved wave height has no timestamp and no provenance, which defeats the
entire point of the evidence array.
"""

from __future__ import annotations

from typing import Any

COLLECTION_ADVISORY = "advisory_text"
COLLECTION_RULES = "geofence_rules"
COLLECTION_FAQ = "marine_faq"


def get_client() -> Any:
    """Persistent local Chroma client under data/chroma/.

    TODO(P2, C): chromadb.PersistentClient; keep it local — no hosted dependency on stage
    """
    raise NotImplementedError("TODO(P2, C)")


def get_collection(name: str) -> Any:
    """TODO(P2, C)"""
    raise NotImplementedError("TODO(P2, C)")


def query(collection: str, text: str, n_results: int = 3) -> list[dict]:
    """Retrieve passages relevant to a query.

    TODO(P2, C): return the source document and section with every hit — a retrieved
                 passage that can't cite where it came from can't appear in evidence
    """
    raise NotImplementedError("TODO(P2, C)")
