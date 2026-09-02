"""Multilingual path tests.

Owner: F (with C) · Phase: P2

The translation chain is **Bhashini → LLM → English**. Bhashini is the Government of
India's own Indic stack and the right primary for a government problem statement; the LLM
sits behind it so one provider's outage cannot take the multilingual story down; English
is the last rung because a warning the user can still read beats no warning.

Two properties matter more than the prose quality:
  - a safety warning is never *lost* by a translation failure
  - Bhashini is credited only when it actually ran
"""

from __future__ import annotations

import pytest
from app.i18n import bhashini
from app.services import explainability, llm

WARNING = "WARNING — you are only 2.3 km from an international maritime boundary."


@pytest.fixture(autouse=True)
def _fresh_tracking():
    explainability.begin_translation_tracking()


# ── Provider selection ────────────────────────────────────────────────────


def test_bhashini_language_coverage():
    assert bhashini.supports("en", "ta")
    assert bhashini.supports("en", "te")
    assert bhashini.supports("hi", "ml")
    # Non-Indic targets go straight to the LLM rather than a call we know will 400.
    assert not bhashini.supports("en", "fr")
    assert not bhashini.supports("en", "zh")


def test_unconfigured_bhashini_reports_unavailable(monkeypatch):
    monkeypatch.setattr(bhashini, "available", lambda: False)
    assert not bhashini.available()


@pytest.mark.asyncio
async def test_bhashini_is_preferred_over_the_llm(monkeypatch):
    """The government stack goes first when it is configured."""
    monkeypatch.setattr(bhashini, "available", lambda: True)

    async def fake_bhashini(text, source, target):
        return "எச்சரிக்கை — 2.3 km"

    async def llm_must_not_run(*args, **kwargs):
        raise AssertionError("the LLM must not be called when Bhashini succeeds")

    monkeypatch.setattr(bhashini, "translate", fake_bhashini)
    monkeypatch.setattr(llm, "complete", llm_must_not_run)

    assert await explainability.translate_only(WARNING, "ta") == "எச்சரிக்கை — 2.3 km"


@pytest.mark.asyncio
async def test_falls_back_to_the_llm_when_bhashini_fails(monkeypatch):
    """A Bhashini outage must not take the multilingual answer down with it."""
    monkeypatch.setattr(bhashini, "available", lambda: True)

    async def bhashini_down(text, source, target):
        raise bhashini.BhashiniUnavailable("ULCA 503")

    async def fake_llm(text, system=None, **kwargs):
        return "எச்சரிக்கை (LLM) — 2.3 km"

    monkeypatch.setattr(bhashini, "translate", bhashini_down)
    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(llm, "complete", fake_llm)

    result = await explainability.translate_only(WARNING, "ta")
    assert "LLM" in result


@pytest.mark.asyncio
async def test_falls_back_to_english_when_both_fail(monkeypatch):
    """The warning survives even with every translator down."""
    monkeypatch.setattr(bhashini, "available", lambda: True)

    async def down(*args, **kwargs):
        raise bhashini.BhashiniUnavailable("down")

    monkeypatch.setattr(bhashini, "translate", down)
    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(llm, "complete", down)

    assert await explainability.translate_only(WARNING, "ta") == WARNING


@pytest.mark.asyncio
async def test_english_needs_no_translator(monkeypatch):
    async def must_not_run(*args, **kwargs):
        raise AssertionError("English must not invoke a translator")

    monkeypatch.setattr(bhashini, "translate", must_not_run)
    monkeypatch.setattr(llm, "complete", must_not_run)

    assert await explainability.translate_only(WARNING, "en") == WARNING


# ── Attribution honesty ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_bhashini_credited_only_when_it_actually_ran(monkeypatch):
    monkeypatch.setattr(bhashini, "available", lambda: True)

    async def fake_bhashini(text, source, target):
        return "மொழிபெயர்ப்பு"

    monkeypatch.setattr(bhashini, "translate", fake_bhashini)

    assert explainability.translation_attribution() == []
    await explainability.translate_only(WARNING, "ta")

    attribution = explainability.translation_attribution()
    assert len(attribution) == 1
    assert "Bhashini" in attribution[0]


@pytest.mark.asyncio
async def test_bhashini_not_credited_when_it_failed(monkeypatch):
    """Crediting a service that did not run would be a false provenance claim."""
    monkeypatch.setattr(bhashini, "available", lambda: True)

    async def bhashini_down(*args, **kwargs):
        raise bhashini.BhashiniUnavailable("down")

    async def fake_llm(text, system=None, **kwargs):
        return "மொழிபெயர்ப்பு"

    monkeypatch.setattr(bhashini, "translate", bhashini_down)
    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(llm, "complete", fake_llm)

    await explainability.translate_only(WARNING, "ta")
    assert explainability.translation_attribution() == []


# ── The verdict path ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verdict_translated_not_recomposed_when_bhashini_is_up(monkeypatch):
    """Translating the deterministic sentence is safer than letting a model compose one:
    the verdict wording cannot drift at all."""
    from app.agents import risk
    from app.schemas.enums import Verdict

    monkeypatch.setattr(risk.bhashini, "available", lambda: True)
    captured = {}

    async def fake_translate(text, source, target):
        captured["source_text"] = text
        return "అనువాదం"

    async def llm_must_not_run(*args, **kwargs):
        raise AssertionError("Bhashini succeeded, so the LLM must not compose")

    monkeypatch.setattr(risk.bhashini, "translate", fake_translate)
    monkeypatch.setattr(risk.llm, "complete", llm_must_not_run)

    reasons = ["wind gusts 41.8 km/h exceeds the 35 km/h small-craft threshold"]
    out = await risk.phrase_reasons(Verdict.CAUTION, reasons, "te")

    assert out == "అనువాదం"
    # What got translated must be the deterministic sentence, numbers intact.
    assert "41.8" in captured["source_text"]
    assert "Caution" in captured["source_text"]
