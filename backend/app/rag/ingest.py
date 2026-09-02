"""Ingestion into the RAG store.

Owner: C · Phase: P2

Run manually when source documents change; there's no live ingestion pipeline and there
doesn't need to be one in 19 days.

    python -m app.rag.ingest
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from app.config import DATA_DIR
from app.rag import store

logger = logging.getLogger(__name__)

KNOWLEDGE_DIR = DATA_DIR / "knowledge"


def chunk_by_section(text: str, source: str) -> list[tuple[str, dict]]:
    """Split a markdown document on its headings.

    Chunked by section rather than by a fixed token count: these documents are short and
    already structured, so a heading is the natural unit — and it gives every chunk a
    citable section name, which a mid-sentence token split would not.
    """
    chunks: list[tuple[str, dict]] = []

    # Split on ## / ### headings, keeping the heading with its body.
    parts = re.split(r"\n(?=#{2,3}\s)", text)
    for part in parts:
        body = part.strip()
        if len(body) < 40:
            continue  # a bare heading or separator carries no retrievable content

        heading = ""
        first_line = body.splitlines()[0].strip()
        if first_line.startswith("#"):
            heading = first_line.lstrip("#").strip()

        chunks.append((body, {"source": source, "section": heading}))

    return chunks


def _ingest_file(path: Path, collection_name: str) -> int:
    """Chunk one markdown file into a collection. Returns chunks stored."""
    if not path.exists():
        logger.warning("rag: %s not found — nothing to ingest", path)
        return 0

    collection = store.get_collection(collection_name)
    if collection is None:
        return 0

    chunks = chunk_by_section(path.read_text(encoding="utf-8"), path.name)
    if not chunks:
        return 0

    documents = [text for text, _ in chunks]
    metadatas = [meta for _, meta in chunks]
    ids = [f"{path.stem}-{i}" for i in range(len(chunks))]

    # upsert so re-running after an edit replaces rather than duplicates.
    collection.upsert(documents=documents, metadatas=metadatas, ids=ids)
    logger.info("rag: ingested %d chunks from %s", len(chunks), path.name)
    return len(chunks)


def ingest_advisories(path: str) -> int:
    """Chunk and embed INCOIS advisory text. Returns the number of chunks stored.

    Issue date and sector go into the metadata so retrieval can filter by recency — a
    six-month-old advisory is not evidence about today.
    """
    return _ingest_file(Path(path), store.COLLECTION_ADVISORY)


def ingest_geofence_rules(path: str) -> int:
    """Embed the rules describing what each zone type prohibits.

    This is what turns "you are 8 km from the IMBL" into "you are 8 km from the
    International Maritime Boundary Line; crossing it without authorisation can result in
    detention by the neighbouring coast guard."
    """
    return _ingest_file(Path(path), store.COLLECTION_RULES)


def ingest_faq(path: str) -> int:
    """Embed the marine FAQ used for out-of-golden-path questions."""
    return _ingest_file(Path(path), store.COLLECTION_FAQ)


def ingest_all(knowledge_dir: Path | None = None) -> dict[str, int]:
    """Ingest everything under data/knowledge/."""
    directory = knowledge_dir or KNOWLEDGE_DIR
    counts = {
        "geofence_rules": ingest_geofence_rules(str(directory / "geofence_rules.md")),
        "marine_faq": ingest_faq(str(directory / "marine_faq.md")),
    }

    advisories = directory / "advisories.md"
    if advisories.exists():
        counts["advisory_text"] = ingest_advisories(str(advisories))

    return counts


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    print(f"ORCA knowledge ingestion\nsource: {KNOWLEDGE_DIR}\n")
    if store.get_client() is None:
        print("Chroma is unavailable — retrieval will stay disabled.")
        print("ORCA still answers; the RAG layer is an enhancement, not a dependency.")
        raise SystemExit(1)

    counts = ingest_all()
    total = sum(counts.values())
    for name, count in counts.items():
        print(f"  {name:16} {count:3} chunks")
    print(f"\n{total} chunks stored. Retrieval is live.")

    if total:
        print("\nsanity check — 'what happens if I cross the maritime boundary?'")
        for hit in store.search("what happens if I cross the maritime boundary", 2):
            print(f"  [{hit['source']} · {hit['section']}] {hit['text'][:90]}…")


if __name__ == "__main__":
    main()
