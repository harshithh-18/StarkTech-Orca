"""Safety threshold tests.

Owner: C (with E) · Phase: P2

> **The most important test file in the repo.** These rules decide whether a fisherman
> goes to sea. Test every boundary, and test exactly-at-threshold — off-by-one on a
> comparison operator is the kind of bug that looks like nothing and matters enormously.
"""

from __future__ import annotations

import ast
import inspect

from app.schemas.enums import Verdict
from app.schemas.response import Evidence
from app.services import risk_rules
from app.services.risk_rules import evaluate

SOURCE = "Open-Meteo Marine"


def ev(field: str, value, source: str = SOURCE, unit: str | None = None) -> Evidence:
    """Terse Evidence builder so the tests read as tables of conditions."""
    return Evidence(field=field, value=value, unit=unit, source=source)


def calm() -> list[Evidence]:
    """A full, comfortably-safe evidence set — every threshold field present."""
    return [
        ev("wave_height", 0.6, unit="m"),
        ev("swell_wave_height", 0.5, unit="m"),
        ev("wind_speed_10m", 12.0, unit="km/h"),
        ev("wind_gusts_10m", 20.0, unit="km/h"),
        ev("cape", 300.0, unit="J/kg"),
        ev("visibility", 15000.0, unit="m"),
    ]


def test_calm_conditions_return_go():
    result = evaluate(calm())
    assert result["verdict"] is Verdict.GO
    assert result["fired_rules"] == []
    assert result["reasons"], "a GO must still explain itself"


def test_wave_height_above_no_go_threshold_returns_no_go():
    """3.4 m vs a 2.5 m threshold → NO_GO, and the reason names both numbers."""
    evidence = calm()
    evidence[0] = ev("wave_height", 3.4, unit="m")

    result = evaluate(evidence)

    assert result["verdict"] is Verdict.NO_GO
    assert "wave_height.no_go" in result["fired_rules"]
    reason = next(r for r in result["reasons"] if "wave height" in r)
    assert "3.4" in reason and "2.5" in reason, f"reason must name both numbers: {reason}"


def test_exactly_at_threshold():
    """Thresholds are INCLUSIVE — at exactly the limit we breach.

    A deliberate choice for a safety system: at exactly 2.5 m we say NO_GO rather than
    waving the boat out on a technicality. If this test fails, someone flipped >= to >.
    """
    assert risk_rules.breaches("wave_height", 2.5) == "no_go"
    assert risk_rules.breaches("wave_height", 1.5) == "caution"
    # Just below each limit must NOT breach.
    assert risk_rules.breaches("wave_height", 2.4999) == "caution"
    assert risk_rules.breaches("wave_height", 1.4999) is None


def test_wind_alone_can_trigger_no_go():
    """Calm seas plus a gale is still NO_GO."""
    evidence = calm()
    evidence[2] = ev("wind_speed_10m", 45.0, source="Open-Meteo", unit="km/h")

    result = evaluate(evidence)

    assert result["verdict"] is Verdict.NO_GO
    assert "wind_speed_10m.no_go" in result["fired_rules"]


def test_visibility_compares_in_the_opposite_direction():
    """LOWER visibility is worse. Every other field is the other way round — easy bug."""
    # Excellent visibility is not a breach, even though the number is huge.
    assert risk_rules.breaches("visibility", 20000.0) is None
    # Fog is a NO_GO, even though the number is small.
    assert risk_rules.breaches("visibility", 400.0) == "no_go"
    assert risk_rules.breaches("visibility", 1500.0) == "caution"

    evidence = calm()
    evidence[5] = ev("visibility", 300.0, source="Open-Meteo", unit="m")
    result = evaluate(evidence)
    assert result["verdict"] is Verdict.NO_GO
    assert "visibility.no_go" in result["fired_rules"]


def test_missing_sea_state_caps_verdict_at_caution():
    """Never issue GO on partial safety data. Absence of evidence is not evidence."""
    # Only weather data present, and all of it benign.
    evidence = [
        ev("wind_speed_10m", 10.0, source="Open-Meteo", unit="km/h"),
        ev("wind_gusts_10m", 18.0, source="Open-Meteo", unit="km/h"),
    ]

    result = evaluate(evidence, skipped_agents=["sea_state"])

    assert result["verdict"] is Verdict.CAUTION, "benign wind alone must never be a GO"
    assert "missing_safety_critical_data" in result["fired_rules"]
    assert any("sea state" in r for r in result["reasons"]), (
        "the reason must name WHICH data was missing"
    )


