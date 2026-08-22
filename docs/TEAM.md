# Team

Six people, 19 days. The split below exists so that two people never edit the same file on
the same day. If you need something outside your area, ask its owner — don't reach in.

**Daily standup: `__:__`** ← _set this on Day 1 and never move it._ 15 minutes, three
questions: what landed, what's blocked, what you're merging today.

---

## Roles

### A — Agentic AI *(lead / integrator)*
**Owns:** `backend/app/graph/`, `agents/planner.py`, `agents/language_intent.py`

LangGraph supervisor topology, agent design, planner logic, multi-turn state, and — most
importantly — **overall integration**. A is the person who notices on Sept 2 that two
branches have drifted. Also owns [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

### B — Backend / Data
**Owns:** `backend/app/api/`, `backend/app/adapters/`, `services/cache.py`, `services/llm.py`

FastAPI routes, the WebSocket trace stream, every data adapter (Open-Meteo, Copernicus,
INCOIS, IMD), and the cache + mock fallback layer that keeps the demo alive.
**B owns the single biggest risk in the project — INCOIS.** See [DATA_SOURCES.md](DATA_SOURCES.md).

### C — RAG / Explainability
**Owns:** `backend/app/schemas/`, `services/explainability.py`, `backend/app/rag/`, `backend/tests/`

ChromaDB over advisory text and geofence rules; the explainability layer that attaches
`evidence[]` and `reasoning_trace[]` to every answer; and custody of the frozen response
schema. **C is the guardian of [API_CONTRACT.md](API_CONTRACT.md)** — no one changes it without C.

### D — Web
**Owns:** `frontend/`

React + Leaflet: chat panel, the map and its layers, verdict card, alert banners, forecast
charts, and the **Reasoning Trace panel** — which is the single biggest visible
differentiator in the project. Keep it mobile-legible; the real user is a fisherman on a phone.

### E — ML / Geospatial
**Owns:** `services/pfz_proxy.py`, `services/risk_rules.py`, `agents/geospatial.py`, `agents/marine_data.py`, `agents/route.py`

PFZ-proxy reasoning (chlorophyll + SST fronts), geofencing with shapely (EEZ / IMBL / MPA),
the deterministic risk model, and route optimisation as a stretch.
**E's risk rules decide GO / NO_GO — that logic is deterministic and tested, never left to an LLM.**

### F — Multilingual + App + CV
**Owns:** `backend/app/i18n/`, voice pipeline, mobile view

Bhashini and Sarvam integration, ASR → graph → TTS pipeline, mobile layout.
**Stretch:** CV front/eddy detection from SST imagery feeding the marine-data agent.

---

## Ownership map

| Path | Owner |
|------|-------|
| `backend/app/graph/` | A |
| `backend/app/agents/planner.py`, `language_intent.py` | A |
| `backend/app/agents/risk.py` | A + E |
| `backend/app/agents/geospatial.py`, `marine_data.py`, `route.py` | E |
| `backend/app/agents/weather.py`, `sea_state.py`, `visualization.py` | B |
| `backend/app/api/` | B |
| `backend/app/adapters/` | B |
| `backend/app/services/cache.py`, `llm.py` | B |
| `backend/app/services/risk_rules.py`, `pfz_proxy.py` | E |
| `backend/app/services/explainability.py` | C |
| `backend/app/schemas/` | C *(change needs A+B+C+D)* |
| `backend/app/rag/`, `backend/tests/` | C |
| `backend/app/i18n/` | F |
| `frontend/` | D |
| `frontend/src/types/orca.ts` | D *(must mirror `schemas/response.py`)* |
| `scripts/` | B + E |
| `docs/` | whoever owns the subject |

---

## Working agreements

1. **Merge to `main` every day.** A branch older than 48 hours is a problem, not a feature.
2. **The contract is frozen after Day 3.** Changing it needs A + B + C + D, and all three
   files ([contract doc](API_CONTRACT.md), Python schema, TS types) change in the same PR.
3. **Every phase ends in a runnable demo.** See [ROADMAP.md](ROADMAP.md).
4. **No secrets in commits.** `.env` is gitignored; keys go in `.env.example` as blanks.
5. **Blocked for more than 2 hours? Say so at standup or in the channel.** In a 19-day
   build, a silent blocker is the most expensive thing there is.
6. **Ask before editing someone else's file.** Twenty seconds of asking beats an hour of
   merge conflict at 2 a.m.

## When you're behind

Cut stretch goals first, then golden query #4, then extra languages. Never cut the reasoning
trace, the evidence array, or the map — those three are the project.
