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

## How the ULCA API works

Two calls, not one:

  1. **Pipeline config** — POST to ``ULCA_ENDPOINT`` with your ``userID`` and
     ``ulcaApiKey``, saying which task (translation) and which language pair. It replies
     with a *service id* and a callback URL plus its own inference key.
  2. **Compute** — POST the actual text to that callback URL with the service id.

The config response is stable for a language pair, so it is cached for the process
lifetime; re-fetching it per translation would double every latency.

Without credentials every entry point raises ``BhashiniUnavailable`` and the caller falls
back to the LLM translator — the multilingual demo must not depend on a single provider.
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

ULCA_ENDPOINT = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"

# The pipeline id every ULCA account gets by default (MeitY's own bundle). Overridable
# via BHASHINI_PIPELINE_ID for teams issued a different one.
DEFAULT_PIPELINE_ID = "64392f96daac500b55c543cd"

TASK_TRANSLATION = "translation"
TASK_ASR = "asr"
TASK_TTS = "tts"

ATTRIBUTION = "Translation by Bhashini, Ministry of Electronics and IT, Government of India"

# Languages Bhashini NMT covers that we care about. Anything outside this set goes
# straight to the LLM fallback rather than making a call we know will fail.
SUPPORTED = {"en", "hi", "ta", "te", "ml", "bn", "kn", "mr", "gu", "or", "pa", "as", "ur"}

_pipeline_cache: dict[tuple[str, str, str], dict] = {}


class BhashiniUnavailable(Exception):
    """No credentials, or the service could not answer. Callers fall back."""


def available() -> bool:
    """True when ULCA credentials are configured."""
    settings = get_settings()
    return bool(settings.bhashini_user_id and settings.bhashini_api_key)


def supports(source_lang: str, target_lang: str) -> bool:
    return source_lang in SUPPORTED and target_lang in SUPPORTED


async def _pipeline_config(task: str, source_lang: str, target_lang: str) -> dict:
    """Fetch (and cache) the pipeline config for one task and language pair."""
    key = (task, source_lang, target_lang)
    if key in _pipeline_cache:
        return _pipeline_cache[key]

    settings = get_settings()
    if not available():
        raise BhashiniUnavailable(
            "BHASHINI_USER_ID / BHASHINI_API_KEY are not set — register at "
            "https://bhashini.gov.in/ulca"
        )

    from app.adapters.base import get_client

    language_config: dict[str, Any] = {"sourceLanguage": source_lang}
    if task == TASK_TRANSLATION:
        language_config["targetLanguage"] = target_lang

    body = {
        "pipelineTasks": [{"taskType": task, "config": {"language": language_config}}],
        "pipelineRequestConfig": {
            "pipelineId": settings.bhashini_pipeline_id or DEFAULT_PIPELINE_ID
        },
    }
    headers = {
        "userID": settings.bhashini_user_id,
        "ulcaApiKey": settings.bhashini_api_key,
        "Content-Type": "application/json",
    }

    client = get_client()
    response = await client.post(ULCA_ENDPOINT, json=body, headers=headers, timeout=20)
    if response.status_code != 200:
        raise BhashiniUnavailable(
            f"ULCA pipeline config returned HTTP {response.status_code}: "
            f"{response.text[:200]}"
        )

    payload = response.json()
    try:
        endpoint = payload["pipelineInferenceAPIEndPoint"]
        config = {
            "callback_url": endpoint["callbackUrl"],
            "auth_name": endpoint["inferenceApiKey"]["name"],
            "auth_value": endpoint["inferenceApiKey"]["value"],
            "service_id": payload["pipelineResponseConfig"][0]["config"][0]["serviceId"],
        }
    except (KeyError, IndexError, TypeError) as exc:
        raise BhashiniUnavailable(
            f"unexpected ULCA pipeline response shape: {exc}"
        ) from exc

    _pipeline_cache[key] = config
    logger.info("bhashini: pipeline ready for %s %s→%s", task, source_lang, target_lang)
    return config


async def translate(text: str, source_lang: str, target_lang: str) -> str:
    """NMT between two Indian languages (or to/from English).

    Raises ``BhashiniUnavailable`` rather than returning the input unchanged: silently
    handing back English while claiming a translation happened is the kind of failure the
    user cannot see.
    """
    if not text.strip():
        return text
    if source_lang == target_lang:
        return text
    if not supports(source_lang, target_lang):
        raise BhashiniUnavailable(
            f"Bhashini NMT does not cover {source_lang}→{target_lang}"
        )

    config = await _pipeline_config(TASK_TRANSLATION, source_lang, target_lang)

    from app.adapters.base import get_client

    body = {
        "pipelineTasks": [
            {
                "taskType": TASK_TRANSLATION,
                "config": {
                    "language": {
                        "sourceLanguage": source_lang,
                        "targetLanguage": target_lang,
                    },
                    "serviceId": config["service_id"],
                },
            }
        ],
        "inputData": {"input": [{"source": text}]},
    }

    client = get_client()
    response = await client.post(
        config["callback_url"],
        json=body,
        headers={
            config["auth_name"]: config["auth_value"],
            "Content-Type": "application/json",
        },
        timeout=20,
    )
    if response.status_code != 200:
        raise BhashiniUnavailable(
            f"Bhashini compute returned HTTP {response.status_code}: {response.text[:200]}"
        )

    try:
        translated = response.json()["pipelineResponse"][0]["output"][0]["target"]
    except (KeyError, IndexError, TypeError) as exc:
        raise BhashiniUnavailable(f"unexpected Bhashini response shape: {exc}") from exc

    if not translated or not translated.strip():
        raise BhashiniUnavailable("Bhashini returned an empty translation")

    return translated.strip()


async def speech_to_text(audio_bytes: bytes, language: str) -> str:
    """ASR — Indic speech to text. STRETCH.

    TODO(P3, F): Bhashini ASR pipeline — the config call above already accepts
                 TASK_ASR; the compute body takes base64 audio in inputData.audio.
    TODO(P3, F): expect harbour background noise in any real use; test with a phone
                 recording, not a quiet room.
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

    Unnecessary on the text path — ``agents.language_intent`` already detects from
    Unicode script, which is exact for these languages and needs no network call. Kept
    for the audio path, where there is no text to classify upstream.
    """
    raise NotImplementedError("TODO(P3, F) — only needed for the voice path")