def test_missing_data_does_not_downgrade_a_no_go():
    """A cap raises the floor; it must not lower a verdict that is already worse."""
    evidence = calm()
    evidence[0] = ev("wave_height", 4.0, unit="m")

    result = evaluate(evidence, skipped_agents=["weather"])

    assert result["verdict"] is Verdict.NO_GO


def test_no_evidence_at_all_is_not_a_go():
    result = evaluate([])
    assert result["verdict"] is Verdict.CAUTION
    assert "no_evidence" in result["fired_rules"]


def test_worst_reading_per_field_wins():
    """Parallel specialists can both report wind; the verdict must not depend on order."""
    evidence = calm()
    evidence.append(ev("wave_height", 3.9, source="Open-Meteo Marine (ring sample)", unit="m"))

    result = evaluate(evidence)

    assert result["verdict"] is Verdict.NO_GO
    reason = next(r for r in result["reasons"] if "wave height" in r)
    assert "3.9" in reason, "the WORST reading must drive the verdict, not the first"


def test_thunderstorm_forecast_raises_caution():
    """Categorical risk: presence alone is the breach, there is no number to compare."""
    evidence = calm()
    evidence.append(ev("thunderstorm_forecast", True, source="Open-Meteo (WMO weather code)"))

    result = evaluate(evidence)

    assert result["verdict"] is Verdict.CAUTION
    assert "thunderstorm_forecast.present" in result["fired_rules"]


def test_cape_replaces_the_dead_thunderstorm_probability_field():
    """Regression guard for the field that returned all-nulls.

    ``thunderstorm_probability`` is not a rule any more — if it reappears in THRESHOLDS,
    the lightning rule is silently dead again. See adapters/open_meteo_weather.py.
    """
    assert "thunderstorm_probability" not in risk_rules.THRESHOLDS
    assert "cape" in risk_rules.THRESHOLDS
    assert risk_rules.breaches("cape", 2600.0) == "no_go"
    assert risk_rules.breaches("cape", 1200.0) == "caution"


def test_reasons_name_value_threshold_and_source():
    """Every reason must be checkable by the user — value, limit, and where it came from."""
    evidence = calm()
    evidence[0] = ev("wave_height", 3.4, source="Open-Meteo Marine (ICON-Wave)", unit="m")

    result = evaluate(evidence)

    reason = next(r for r in result["reasons"] if "wave height" in r)
    assert "3.4" in reason
    assert "2.5" in reason
    assert "Open-Meteo Marine (ICON-Wave)" in reason


def test_evaluate_is_deterministic():
    """Same evidence in, same verdict out — every time."""
    evidence = calm()
    evidence[0] = ev("wave_height", 2.0, unit="m")
    first = evaluate(evidence)
    for _ in range(5):
        assert evaluate(evidence) == first


def test_no_llm_in_the_decision_path():
    """Guard the design rule: evaluate() is pure. No network, no model, ever.

    A future refactor that "helpfully" adds an LLM call here should fail loudly.

    Checked structurally rather than by substring: the module *discusses* LLMs at length
    in its docstring, and a text scan would either trip on that prose or have to be
    loosened until it caught nothing.
    """
    tree = ast.parse(inspect.getsource(risk_rules))

    forbidden_modules = {
        "httpx", "requests", "urllib", "socket", "openai", "groq",
        "google", "google.genai", "aiohttp", "app.services.llm",
    }
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module)

    offenders = {
        name for name in imported
        if any(name == bad or name.startswith(bad + ".") for bad in forbidden_modules)
    }
    assert not offenders, (
        f"risk_rules must stay a pure function — it imports {sorted(offenders)}. "
        "The LLM phrases reasons; it never decides the verdict."
    )

    # No awaits and no async defs: a pure decision function has nothing to wait for.
    assert not any(
        isinstance(node, (ast.Await, ast.AsyncFunctionDef)) for node in ast.walk(tree)
    ), "risk_rules must contain no async code — the verdict does no I/O"
