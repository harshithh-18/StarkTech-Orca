"""Ingestion into the RAG store.

Owner: C · Phase: P2

Run manually when source documents change; there's no live ingestion pipeline and there
doesn't need to be one in 19 days.

    python -m app.rag.ingest
"""

from __future__ import annotations


def ingest_advisories(path: str) -> int:
    """Chunk and embed INCOIS advisory text. Returns the number of chunks stored.

    TODO(P2, C): chunk by section, not by fixed token count — advisories are short and
                 already structured, and section boundaries are the natural unit
    TODO(P2, C): keep issue date and sector in the metadata so retrieval can filter by
                 recency; a six-month-old advisory is not evidence about today
    """
    raise NotImplementedError("TODO(P2, C)")


def ingest_geofence_rules(path: str) -> int:
    """Embed the rules describing what each zone type prohibits.

    This is what turns "you are 8 km from the IMBL" into "you are 8 km from the
    International Maritime Boundary Line; crossing it without authorisation can result in
    detention by the neighbouring coast guard."

    TODO(P2, C)
    """
    raise NotImplementedError("TODO(P2, C)")


def ingest_faq(path: str) -> int:
    """TODO(P2, C)"""
    raise NotImplementedError("TODO(P2, C)")


if __name__ == "__main__":
    # TODO(P2, C): ingest everything under data/knowledge/ and print the counts
    ...
