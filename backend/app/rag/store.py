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

The store is optional. If Chroma cannot start, retrieval returns nothing and the answer
degrades to what the agents computed — the golden path never depends on it.
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

COLLECTION_ADVISORY = "advisory_text"
COLLECTION_RULES = "geofence_rules"
COLLECTION_FAQ = "marine_faq"

ALL_COLLECTIONS = (COLLECTION_ADVISORY, COLLECTION_RULES, COLLECTION_FAQ)

_client: Any = None
_unavailable_reason: str | None = None


def get_client() -> Any:
    """Persistent local Chroma client under data/chroma/.

    Local on purpose — no hosted dependency on stage. Returns None (rather than raising)
    when Chroma is unusable, so a missing store degrades the answer instead of the run.
    """
    global _client, _unavailable_reason
    if _client is not None:
        return _client
    if _unavailable_reason is not None:
        return None

    try:
        import chromadb

        path = get_settings().cache_dir.parent / "chroma"
        path.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(path))
        logger.info("rag: chroma store at %s", path)
        return _client
    except Exception as exc:  # noqa: BLE001 - retrieval is never load-bearing
        _unavailable_reason = str(exc)
        logger.warning("rag: chroma unavailable (%s) — retrieval disabled", exc)
        return None


def available() -> bool:
    """True when the store can be opened and holds at least one document."""
    client = get_client()
    if client is None:
        return False
    try:
        return any(
            client.get_or_create_collection(name).count() > 0 for name in ALL_COLLECTIONS
        )
    except Exception:  # noqa: BLE001
        return False


def get_collection(name: str) -> Any:
    """A collection by name, or None when the store is unavailable."""
    client = get_client()
    if client is None:
        return None
    try:
        return client.get_or_create_collection(name)
    except Exception as exc:  # noqa: BLE001
        logger.warning("rag: could not open collection %s (%s)", name, exc)
        return None


def query(collection: str, text: str, n_results: int = 3) -> list[dict]:
    """Retrieve passages relevant to a query.

    Every hit carries the source document and section it came from — a retrieved passage
    that cannot cite where it came from has no business appearing near an evidence-based
    answer.
    """
    handle = get_collection(collection)
    if handle is None:
        return []

    try:
        if handle.count() == 0:
            return []
        result = handle.query(query_texts=[text], n_results=n_results)
    except Exception as exc:  # noqa: BLE001
        logger.warning("rag: query on %s failed (%s)", collection, exc)
        return []

    documents = (result.get("documents") or [[]])[0]
    metadatas = (result.get("metadatas") or [[]])[0]
    distances = (result.get("distances") or [[]])[0]

    hits = []
    for i, document in enumerate(documents):
        metadata = metadatas[i] if i < len(metadatas) else {}
        hits.append(
            {
                "text": document,
                "source": (metadata or {}).get("source", "unknown"),
                "section": (metadata or {}).get("section", ""),
                # Chroma returns squared L2 distance; smaller is closer.
                "distance": distances[i] if i < len(distances) else None,
            }
        )
    return hits


def search(text: str, n_results: int = 3) -> list[dict]:
    """Query every collection and return the closest hits across all of them."""
    hits: list[dict] = []
    for name in ALL_COLLECTIONS:
        hits.extend(query(name, text, n_results))

    scored = [h for h in hits if h.get("distance") is not None]
    scored.sort(key=lambda h: h["distance"])
    return scored[:n_results] if scored else hits[:n_results]
