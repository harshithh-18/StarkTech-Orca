"""Graph node wrappers.

Owner: A · Phase: P1

Thin adapters between LangGraph's ``state -> state-delta`` calling convention and the
agents, which take plain arguments and return plain results. Keeping this seam means the
agents stay independently testable without a graph.

Every wrapper does the same four things:
  1. emit a ``started`` TraceStep
  2. call its agent
  3. emit an ``ok`` step and return the state delta (including new evidence)
  4. on failure: emit a ``skipped`` step with the reason and return an empty delta —
     **a specialist never fails the run** (docs/API_CONTRACT.md, degradation rule)
"""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable

from app.agents import (
    geospatial,
    language_intent,
    marine_data,
    planner,
    risk,
    sea_state,
    visualization,
    weather,
)
from app.agents.base import get_collector
from app.graph.state import OrcaState
from app.schemas.enums import Intent, TraceStatus
from app.services import explainability

logger = logging.getLogger(__name__)

# Intents for which a safety verdict is meaningful. Everything else gets verdict=None,
# and the risk node says why rather than inventing a NOT_APPLICABLE silently.
SAFETY_INTENTS = {Intent.SAFETY_CHECK, Intent.ROUTE_PLANNING}


async def _run_specialist(
    state: OrcaState,
    name: str,
    work: Callable[[], Awaitable[dict]],
    start_message: str,
    source: str | None = None,
) -> dict:
    """Run one specialist with the standard trace + degradation contract.

    A failure here is never fatal: it becomes a `skipped` step carrying the reason, and
    the graph continues with whatever the other specialists produced. That visible skip
    is a feature — it shows the system knows what it doesn't know.
    """
    collector = get_collector(state["session_id"])
    collector.step(name, start_message, status=TraceStatus.STARTED, source=source)

    started = time.monotonic()
    try:
        delta = await work()
    except Exception as exc:  # noqa: BLE001 - a specialist must never fail the run
        elapsed = int((time.monotonic() - started) * 1000)
        logger.info("node %s skipped: %s", name, exc)
        step = collector.step(
            name,
            f"Skipped: {exc}",
            status=TraceStatus.SKIPPED,
            source=source,
            duration_ms=elapsed,
        )
        return {"reasoning_trace": [step], "skipped_agents": [name]}

    elapsed = int((time.monotonic() - started) * 1000)
    message = delta.pop("_message", f"{name} completed")
    step = collector.step(
        name, message, status=TraceStatus.OK, source=source, duration_ms=elapsed
    )
    delta.setdefault("reasoning_trace", []).append(step)
    return delta


async def language_intent_node(state: OrcaState) -> dict:
    """Detect language, classify intent, resolve location + time window."""
    collector = get_collector(state["session_id"])
    started = time.monotonic()
    collector.step(
        "language_intent", "Detecting language and intent…", status=TraceStatus.STARTED
    )

    session_context = state.get("session_context") or {}
    if state.get("location") and not session_context.get("location"):
        # A location carried in from a previous turn's checkpoint.
        session_context = {**session_context, "location": state["location"]}

    result = await language_intent.detect_and_classify(
        state["query"],
        session_context=session_context,
        lat=state.get("input_lat"),
        lon=state.get("input_lon"),
    )

    location = result["location"]
    where = (
        f", resolved {location.name or 'location'}→{location.lat:.2f},{location.lon:.2f}"
        f" ({location.source})"
        if location
        else ", no location resolved"
    )
    step = collector.step(
        "language_intent",
        f"Intent={result['intent'].value}, lang={result['language'].value}{where}"
        f" [via {result['method']}]",
        duration_ms=int((time.monotonic() - started) * 1000),
    )

    return {
        "language": result["language"],
        "intent": result["intent"],
        "location": location,
        "time_window": result["time_window"],
        "reasoning_trace": [step],
    }


