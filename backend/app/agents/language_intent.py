"""Language + Intent Agent — the front door.

Owner: A (with F on language) · Phase: P1 · Type: LLM

One LLM call does four jobs at once — cheaper and more accurate than four separate
classifiers, because they inform each other ("రేపు" tells you both the language and the
time window):

  1. detect the language (ISO 639-1)
  2. classify the intent against the golden path
  3. extract the location — a place name, or a relative reference ("here", "there")
  4. resolve the time window — "tomorrow morning" → a concrete UTC interval

If the user names a place, it's geocoded via ``adapters.open_meteo_geocoding``. If the
query refers to a previous turn ("…and is it safe there?"), the location comes from graph
state instead — that follow-up is the demo beat that proves conversational memory, so it
matters more than its size suggests.
"""

from __future__ import annotations

from app.schemas.enums import Intent, Language
from app.schemas.response import Location


async def detect_and_classify(
    query: str,
    session_context: dict | None = None,
    lat: float | None = None,
    lon: float | None = None,
) -> dict:
    """Return {'language', 'intent', 'location', 'time_window'}.

    Resolution order for location:
      1. explicit lat/lon from device GPS
      2. a place name in the query → geocode it
      3. a referential mention ("there", "that zone") → session_context
      4. nothing → intent still classifies; the caller raises LOCATION_UNRESOLVED

    TODO(P1, A): single Gemini call, structured JSON out (services.llm)
    TODO(P1, A): geocode place names via adapters.open_meteo_geocoding, biased to India
    TODO(P2, A): resolve referential locations from session_context
    TODO(P2, F): verify detection on Telugu/Tamil/Malayalam/Bengali script AND on
                 romanised input ("rEpu samudram") — fishermen type both ways
    """
    raise NotImplementedError("TODO(P1, A)")


async def detect_language(text: str) -> Language:
    """Standalone language detection, for when only the language is needed.

    TODO(P1, A)
    """
    raise NotImplementedError("TODO(P1, A)")


async def classify_intent(query: str) -> Intent:
    """Standalone intent classification.

    TODO(P1, A): anything off the golden path → Intent.GENERAL. Answer it honestly and
                 say what ORCA can do, rather than faking a capability.
    """
    raise NotImplementedError("TODO(P1, A)")


async def resolve_location(query: str, session_context: dict | None = None) -> Location | None:
    """TODO(P1, A)"""
    raise NotImplementedError("TODO(P1, A)")
