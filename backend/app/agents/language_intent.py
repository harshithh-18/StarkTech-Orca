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

## Deterministic floor

Every job here has a rule-based implementation that runs when no LLM is configured or
when every provider fails: Unicode script ranges identify the language, keyword sets
classify the intent, and a phrase table resolves the time window. The LLM improves
accuracy on messy input; it is never required for the golden path to work.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone

from app.adapters.open_meteo_geocoding import HARBOUR_ALIASES, geocode
from app.schemas.enums import Intent, Language
from app.schemas.response import Location
from app.services import llm

logger = logging.getLogger(__name__)

# Unicode block ranges for the scripts of the coastal languages. Script identifies the
# language unambiguously for these — Telugu text is Telugu, there is no ambiguity to
# resolve — so this is genuinely reliable, not a rough guess.
_SCRIPT_RANGES: list[tuple[int, int, Language]] = [
    (0x0B80, 0x0BFF, Language.TAMIL),
    (0x0C00, 0x0C7F, Language.TELUGU),
    (0x0D00, 0x0D7F, Language.MALAYALAM),
    (0x0980, 0x09FF, Language.BENGALI),
    (0x0900, 0x097F, Language.HINDI),      # Devanagari — also Marathi, disambiguated below
    (0x0C80, 0x0CFF, Language.KANNADA),
    (0x0A80, 0x0AFF, Language.GUJARATI),
    (0x0B00, 0x0B7F, Language.ODIA),
]

# Words that are distinctively Marathi rather than Hindi, both being Devanagari.
_MARATHI_MARKERS = ("आहे", "नाही", "समुद्रात", "मासे", "उद्या")

# Intent keywords, in English and romanised/native forms a coastal user might type.
# Ordered by specificity: the first intent with a match wins, so narrow intents come
# before broad ones.
_INTENT_KEYWORDS: list[tuple[Intent, tuple[str, ...]]] = [
    (
        Intent.PFZ_LOOKUP,
        (
            "fishing zone", "fish zone", "pfz", "potential fishing", "where.*fish",
            "catch fish", "good fishing", "fishing ground", "chepa", "చేపల", "மீன்",
            "മത്സ്യ", "মাছ", "मछली", "matsya", "meen",
        ),
    ),
    (
        Intent.GEOFENCE_CHECK,
        (
            "boundary", "border", "restricted", "imbl", "eez", "protected area",
            "marine protected", "maritime boundary", "am i near", "am i approaching",
            "crossing", "సరిహద్దు", "எல்லை", "সীমানা", "सीमा",
        ),
    ),
    (
        Intent.DIAGNOSTIC,
        (
            "why", "decline", "declined", "decrease", "productivity", "fewer fish",
            "less fish", "no fish", "chlorophyll", "ఎందుకు", "ஏன்", "কেন", "क्यों",
        ),
    ),
    (
        Intent.ROUTE_PLANNING,
        ("route", "path", "shortest way", "how do i get to", "sail to", "navigate to"),
    ),
    (
        Intent.SAFETY_CHECK,
        (
            "safe", "safety", "danger", "dangerous", "go to sea", "sail", "weather",
            "wave", "wind", "storm", "cyclone", "can i go", "should i go",
            # Native-script terms for "safe", "sea" and "may I go" — a query like
            # "நாளை கடலுக்கு போகலாமா?" names the sea and the going, never the safety.
            "సురక్షిత", "పోవచ్చ", "సముద్ర", "వెళ్ళ",
            "பாதுகாப்", "கடல", "போகலாம", "போக",
            "കടല", "പോക", "സുരക്ഷ",
            "নিরাপদ", "সমুদ্র", "সাগর",
            "सुरक्षित", "समुद्र", "जाऊ", "जाना",
        ),
    ),
]

# Relative time phrases → (offset from now, window length). Hours are UTC.
_TIME_PHRASES: list[tuple[tuple[str, ...], timedelta, timedelta]] = [
    (("tonight", "இன்று இரவு", "ఈ రాత్రి"), timedelta(hours=8), timedelta(hours=8)),
    (
        ("tomorrow morning", "రేపు ఉదయం", "நாளை காலை", "कल सुबह"),
        timedelta(days=1),
        timedelta(hours=6),
    ),
    (("tomorrow", "రేపు", "நாளை", "কাল", "कल"), timedelta(days=1), timedelta(hours=12)),
    (("day after tomorrow", "ఎల్లుండి", "நாளன்று"), timedelta(days=2), timedelta(hours=12)),
    (("this week", "next few days"), timedelta(0), timedelta(days=5)),
    (("today", "now", "ఈరోజు", "இன்று", "आज"), timedelta(0), timedelta(hours=12)),
]