async def planner_node(state: OrcaState) -> dict:
    """Decompose the request and choose the specialists."""
    collector = get_collector(state["session_id"])
    started = time.monotonic()
    collector.step("planner", "Planning specialists…", status=TraceStatus.STARTED)

    chosen = await planner.plan(
        state["query"],
        state.get("intent", Intent.GENERAL),
        has_location=state.get("location") is not None,
        session_context=state.get("session_context"),
    )

    step = collector.step(
        "planner",
        planner.explain_plan(chosen),
        duration_ms=int((time.monotonic() - started) * 1000),
    )
    return {"plan": chosen, "reasoning_trace": [step]}


async def weather_node(state: OrcaState) -> dict:
    async def work() -> dict:
        evidence = await weather.fetch_weather(state["location"], state["time_window"])
        peak = next((e for e in evidence if e.field == "wind_gusts_10m"), None)
        summary = (
            f"peak gusts {peak.value} {peak.unit} at {peak.time:%H:%M} UTC"
            if peak
            else f"{len(evidence)} weather values"
        )
        return {
            "weather": {"evidence": evidence},
            "evidence": evidence,
            "attribution": [weather.ATTRIBUTION],
            "_message": f"Open-Meteo weather: {summary}",
        }

    return await _run_specialist(
        state, "weather", work, "Fetching Open-Meteo weather…", source="Open-Meteo"
    )


async def sea_state_node(state: OrcaState) -> dict:
    async def work() -> dict:
        evidence = await sea_state.fetch_sea_state(state["location"], state["time_window"])
        peak = next((e for e in evidence if e.field == "wave_height"), None)
        summary = (
            f"peak wave height {peak.value} {peak.unit} at {peak.time:%H:%M} UTC "
            f"({peak.location.lat:.2f},{peak.location.lon:.2f})"
            if peak and peak.location
            else f"{len(evidence)} sea-state values"
        )

        charts = []
        try:
            charts.append(await sea_state.fetch_forecast_chart(state["location"]))
        except Exception as exc:  # noqa: BLE001 - a missing chart is not a failed answer
            logger.info("sea_state: could not build the wave chart (%s)", exc)

        return {
            "sea_state": {"evidence": evidence, "charts": charts},
            "evidence": evidence,
            "attribution": [sea_state.ATTRIBUTION],
            "_message": f"Open-Meteo Marine: {summary}",
        }

    return await _run_specialist(
        state,
        "sea_state",
        work,
        "Fetching Open-Meteo Marine sea state…",
        source="Open-Meteo Marine",
    )


async def marine_data_node(state: OrcaState) -> dict:
    async def work() -> dict:
        result = await marine_data.get_fishing_zones(state["location"])
        nearest = await geospatial.nearest_zone(state["location"], result["geojson"])

        evidence = list(result["evidence"])
        if nearest:
            evidence.extend(nearest.get("evidence", []))

        count = len(result["geojson"]["features"])
        summary = (
            f"{count} zone{'s' if count != 1 else ''} via {result['path']}"
            + (f", nearest {nearest['description']}" if nearest else "")
        )

        return {
            "marine": {**result, "nearest": nearest},
            "evidence": evidence,
            "attribution": result["attribution"],
            "_message": f"Fishing zones: {summary}",
        }

    return await _run_specialist(
        state, "marine_data", work, "Locating potential fishing zones…", source="Copernicus / INCOIS"
    )


