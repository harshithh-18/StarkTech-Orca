"""Bhashini — ASR, NMT and TTS for Indian languages.

Owner: F · Phase: P2 (text) / P3 (voice)
Register: https://bhashini.gov.in/ulca — create a user, then a pipeline.

**Why Bhashini specifically.** It's the Government of India's national language mission.
Using the government's own Indic AI stack on a government marine problem statement is a
deliberate signal to SIH judges — call it out in the deck, don't let it pass unnoticed.

Order of work: **text first, voice second.** NMT is on the golden path; ASR and TTS are the
wow-factor behind it. If P2 slips, voice is the first thing to cut and it costs nothing.

Pipeline for the voice stretch:

    mic → ASR → agent graph → response → TTS → speaker
"""

from __future__ import annotations

ULCA_ENDPOINT = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"


async def translate(text: str, source_lang: str, target_lang: str) -> str:
    """NMT between two Indian languages (or to/from English).

    TODO(P2, F): call the Bhashini NMT pipeline
    TODO(P2, F): fall back to Gemini's own translation if Bhashini is unavailable —
                 the demo must not depend on a single translation provider
    TODO(P2, F): have native speakers check ta / te / ml / bn output. Marine safety
                 vocabulary is specialised, and a translation that reads as bland advice
                 when it should read as a warning is a real failure, not a cosmetic one.
    """
    raise NotImplementedError("TODO(P2, F)")


async def speech_to_text(audio_bytes: bytes, language: str) -> str:
    """ASR — Indic speech to text. STRETCH.

    TODO(P3, F): Bhashini ASR pipeline
    TODO(P3, F): expect harbour background noise in any real use; test with a phone
                 recording, not a quiet room
    """
    raise NotImplementedError("TODO(P3, F) — stretch")


async def text_to_speech(text: str, language: str) -> bytes:
    """TTS — text to Indic speech. STRETCH.

    TODO(P3, F): Bhashini TTS pipeline
    TODO(P3, F): the verdict must be spoken FIRST ("do not go to sea today"), before the
                 explanation. Someone listening on a boat may not hear the whole clip.
    """
    raise NotImplementedError("TODO(P3, F) — stretch")


async def detect_language(text: str) -> str:
    """Language identification.

    TODO(P2, F): usually unnecessary — the Language+Intent agent already detects. Keep
                 this for the audio path, where there's no text to classify upstream.
    """
    raise NotImplementedError("TODO(P2, F)")