# References to a location established in a previous turn — the multi-turn demo beat.
_REFERENTIAL = (
    "there", "that zone", "that area", "that spot", "the zone", "same place",
    "అక్కడ", "அங்கு", "সেখানে", "वहाँ", "वहां",
)

# Words that look like place names but aren't, so we don't geocode "Sea" or "Tomorrow".
_NOT_A_PLACE = {
    "sea", "ocean", "coast", "shore", "harbour", "harbor", "port", "today",
    "tomorrow", "tonight", "morning", "evening", "night", "safe", "fishing",
    "zone", "the", "is", "it", "to", "go", "near", "am", "i", "my", "we",
}


def detect_language_sync(text: str) -> Language:
    """Script-based language detection. No I/O, always available."""
    counts: dict[Language, int] = {}
    for char in text:
        code = ord(char)
        for low, high, language in _SCRIPT_RANGES:
            if low <= code <= high:
                counts[language] = counts.get(language, 0) + 1
                break

    if not counts:
        return Language.ENGLISH

    best = max(counts, key=lambda k: counts[k])
    if best is Language.HINDI and any(m in text for m in _MARATHI_MARKERS):
        return Language.MARATHI
    return best


async def detect_language(text: str) -> Language:
    """Standalone language detection, for when only the language is needed."""
    return detect_language_sync(text)


def classify_intent_sync(query: str) -> Intent:
    """Keyword-based intent classification. No I/O, always available."""
    lowered = query.casefold()
    for intent, keywords in _INTENT_KEYWORDS:
        for keyword in keywords:
            # A few entries are regexes ("where.*fish"); plain substrings work under
            # re.search too, so one code path handles both.
            if re.search(keyword, lowered):
                return intent
    return Intent.GENERAL


async def classify_intent(query: str) -> Intent:
    """Standalone intent classification.

    Anything off the golden path is ``Intent.GENERAL`` — answered honestly by saying what
    ORCA can do, rather than faking a capability.
    """
    return classify_intent_sync(query)


def resolve_time_window(query: str, now: datetime | None = None) -> dict:
    """Resolve a relative time phrase to a concrete UTC interval.

    Defaults to the next 12 hours, which is the window a fisherman leaving at dawn
    actually cares about.
    """
    now = now or datetime.now(timezone.utc)
    lowered = query.casefold()

    for phrases, offset, length in _TIME_PHRASES:
        for phrase in phrases:
            if phrase in lowered:
                start = now + offset
                if "morning" in phrase or "ఉదయం" in phrase or "காலை" in phrase or "सुबह" in phrase:
                    # Anchor "morning" to 00:00–06:00 UTC ≈ 05:30–11:30 IST, which is
                    # when boats actually leave.
                    start = start.replace(hour=0, minute=0, second=0, microsecond=0)
                return {
                    "start": start.isoformat(),
                    "end": (start + length).isoformat(),
                    "phrase": phrase,
                }

    return {
        "start": now.isoformat(),
        "end": (now + timedelta(hours=12)).isoformat(),
        "phrase": "next 12 hours",
    }


def extract_place_name(query: str) -> str | None:
    """Pull a candidate place name out of the query.

    Checks the harbour alias table first — it covers the names our users actually type,
    in every script — then falls back to a capitalised-token heuristic for English.
    """
    lowered = query.casefold()

    # Longest alias first, so "Visakhapatnam" wins over a hypothetical "Visakha".
    for alias in sorted(HARBOUR_ALIASES, key=len, reverse=True):
        if alias in lowered:
            return alias

    # "near X", "at X", "off X" — the usual phrasings.
    match = re.search(
        r"\b(?:near|at|off|around|close to)\s+([A-Z][\w-￿]+(?:\s+[A-Z][\w-￿]+)?)",
        query,
    )
    if match:
        candidate = match.group(1).strip()
        if candidate.casefold() not in _NOT_A_PLACE:
            return candidate

    # Any capitalised token that isn't a sentence-initial stopword.
    for token in re.findall(r"\b[A-Z][a-z-￿]{3,}\b", query):
        if token.casefold() not in _NOT_A_PLACE:
            return token

    return None


def _is_referential(query: str) -> bool:
    """Does this query point at a location from a previous turn?"""
    lowered = query.casefold()
    return any(ref in lowered for ref in _REFERENTIAL)


