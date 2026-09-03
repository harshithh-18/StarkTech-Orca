# API Contract

> ## 🔒 FROZEN
> This is the coordination point between backend (B), explainability (C) and frontend (D).
> **Any change needs sign-off from A + B + C + D** and must land in all three places in the
> same PR:
>
> | Where | File |
> |-------|------|
> | Python (source of truth) | [`backend/app/schemas/response.py`](../backend/app/schemas/response.py) |
> | TypeScript mirror | [`frontend/src/types/orca.ts`](../frontend/src/types/orca.ts) |
> | This document | `docs/API_CONTRACT.md` |
>
> Freeze date: **Day 3 (24 Aug)**. After that, code against it — don't renegotiate it in Slack.

---

## Endpoints

| Method | Path | Body → Response | Owner |
|--------|------|-----------------|-------|
| `GET` | `/health` | → `{"status": "ok", "version": "..."}` | B |
| `POST` | `/api/query` | `QueryRequest` → `OrcaResponse` | B |
| `GET` | `/api/layers/{layer}` | → GeoJSON `FeatureCollection` | B |
| `WS` | `/ws/trace/{session_id}` | → stream of `TraceEvent` | B + D |
| `GET` | `/api/conditions` | `?lat&lon&name` → `ConditionsSnapshot` | B |
| `POST` | `/api/watch` | `WatchRequest` → `WatchStatus` | B |
| `GET` | `/api/watch` | `?session_id` → `WatchStatus[]` | B |
| `GET` | `/api/watch/{id}` | → `WatchStatus` | B |
| `DELETE` | `/api/watch/{id}` | → `{"cancelled": bool}` | B |

The last five are **P4 additions and are not part of the frozen contract.** They describe
the two paths that do not start with a question — the live dashboard and the proactive
watch — and they live in their own schema file so `response.py` stays untouched:

| Where | File |
|-------|------|
| Python | [`backend/app/schemas/conditions.py`](../backend/app/schemas/conditions.py) |
| TypeScript | [`frontend/src/types/orca.ts`](../frontend/src/types/orca.ts) |

---

## `QueryRequest`

```json
{
  "query": "రేపు సముద్రంలోకి వెళ్ళడం సురక్షితమేనా?",
  "session_id": "3f9c1a2e-...",
  "lat": 16.99,
  "lon": 82.24,
  "language": null,
  "reply_with_audio": false
}
```

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| `query` | string | ✅ | Raw user text, any language. 1–1000 chars |
| `session_id` | string | ✅ | Client-generated UUID. Keys multi-turn memory **and** the WebSocket trace stream |
| `lat` / `lon` | float? | ❌ | Device GPS if granted. If absent, location is resolved from the query text via geocoding |
| `language` | string? | ❌ | ISO 639-1 override. `null` ⇒ auto-detect (the normal path) |
| `reply_with_audio` | bool | ❌ | Stretch — triggers TTS on the response |

---

## `OrcaResponse`

The canonical example from the implementation report (§12), with the added envelope fields:

```json
{
  "query": "Is it safe to sail tomorrow near Kakinada?",
  "session_id": "3f9c1a2e-...",
  "language": "te",
  "intent": "safety_check",
  "location": {"lat": 16.99, "lon": 82.24, "name": "Kakinada"},
  "answer": "No-Go tomorrow morning: seas too rough.",
  "verdict": "NO_GO",
  "evidence": [
    {"field": "wave_height", "value": 3.4, "unit": "m",
     "source": "Open-Meteo Marine (ICON-Wave)", "time": "2026-09-02T06:00:00Z"},
    {"field": "wind_speed", "value": 42, "unit": "km/h",
     "source": "Open-Meteo", "time": "2026-09-02T06:00:00Z"}
  ],
  "reasoning_trace": [
    {"seq": 0, "agent": "language_intent", "status": "ok",
     "message": "Intent=safety_check, lang=te, resolved Kakinada→16.99,82.24"},
    {"seq": 1, "agent": "planner", "status": "ok",
     "message": "Planner → [Weather, Sea-state, Risk]"},
    {"seq": 2, "agent": "sea_state", "status": "ok",
     "message": "wave_height 3.4m > 2.5m small-craft threshold",
     "source": "Open-Meteo Marine"},
    {"seq": 3, "agent": "risk", "status": "ok",
     "message": "Threshold breached → NO_GO"}
  ],
  "map_layers": ["user_pin", "wave_heatmap", "eez_boundary"],
  "alerts": ["HIGH_WAVE"],
  "charts": [],
  "generated_at": "2026-09-01T11:02:44Z",
  "used_mock_data": false,
  "attribution": ["Weather data by Open-Meteo.com (CC BY 4.0)"]
}
```

