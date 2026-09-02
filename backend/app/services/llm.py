"""LLM client — Gemini primary, Groq fallback.

Owner: B · Phase: P0

Gemini 2.x Flash: generous free tier, fast, strong on Indic languages, native tool-calling.
Groq (Llama) sits behind it for the moment Gemini rate-limits — which, on a free tier
during a demo, is a question of when rather than whether.

**Every structured call must request and validate JSON.** An agent that gets prose where it
expected a field list should fail loudly at the boundary, not corrupt graph state.

## No key is a supported state, not an error

``available()`` reports whether any provider is configured. Every caller on the golden path
has a deterministic fallback, so ORCA answers correctly with no key at all — the model
improves phrasing and edge-case classification, it is never load-bearing. That is also the
P3 rate-limit story: if both providers fail mid-demo, the run degrades instead of dying.

``last_provider`` records who actually answered so the trace can say so.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

# Short, with one retry. A 30-second answer has already failed on stage even if it
# eventually arrives.
LLM_TIMEOUT_SECONDS = 12.0


class LLMUnavailable(Exception):
    """No provider could answer. Callers fall back to their deterministic path."""


def available() -> bool:
    """True if at least one provider has a key configured."""
    settings = get_settings()
    return bool(settings.gemini_api_key or settings.groq_api_key)


def providers() -> list[str]:
    """Configured providers, in the order they will be tried."""
    settings = get_settings()
    names = []
    if settings.gemini_api_key:
        names.append(f"gemini:{settings.gemini_model}")
    if settings.groq_api_key:
        names.append(f"groq:{settings.groq_model}")
    return names


def _extract_json(text: str) -> Any:
    """Pull a JSON value out of a model response.

    Models wrap JSON in prose or ```json fences no matter how firmly the prompt asks them
    not to. Parsing defensively here is cheaper than one malformed response corrupting
    graph state — and a genuine failure still raises, so it fails at this boundary rather
    than three nodes downstream.
    """
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fall back to the outermost {...} or [...] span.
    for opener, closer in (("{", "}"), ("[", "]")):
        start, end = text.find(opener), text.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                continue

    raise ValueError(f"model did not return JSON: {text[:200]}")


async def _complete_gemini(prompt: str, system: str | None, temperature: float, want_json: bool) -> str:
    from google import genai
    from google.genai import types

    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)

    config = types.GenerateContentConfig(
        temperature=temperature,
        system_instruction=system,
        response_mime_type="application/json" if want_json else None,
    )
    response = await asyncio.wait_for(
        client.aio.models.generate_content(
            model=settings.gemini_model, contents=prompt, config=config
        ),
        timeout=LLM_TIMEOUT_SECONDS,
    )
    return response.text or ""


async def _complete_groq(prompt: str, system: str | None, temperature: float, want_json: bool) -> str:
    from groq import AsyncGroq

    settings = get_settings()
    client = AsyncGroq(api_key=settings.groq_api_key)

    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = await asyncio.wait_for(
        client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            response_format={"type": "json_object"} if want_json else None,  # type: ignore[arg-type]
        ),
        timeout=LLM_TIMEOUT_SECONDS,
    )
    return response.choices[0].message.content or ""


async def complete(
    prompt: str,
    system: str | None = None,
    json_schema: dict | None = None,
    temperature: float = 0.2,
) -> Any:
    """One completion, with automatic fallback to Groq.

    Low default temperature on purpose: this is an evidence system, not a creative one.

    Returns parsed JSON when ``json_schema`` is given, otherwise the raw text. Raises
    ``LLMUnavailable`` when every provider fails — callers catch it and degrade.
    """
    settings = get_settings()
    want_json = json_schema is not None

    if want_json:
        prompt = (
            f"{prompt}\n\nRespond with JSON matching this schema, and nothing else:\n"
            f"{json.dumps(json_schema, indent=2)}"
        )

    attempts: list[tuple[str, Any]] = []
    if settings.gemini_api_key:
        attempts.append((f"gemini:{settings.gemini_model}", _complete_gemini))
    if settings.groq_api_key:
        attempts.append((f"groq:{settings.groq_model}", _complete_groq))

    if not attempts:
        raise LLMUnavailable("no LLM provider is configured (set GEMINI_API_KEY or GROQ_API_KEY)")

    errors = []
    for name, fn in attempts:
        try:
            text = await fn(prompt, system, temperature, want_json)
            if not text.strip():
                raise ValueError("empty response")
            result = _extract_json(text) if want_json else text.strip()
            complete.last_provider = name  # type: ignore[attr-defined]
            logger.debug("llm: %s answered", name)
            return result
        except Exception as exc:  # noqa: BLE001 - any provider failure moves to the next
            logger.warning("llm: %s failed (%s)", name, exc)
            errors.append(f"{name}: {exc}")

    complete.last_provider = None  # type: ignore[attr-defined]
    raise LLMUnavailable("; ".join(errors))


complete.last_provider = None  # type: ignore[attr-defined]


async def complete_in_language(
    prompt: str, language: str, evidence: list | None = None, **kwargs
) -> str:
    """Completion constrained to answer in a specific language, grounded in evidence.

    The grounding instruction is strict on purpose: if a value is not in the evidence
    list, it must not appear in the answer. That rule is what makes the citations under
    the answer mean something.
    """
    grounding = ""
    if evidence:
        lines = []
        for item in evidence:
            unit = f" {item.unit}" if getattr(item, "unit", None) else ""
            when = f" at {item.time:%Y-%m-%d %H:%M} UTC" if getattr(item, "time", None) else ""
            lines.append(f"- {item.field}: {item.value}{unit}{when} (source: {item.source})")
        grounding = (
            "\n\nThese are the ONLY facts you may use. Do not introduce any number, "
            "place or time that is not listed here. If something is not listed, say it "
            "is unavailable rather than estimating it.\n" + "\n".join(lines)
        )

    system = (
        f"You are ORCA, a marine safety advisor for Indian coastal fishermen. "
        f"Reply ONLY in the language with ISO 639-1 code '{language}'. "
        f"Be brief and concrete — two or three short sentences. The reader may be on a "
        f"phone at 4 a.m. before leaving harbour.\n\n"
        # Hard prohibition, learned from a real failure: asked to phrase a geofence
        # result 2.3 km from the Sri Lanka maritime boundary, the model volunteered
        # "Continue your current course" — advice nobody computed, in the exact
        # situation where fishermen get detained. State the facts; do not steer the boat.
        f"CRITICAL RULES:\n"
        f"- Report ONLY the facts given to you. Do NOT add navigational or course advice.\n"
        f"- Never write 'stay on course', 'proceed', 'continue', 'you may go' or any "
        f"other instruction about whether to sail or where to steer, unless that exact "
        f"recommendation is stated in the facts.\n"
        f"- Never reassure. If the facts describe a risk, do not soften it.\n"
        f"- Do not introduce any number, distance, place or time that is not in the facts.\n"
        # A value-free rule is not enough: asked to phrase chlorophyll of 2.447 mg/m³
        # (nearly ten times the productive threshold), the model wrote "both low,
        # indicating reduced primary productivity". It invented no number — it invented
        # the judgement, which was flatly wrong and read as science.
        f"- Do NOT interpret or characterise the data. Never call a value high, low, "
        f"good, poor, rising or falling, and never state a cause or consequence, unless "
        f"the facts say so in those words. Report the values and what the facts state "
        f"about them; nothing more."
    )

    return await complete(prompt + grounding, system=system, **kwargs)