async def geospatial_node(state: OrcaState) -> dict:
    async def work() -> dict:
        evidence = await geospatial.check_geofences(state["location"])
        if not evidence:
            # No boundary file loaded at all — say so rather than reporting "all clear".
            raise FileNotFoundError(
                "no boundary data loaded (run `python scripts/download_geojson.py`)"
            )

        alerts = geospatial.derive_geofence_alerts(evidence)
        by_field = {e.field: e for e in evidence}

        parts = []
        for key, label in geospatial.BOUNDARY_LABELS.items():
            distance = by_field.get(f"distance_to_{key}")
            if distance is None:
                continue
            if key in geospatial.LINE_LAYERS:
                # A line has no inside — only "how far away" is meaningful.
                parts.append(f"{distance.value} km from {label}")
            else:
                inside = by_field.get(f"inside_{key}")
                state_word = "inside" if inside and inside.value else "outside"
                parts.append(f"{state_word} {label}, boundary {distance.value} km away")

        summary = "; ".join(parts) if parts else "no boundary data available"
        return {
            "geofence": {
                "evidence": evidence,
                "checked": True,
                "near_mpa": any(a.value.startswith("GEOFENCE") for a in alerts),
                "summary": f"You are {summary}." if parts else summary,
            },
            "evidence": evidence,
            "alerts": alerts,
            "attribution": [geospatial.geojson_store.ATTRIBUTION_EEZ],
            "_message": f"Geofence check: {summary}",
        }

    return await _run_specialist(
        state, "geospatial", work, "Checking maritime boundaries…", source="Marine Regions / WDPA"
    )


async def risk_node(state: OrcaState) -> dict:
    """Correlate every specialist's evidence into a verdict.

    Joins the parallel branches. Runs even when some specialists were skipped — it must
    say so rather than pretending it had full information.
    """
    collector = get_collector(state["session_id"])
    started = time.monotonic()
    intent = state.get("intent", Intent.GENERAL)

    if intent not in SAFETY_INTENTS:
        step = collector.step(
            "risk",
            f"Skipped: {intent.value} is not a safety question, so no verdict applies",
            status=TraceStatus.SKIPPED,
        )
        return {"verdict": None, "reasoning_trace": [step]}

    collector.step("risk", "Correlating evidence…", status=TraceStatus.STARTED)

    assessment = risk.assess(
        state.get("evidence") or [], skipped_agents=state.get("skipped_agents") or []
    )

    step = collector.step(
        "risk",
        f"{len(assessment['fired_rules'])} rule(s) fired → {assessment['verdict'].value}"
        + (f" ({', '.join(assessment['fired_rules'])})" if assessment["fired_rules"] else ""),
        duration_ms=int((time.monotonic() - started) * 1000),
    )

    return {
        "verdict": assessment["verdict"],
        "verdict_reasons": assessment["reasons"],
        "alerts": assessment["alerts"],
        "reasoning_trace": [step],
    }


async def route_node(state: OrcaState) -> dict:
    """TODO(P3, E) — stretch. The planner never dispatches this; see agents/route.py."""
    raise NotImplementedError("TODO(P3, E)")


async def visualization_node(state: OrcaState) -> dict:
    """Pick map layers, build chart specs, assemble alert cards."""
    collector = get_collector(state["session_id"])
    started = time.monotonic()

    layers = visualization.select_layers(state.get("intent", Intent.GENERAL), dict(state))
    charts = visualization.build_charts(dict(state))

    step = collector.step(
        "visualization",
        f"Layers {[layer.value for layer in layers]}"
        + (f", {len(charts)} chart(s)" if charts else ""),
        duration_ms=int((time.monotonic() - started) * 1000),
    )
    return {"map_layers": layers, "charts": charts, "reasoning_trace": [step]}


async def explainability_node(state: OrcaState) -> dict:
    """Final node: write the answer in the user's language and attach evidence + trace.

    The LLM phrases; it does not decide. The verdict is already fixed by ``risk_node``.
    """
    collector = get_collector(state["session_id"])
    started = time.monotonic()

    answer = await explainability.write_answer(state)

    evidence_count = len(state.get("evidence") or [])
    step = collector.step(
        "explainability",
        f"Answer written in {state.get('language').value if state.get('language') else 'en'} "
        f"from {evidence_count} evidence item(s)",
        duration_ms=int((time.monotonic() - started) * 1000),
    )
    return {"answer": answer, "reasoning_trace": [step]}