### Fields

| Field | Type | Null? | Notes |
|-------|------|-------|-------|
| `query` | string | — | Echoed verbatim |
| `session_id` | string | — | Echoed |
| `language` | `Language` | — | Detected (or overridden). `answer` is written **in this language** |
| `intent` | `Intent` | — | Classified by the Language+Intent agent |
| `location` | `Location` | ✅ | `null` when the query has no resolvable place |
| `answer` | string | — | Short, glanceable, in `language`. This is what the chat bubble shows |
| `verdict` | `Verdict` | ✅ | `null` for non-safety intents |
| `evidence` | `Evidence[]` | — | May be empty, **never null.** Renders the source-citation footnotes |
| `reasoning_trace` | `TraceStep[]` | — | May be empty, never null. Renders the Reasoning Trace panel |
| `map_layers` | `MapLayer[]` | — | Which layers the frontend should switch on for this answer |
| `alerts` | `AlertType[]` | — | Drives the alert banner |
| `charts` | `ChartSpec[]` | — | Forecast/trend series. Empty for most answers |
| `generated_at` | datetime | — | UTC, ISO 8601 |
| `used_mock_data` | bool | — | `true` when served from `data/mock/`. **Frontend shows a subtle badge** — we never silently fake data |
| `attribution` | string[] | — | Licence lines for every source touched. Rendered in the footer |

### `Location`
| Field | Type | Notes |
|-------|------|-------|
| `lat` | float | −90 … 90 |
| `lon` | float | −180 … 180 |
| `name` | string? | Human-readable, e.g. `"Kakinada"` |
| `source` | string? | `"gps"` \| `"geocoded"` \| `"session_context"` |

### `Evidence`
| Field | Type | Notes |
|-------|------|-------|
| `field` | string | Machine name, e.g. `wave_height` |
| `value` | float \| string \| bool | The observed value |
| `unit` | string? | `"m"`, `"km/h"`, `"mg/m³"`, `"°C"` |
| `source` | string | Human-readable, includes the model: `"Open-Meteo Marine (ICON-Wave)"` |
| `time` | datetime? | Validity time of the value, not fetch time |
| `location` | `Location`? | Where the value applies, if not the query location |

### `TraceStep`
| Field | Type | Notes |
|-------|------|-------|
| `seq` | int | Monotonic within a run — the panel orders by this |
| `agent` | string | Module name: `planner`, `sea_state`, `risk`, … |
| `status` | `started` \| `ok` \| `failed` \| `skipped` | Drives the spinner/tick/cross in the panel |
| `message` | string | One human-readable line. **Always English** — it's a developer/judge-facing trace |
| `source` | string? | Data source touched in this step |
| `duration_ms` | int? | For the "took 340 ms" hint |

### `ChartSpec`
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `"wave_48h"`, `"chlorophyll_trend"` |
| `title` | string | Localised into `language` |
| `kind` | `line` \| `bar` \| `area` | |
| `x_label` / `y_label` | string | |
| `series` | `{name, unit, points: [{x, y}]}[]` | `x` is an ISO datetime string |

---

## Enums

