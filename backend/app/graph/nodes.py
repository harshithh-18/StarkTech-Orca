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

from app.adapters import open_meteo_marine
from app.adapters.base import LocationNotAtSea
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
from app.schemas.enums import AlertType, Intent, TraceStatus, Verdict
from app.services import explainability, harbours

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
        skipped: dict = {"reasoning_trace": [step], "skipped_agents": [name]}

        # "There is no sea here" is not a missing data source, and conflating the two
        # produces the worst answer this system can give: asked from an inland city, a
        # generic skip caps the verdict at CAUTION and reports "sea state unavailable —
        # treat as provisional", which reads as *the sea near you might be rough*. It is
        # flagged on the state instead so the risk node can say the true thing.
        if isinstance(exc, (LocationNotAtSea, marine_data.LocationNotAtSea)):
            skipped["inland"] = True

        return skipped

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

        # Cyclone check. Best effort and additive: it never fails the weather node, but a
        # detected system feeds `cyclone_bulletin_active` into the risk rules, which is
        # what raises the CYCLONE alert and caps the verdict.
        cyclone_summary = ""
        try:
            cyclone = await weather.check_cyclone_alerts(state["location"])
            evidence = list(evidence) + cyclone
            system = next(
                (e for e in cyclone if e.field == "cyclone_system_class"), None
            )
            active = next(
                (e for e in cyclone if e.field == "cyclone_bulletin_active"), None
            )
            if system is not None:
                cyclone_summary = f"; {system.value} detected nearby"
            elif active is not None and active.value is False:
                cyclone_summary = "; no tropical system detected"
        except Exception as exc:  # noqa: BLE001 - the wind data still stands
            logger.info("weather: cyclone proxy failed (%s)", exc)

        return {
            "weather": {"evidence": evidence},
            "evidence": evidence,
            "attribution": [weather.ATTRIBUTION],
            "_message": f"Open-Meteo weather: {summary}{cyclone_summary}",
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

        # Tide rides along on the same cached marine request, so it costs no extra call.
        # "What are the tide, weather and sea conditions near my fishing location?" is one
        # of the problem statement's own example queries, and a sea-state answer with no
        # tide in it does not answer it.
        try:
            tide_chart, tide_evidence = await sea_state.fetch_tides(state["location"])
            charts.append(tide_chart)
            evidence = list(evidence) + tide_evidence
        except Exception as exc:  # noqa: BLE001
            logger.info("sea_state: could not build the tide curve (%s)", exc)

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
    # "Why has productivity declined?" asks about change over time, not where the fish
    # are right now — a different computation over the same product.
    if state.get("intent") is Intent.DIAGNOSTIC:
        return await _productivity_trend(state)

    async def work() -> dict:
        result = await marine_data.get_fishing_zones(state["location"])
        nearest = await geospatial.nearest_zone(state["location"], result["geojson"])

        evidence = list(result["evidence"])
        if nearest:
            evidence.extend(nearest.get("evidence", []))

        # The thermal front is the *reason* a zone is a zone. Adding it turns "there is a
        # fishing zone 38 km north-east" into "there is a fishing zone 38 km north-east,
        # on the edge of a 200 km temperature front" — the second is an explanation, and
        # explanation is the thing this platform is supposed to deliver.
        front = await _detect_fronts(state["location"])
        if front:
            evidence.extend(front["evidence"])

        count = len(result["geojson"]["features"])
        summary = (
            f"{count} zone{'s' if count != 1 else ''} via {result['path']}"
            + (f", nearest {nearest['description']}" if nearest else "")
            + (f"; {front['count']} thermal front(s) detected" if front else "")
        )

        return {
            "marine": {**result, "nearest": nearest, "fronts": front},
            "evidence": evidence,
            "attribution": result["attribution"],
            "_message": f"Fishing zones: {summary}",
        }

    return await _run_specialist(
        state, "marine_data", work, "Locating potential fishing zones…", source="Copernicus / INCOIS"
    )


async def _detect_fronts(location) -> dict | None:
    """Thermal fronts near a point, or None when they cannot be computed.

    Best-effort by design: fronts enrich the explanation, they are not the answer. If the
    Copernicus subset is missing the fishing-zone answer must still ship, so this returns
    None rather than raising into the specialist wrapper and marking the whole node
    skipped.
    """
    import anyio

    from app.services import fronts

    box = {
        "lat_min": location.lat - 2.5,
        "lat_max": location.lat + 2.5,
        "lon_min": location.lon - 2.5,
        "lon_max": location.lon + 2.5,
    }
    try:
        # NumPy over a NetCDF grid: off the event loop, or it stalls every concurrent run.
        collection = await anyio.to_thread.run_sync(lambda: fronts.detect(box))
    except Exception as exc:  # noqa: BLE001 - enrichment, never a failure
        logger.info("marine_data: front detection unavailable (%s)", exc)
        return None

    if not collection.get("features"):
        return None

    # The geometry deliberately does NOT go into the graph state. It is a few hundred
    # NumPy-derived coordinates that the checkpointer would have to serialise on every
    # turn, and the map fetches the same collection from /api/layers/ocean_fronts anyway.
    # Only the conclusion travels.
    return {
        "count": len(collection["features"]),
        "evidence": fronts.front_evidence(location, collection),
        "narrative": fronts.describe(location, collection),
    }


async def _productivity_trend(state: OrcaState) -> dict:
    """Golden query #4: chlorophyll and SST over time, plus the narrative."""

    async def work() -> dict:
        evidence, chart = await marine_data.get_productivity_trend(state["location"])
        narrative = marine_data.describe_trend(evidence, state["location"])

        # "Why has productivity declined?" is partly a question about physical structure:
        # water with no thermal front in it has nothing concentrating the plankton, and
        # saying so is a real part of the explanation rather than a garnish.
        front = await _detect_fronts(state["location"])
        if front:
            evidence = list(evidence) + front["evidence"]
            # Not `.capitalize()` — that would lowercase everything after the first
            # letter and turn "0.033 °C/km" into "0.033 °c/km".
            sentence = front["narrative"]
            narrative = f"{narrative} {sentence[0].upper()}{sentence[1:]}."

        change = next(
            (e for e in evidence if e.field == "chlorophyll_change_pct"), None
        )
        summary = (
            f"chlorophyll {float(change.value):+.0f}% vs the preceding period"
            if change is not None
            else f"{len(evidence)} trend values"
        )

        return {
            "marine": {
                "trend": True,
                "evidence": evidence,
                "charts": [chart],
                "narrative": narrative,
                "fronts": front,
            },
            "evidence": evidence,
            "charts": [chart],
            "attribution": [marine_data.copernicus.ATTRIBUTION],
            "_message": f"Productivity trend: {summary}",
        }

    return await _run_specialist(
        state,
        "marine_data",
        work,
        "Analysing chlorophyll and SST over time…",
        source="Copernicus Marine",
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
        answer = f"You are {summary}." if parts else summary

        # Lead with the warning rather than leaving the tone to a language model. The
        # proximity case is the whole point of this agent — crossing the IMBL is what
        # gets boats detained, and a warning buried after three distances is no warning.
        if AlertType.GEOFENCE_BREACH in alerts:
            answer = (
                "WARNING — you are inside a protected marine area, where fishing may be "
                "restricted or banned. Leave the area. " + answer
            )
        elif AlertType.GEOFENCE_PROXIMITY in alerts:
            imbl = by_field.get("distance_to_imbl")
            distance_text = f"only {imbl.value} km" if imbl else "very close to"
            answer = (
                f"WARNING — you are {distance_text} from the sea border with a "
                f"neighbouring country. Crossing it without permission can get your boat "
                f"seized and your crew detained by the other country's coast guard. Turn "
                f"back towards Indian waters. " + answer
            )

        return {
            "geofence": {
                "evidence": evidence,
                "checked": True,
                "near_mpa": any(a.value.startswith("GEOFENCE") for a in alerts),
                "summary": answer,
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

    # ── There is no sea here ──────────────────────────────────────────────
    # Checked before everything else. A safety verdict about a place with no sea in it is
    # not a cautious answer, it is a meaningless one — and "CAUTION: sea state data was
    # unavailable" actively misleads, because it implies there is a sea nearby that we
    # could not read. Say the true thing and point at the nearest coast instead.
    if state.get("inland"):
        location = state.get("location")
        where = (
            harbours.describe_nearest(location)
            if location is not None
            else "The nearest coast could not be worked out."
        )
        reason = (
            f"{(location.name if location and location.name else 'This location')} is "
            f"inland — there is no sea within "
            f"{int(open_meteo_marine.SAMPLE_RADIUS_KM)} km of it, so there are no waves, "
            f"tides or sea conditions to report. {where}"
        )
        step = collector.step(
            "risk",
            f"No verdict: the location is inland. {where}",
            status=TraceStatus.SKIPPED,
            duration_ms=int((time.monotonic() - started) * 1000),
        )
        return {
            "verdict": Verdict.NOT_APPLICABLE,
            "verdict_reasons": [reason],
            "reasoning_trace": [step],
        }

    if intent not in SAFETY_INTENTS:
        step = collector.step(
            "risk",
            f"Skipped: {intent.value} is not a safety question, so no verdict applies",
            status=TraceStatus.SKIPPED,
        )
        return {"verdict": None, "reasoning_trace": [step]}

    # A route query dispatches only the route agent unless the planner also asked for
    # weather — and route evidence carries no safety thresholds, so assessing it produces
    # a bogus "no forecast data" CAUTION about a question nobody asked.
    from app.services.risk_rules import THRESHOLDS

    has_threshold_evidence = any(
        e.field in THRESHOLDS for e in (state.get("evidence") or [])
    )
    if intent is Intent.ROUTE_PLANNING and not has_threshold_evidence:
        step = collector.step(
            "risk",
            "Skipped: no wind or wave evidence was gathered for this route, so no "
            "safety verdict applies",
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
    """Golden query #5: least-risk path between two places."""

    async def work() -> dict:
        from app.agents import route as route_agent
        from app.agents.language_intent import extract_route_endpoints

        origin, destination = await extract_route_endpoints(state["query"])
        # "route to Chennai" gives only a destination; the resolved query location is the
        # implied starting point.
        origin = origin or state.get("location")
        if origin is None or destination is None:
            raise route_agent.RouteUnavailable(
                "a route needs two places — try “route from Kakinada to Chennai”"
            )

        result = await route_agent.plan_route(
            origin, destination, (state.get("time_window") or {}).get("start")
        )
        # Held per session so the map can fetch the line: the response contract is frozen
        # and has no field for geometry, and recomputing it on the layers request would
        # mean a second A* run over a second forecast fetch.
        route_agent.remember(state["session_id"], result["geojson"])

        return {
            "route": {
                "geojson": result["geojson"],
                "origin": origin,
                "destination": destination,
                "summary": (
                    f"{result['distance_km']} km from {origin.name or 'your location'} "
                    f"to {destination.name or 'the destination'}, about "
                    f"{result['hours']:.0f} hours, peak wave {result['max_wave_m']} m "
                    f"along the way."
                ),
            },
            "evidence": result["evidence"],
            "attribution": result["attribution"],
            "_message": (
                f"Route: {result['distance_km']} km, peak wave "
                f"{result['max_wave_m']} m, ~{result['hours']:.0f} h"
            ),
        }

    return await _run_specialist(
        state, "route", work, "Planning a least-risk path…", source="Open-Meteo Marine"
    )


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
