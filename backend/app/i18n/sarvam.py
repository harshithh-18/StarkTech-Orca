"""Sarvam AI — fallback for Indic ASR / TTS / translation.

Owner: F · Phase: P3
Docs: https://dashboard.sarvam.ai/

Bhashini is the primary and the one worth naming in the deck. Sarvam is here so that a
Bhashini outage during the demo window doesn't take the multilingual story down with it.

Keep the interface identical to ``bhashini.py`` so swapping is a one-line change.
"""

from __future__ import annotations


async def translate(text: str, source_lang: str, target_lang: str) -> str:
    """TODO(P3, F)"""
    raise NotImplementedError("TODO(P3, F)")


async def speech_to_text(audio_bytes: bytes, language: str) -> str:
    """TODO(P3, F)"""
    raise NotImplementedError("TODO(P3, F)")


async def text_to_speech(text: str, language: str) -> bytes:
    """TODO(P3, F)"""
    raise NotImplementedError("TODO(P3, F)")