```
Intent      pfz_lookup | safety_check | geofence_check | diagnostic |
            route_planning | general

Verdict     GO | CAUTION | NO_GO | NOT_APPLICABLE

AlertType   CYCLONE | HIGH_WAVE | HIGH_WIND | LIGHTNING | GEOFENCE_BREACH |
            GEOFENCE_PROXIMITY | MARINE_HEAT_WAVE | TSUNAMI

MapLayer    user_pin | pfz_zones | eez_boundary | imbl_line | mpa_zones |
            wave_heatmap | sst_heatmap | chlorophyll_heatmap |
            hazard_overlay | route_line | ocean_fronts

Language    en | hi | ta | te | ml | bn | kn | mr | gu | or
            (the coastal languages first — ta/te/ml/bn are the demo targets)
```

---

## WebSocket trace stream

`WS /ws/trace/{session_id}` — the frontend opens this **before** POSTing the query, using
the same `session_id`. Each graph node emits as it completes, so the panel fills in live
rather than after the fact.

```json
{"type": "trace",  "session_id": "3f9c...", "payload": { /* TraceStep */ }}
{"type": "answer", "session_id": "3f9c...", "payload": { /* OrcaResponse */ }}
{"type": "alert",  "session_id": "3f9c...", "payload": { /* WatchAlert + watch_id */ }}
{"type": "error",  "session_id": "3f9c...", "payload": {"code": "ADAPTER_TIMEOUT",
                                                        "message": "..."}}
```

`type: "alert"` (P4) carries a proactive watch alert. It shares this socket deliberately:
the client already holds it open for the reasoning panel, and a push channel that needs its
own connection is one that quietly dies behind an idle-timeout proxy — which, in a safety
feature, is the failure mode you find out about afterwards. Alerts are also readable from
`GET /api/watch/{id}`, so a client that was reconnecting when one fired can recover it.

The final `OrcaResponse` arrives **both** on the WebSocket (`type: "answer"`) and as the
`POST /api/query` response body. The frontend may use either; the POST body is the
reliable one, the socket is for liveness.

---

## Error responses

Standard HTTP codes with a consistent body:

```json
{"error": {"code": "LOCATION_UNRESOLVED",
           "message": "Could not resolve a location from the query.",
           "hint": "Ask the user to share GPS or name a port."}}
```

| Code | HTTP | Meaning |
|------|------|---------|
| `LOCATION_UNRESOLVED` | 422 | No lat/lon and no place name in the query |
| `INTENT_UNSUPPORTED` | 422 | Classified outside the golden path |
| `ADAPTER_TIMEOUT` | 504 | Upstream data source didn't answer — retry or fall back to mock |
| `ADAPTER_UNAVAILABLE` | 503 | Source down and no cache entry exists |
| `LLM_UNAVAILABLE` | 503 | Gemini and Groq both failed |
| `CONDITIONS_UNAVAILABLE` | 503 | No forecast model answered for this point (often: it is inland) |
| `WATCH_UNAVAILABLE` | 503 | A watch could not be started here |
| `WATCH_NOT_FOUND` | 404 | No such watch — they are in-memory and do not survive a restart |

**Degradation rule:** a missing data source must **never** produce a 500. Drop the affected
evidence, add a `skipped` trace step saying which agent couldn't run and why, and answer
with what's left — then say so in the `answer`. A partial, honest answer beats an error page,
and the visible skip is itself a demonstration of the trace.

---

## Deviations from report §12 (deliberate — 1 item)

**`reasoning_trace` is an array of objects, not an array of strings.**
The report shows flat strings. The Reasoning Trace panel (§9) needs `agent`, `status` and
`seq` per step to render the streaming spinner/tick UI and to attribute each line to a
module — and the WebSocket needs to ship one step at a time. The report's flat strings are
exactly the `message` fields, so nothing is lost:

```python
[step.message for step in response.reasoning_trace]  # == report §12 shape
```

Everything else matches the report exactly.