async def resolve_location(query: str, session_context: dict | None = None) -> Location | None:
    """Resolve the query's location: a named place, or the previous turn's."""
    name = extract_place_name(query)
    if name:
        located = await geocode(name)
        if located is not None:
            return located
        logger.info("language_intent: could not geocode '%s'", name)

    if _is_referential(query) and session_context:
        previous = session_context.get("location")
        if previous:
            location = (
                previous if isinstance(previous, Location) else Location(**previous)
            )
            # Re-label the source: this point came from memory, not from this query.
            return Location(
                lat=location.lat,
                lon=location.lon,
                name=location.name,
                source="session_context",
            )

    return None


async def _classify_with_llm(query: str, session_context: dict | None) -> dict | None:
    """One structured LLM call covering all four jobs. Returns None if unavailable."""
    if not llm.available():
        return None

    schema = {
        "type": "object",
        "properties": {
            "language": {"type": "string", "description": "ISO 639-1 code"},
            "intent": {
                "type": "string",
                "enum": [i.value for i in Intent],
            },
            "place_name": {
                "type": ["string", "null"],
                "description": "Place named in the query, or null",
            },
            "refers_to_previous_location": {"type": "boolean"},
            "time_phrase": {
                "type": ["string", "null"],
                "description": "Relative time phrase such as 'tomorrow morning', or null",
            },
        },
        "required": ["language", "intent", "refers_to_previous_location"],
    }

    system = (
        "You classify queries for ORCA, a marine advisory system for Indian coastal "
        "fishermen. Queries arrive in any Indian language, in native script or romanised. "
        "Classify precisely and never invent a place name that is not in the query."
    )
    context_note = ""
    if session_context and session_context.get("location"):
        previous = session_context["location"]
        name = previous.get("name") if isinstance(previous, dict) else previous.name
        context_note = f"\n\nThe previous turn in this conversation was about: {name}."

    try:
        result = await llm.complete(
            f"Query: {query}{context_note}",
            system=system,
            json_schema=schema,
        )
    except Exception as exc:  # noqa: BLE001 - any failure drops to the deterministic path
        logger.warning("language_intent: LLM classification failed (%s)", exc)
        return None

    if not isinstance(result, dict):
        return None
    return result


async def detect_and_classify(
    query: str,
    session_context: dict | None = None,
    lat: float | None = None,
    lon: float | None = None,
) -> dict:
    """Return {'language', 'intent', 'location', 'time_window', 'method'}.

    Resolution order for location:
      1. explicit lat/lon from device GPS
      2. a place name in the query → geocode it
      3. a referential mention ("there", "that zone") → session_context
      4. nothing → intent still classifies; the caller raises LOCATION_UNRESOLVED
    """
    # Deterministic pass first: it always succeeds, so there is always an answer to fall
    # back to if the model is slow, rate-limited or absent.
    language = detect_language_sync(query)
    intent = classify_intent_sync(query)
    time_window = resolve_time_window(query)
    method = "rules"

    enriched = await _classify_with_llm(query, session_context)
    if enriched:
        method = f"llm ({llm.complete.last_provider})"  # type: ignore[attr-defined]
        try:
            language = Language(enriched.get("language", language.value))
        except ValueError:
            logger.info(
                "language_intent: LLM returned unsupported language %r, keeping %s",
                enriched.get("language"),
                language.value,
            )
        try:
            intent = Intent(enriched.get("intent", intent.value))
        except ValueError:
            logger.info(
                "language_intent: LLM returned unknown intent %r, keeping %s",
                enriched.get("intent"),
                intent.value,
            )

    # ── Location ──────────────────────────────────────────────────────────
    location: Location | None = None
    if lat is not None and lon is not None:
        location = Location(lat=lat, lon=lon, name=None, source="gps")
    else:
        place = None
        if enriched and enriched.get("place_name"):
            place = str(enriched["place_name"])
        if place:
            location = await geocode(place)
        if location is None:
            location = await resolve_location(query, session_context)
        if (
            location is None
            and enriched
            and enriched.get("refers_to_previous_location")
            and session_context
            and session_context.get("location")
        ):
            previous = session_context["location"]
            previous = previous if isinstance(previous, Location) else Location(**previous)
            location = Location(
                lat=previous.lat,
                lon=previous.lon,
                name=previous.name,
                source="session_context",
            )

    return {
        "language": language,
        "intent": intent,
        "location": location,
        "time_window": time_window,
        "method": method,
    }
