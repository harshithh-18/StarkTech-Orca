"""LLM client — Gemini primary, Groq fallback.

Owner: B · Phase: P0

Gemini 2.x Flash: generous free tier, fast, strong on Indic languages, native tool-calling.
Groq (Llama) sits behind it for the moment Gemini rate-limits — which, on a free tier
during a demo, is a question of when rather than whether.

**Every structured call must request and validate JSON.** An agent that gets prose where it
expected a field list should fail loudly at the boundary, not corrupt graph state.
"""

from __future__ import annotations

from typing import Any


async def complete(
    prompt: str,
    system: str | None = None,
    json_schema: dict | None = None,
    temperature: float = 0.2,
) -> Any:
    """One completion, with automatic fallback to Groq.

    Low default temperature on purpose: this is an evidence system, not a creative one.

    TODO(P0, B): Gemini call via google-genai using settings.gemini_model
    TODO(P0, B): structured output when json_schema is given; validate before returning
    TODO(P1, B): fall back to Groq on rate limit or timeout, and record WHICH model
                 answered — that belongs in the trace
    TODO(P3, B): short timeout with one retry. A 30-second answer has already failed on
                 stage even if it eventually arrives.
    """
    raise NotImplementedError("TODO(P0, B)")


async def complete_in_language(
    prompt: str, language: str, evidence: list | None = None, **kwargs
) -> str:
    """Completion constrained to answer in a specific language, grounded in evidence.

    TODO(P1, B): pass evidence as grounding context with an explicit instruction not to
                 introduce values that aren't in it
    TODO(P2, F): compare Gemini's direct Indic output against a Bhashini NMT round-trip on
                 the four coastal languages, and pick per-language based on what actually
                 reads better to a native speaker
    """
    raise NotImplementedError("TODO(P1, B)")
