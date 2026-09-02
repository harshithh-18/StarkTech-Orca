"""Intent classification and place extraction.

Owner: A · Phase: P1

The deterministic classifier is the floor under every query — it runs with no API key and
is what the LLM falls back to on a rate limit. Two real bugs are pinned here, both found
on 2 Sep 2026 and both invisible while an LLM was masking them:

  1. ``"sail to"`` matched inside "sail TOmorrow", so golden query #2 —
     *"is it safe to sail tomorrow near Kakinada?"* — classified as route planning.
  2. The capitalised-token place heuristic returned ``"What"`` as a place name, which the
     geocoder would then try to resolve to a real coordinate.
"""

from __future__ import annotations

import pytest
from app.agents.language_intent import (
    classify_intent_sync,
    detect_language_sync,
    extract_place_name,
    is_definitional,
    resolve_time_window,
)
from app.schemas.enums import Intent, Language

# ── The golden path ───────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("Where is the nearest Potential Fishing Zone today?", Intent.PFZ_LOOKUP),
        ("Where are the fish today?", Intent.PFZ_LOOKUP),
        ("Is it safe to go to sea tomorrow morning?", Intent.SAFETY_CHECK),
        ("Is it safe to sail tomorrow near Kakinada?", Intent.SAFETY_CHECK),
        ("Am I approaching any restricted boundary?", Intent.GEOFENCE_CHECK),
        ("Why has fish productivity declined in this region?", Intent.DIAGNOSTIC),
        ("Plan a route to Vizag", Intent.ROUTE_PLANNING),
    ],
)
def test_golden_queries_classify(query, expected):
    assert classify_intent_sync(query) is expected


def test_sail_tomorrow_is_not_route_planning():
    """Regression: 'sail to' matched inside 'sail TOmorrow'.

    Substring matching on a phrase ending in a short function word is exactly where this
    goes wrong, and it silently rerouted a golden-path query.
    """
    assert classify_intent_sync("Is it safe to sail tomorrow?") is Intent.SAFETY_CHECK
    assert classify_intent_sync("Can I sail tomorrow near Chennai?") is Intent.SAFETY_CHECK
    # The genuine route phrasing must still work.
    assert classify_intent_sync("I want to sail to Chennai") is Intent.ROUTE_PLANNING


# ── Definitional questions ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "query",
    [
        "What is a Potential Fishing Zone?",
        "What is CAPE?",
        "What does crossing the IMBL mean?",
        "Explain marine protected areas",
        "What can you do?",
    ],
)
def test_definitional_questions_are_general(query):
    """A question ABOUT a concept is not a request to act on it.

    These contain every topic keyword by necessity, so topic matching alone routes them
    to a specialist that needs a location — and the user gets LOCATION_UNRESOLVED for a
    question that never needed one.
    """
    assert is_definitional(query)
    assert classify_intent_sync(query) is Intent.GENERAL


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        # Naming a place makes it a request about the world, not a definition.
        ("What is the wave height near Kakinada?", Intent.SAFETY_CHECK),
        ("What is the best route from Kakinada to Chennai?", Intent.ROUTE_PLANNING),
        # A real diagnostic question also opens with a question word.
        ("Why has fish productivity declined?", Intent.DIAGNOSTIC),
    ],
)
def test_actionable_questions_are_not_swallowed_as_definitional(query, expected):
    assert classify_intent_sync(query) is expected


# ── Place extraction ──────────────────────────────────────────────────────


def test_question_words_are_not_places():
    """Regression: 'What' was returned as a place name and handed to the geocoder."""
    for query in (
        "What is a Potential Fishing Zone?",
        "Where is the nearest fishing zone?",
        "Explain marine protected areas",
        "Why has productivity declined?",
    ):
        assert extract_place_name(query) is None, f"{query!r} has no place in it"


def test_real_places_are_found():
    assert extract_place_name("Is it safe near Kakinada?") == "kakinada"
    assert extract_place_name("conditions off Vizag") == "vizag"
    # Regional script must work too — it is what users actually type.
    assert extract_place_name("విశాఖపట్నం దగ్గర") == "విశాఖపట్నం"


# ── Language ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Is it safe to go to sea?", Language.ENGLISH),
        ("రేపు సముద్రంలోకి వెళ్ళడం సురక్షితమేనా?", Language.TELUGU),
        ("நாளை கடலுக்கு போகலாமா?", Language.TAMIL),
        ("രേപു കടലിൽ പോകാമോ?", Language.MALAYALAM),
        ("আগামীকাল সমুদ্রে যাওয়া কি নিরাপদ?", Language.BENGALI),
        ("कल समुद्र में जाना सुरक्षित है?", Language.HINDI),
    ],
)
def test_script_detects_language(text, expected):
    """Script identifies these languages exactly — no model call, no network."""
    assert detect_language_sync(text) is expected


def test_all_coastal_languages_reach_safety_check():
    """The safety query must classify in every demo language, with no LLM."""
    for query in (
        "Is it safe to go to sea tomorrow?",
        "రేపు సముద్రంలోకి వెళ్ళడం సురక్షితమేనా?",
        "நாளை கடலுக்கு போகலாமா?",
        "രേപു കടലിൽ പോകാമോ?",
        "আগামীকাল সমুদ্রে যাওয়া কি নিরাপদ?",
        "कल समुद्र में जाना सुरक्षित है?",
    ):
        assert classify_intent_sync(query) is Intent.SAFETY_CHECK, query


# ── Time windows ──────────────────────────────────────────────────────────


def test_tomorrow_morning_resolves_to_a_morning():
    window = resolve_time_window("Is it safe tomorrow morning?")
    assert window["phrase"] == "tomorrow morning"
    assert window["start"] < window["end"]


def test_default_window_when_no_phrase_given():
    window = resolve_time_window("Is it safe?")
    assert window["phrase"] == "next 12 hours"
