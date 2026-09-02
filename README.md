# 🐋 ORCA

**Marine EcOsystem Reasoning with Collaborative Agents**

An agentic AI platform for India's coastal users. A fisherman or maritime authority asks a
question in their own language — *"Where's the nearest fishing zone?"*, *"Is it safe to sail
tomorrow?"* — and a **supervisor agent** plans the task, dispatches **specialist agents** to
fetch marine, weather and geospatial data, correlates the signals, and returns a **map + a
verdict + the evidence and reasoning behind it**.

> **Status: P1 — runs end-to-end.** Ask a question in the browser, get a real verdict from
> real forecast data with a live agent trace. Golden queries #2 (safety) and #3 (geofencing)
> are complete; #1 (fishing zones) needs a free Copernicus account — see
> [Getting the data](#getting-the-data). See [docs/ROADMAP.md](docs/ROADMAP.md).
>
> **It runs with no API keys at all.** Every agent has a deterministic fallback, so
> language detection, intent classification, planning and the verdict all work keyless.
> Adding a Gemini or Groq key upgrades phrasing and lets ORCA answer in the user's language.

---

## The three things that make ORCA different

1. **Visible reasoning.** Every answer streams its agent trace live — you watch the platform
   think. See [`ReasoningTrace.tsx`](frontend/src/components/ReasoningTrace.tsx).
2. **Evidence, not assertions.** Every answer carries an `evidence[]` array with value,
   source and timestamp. Baked into the schema, not bolted on. See [docs/API_CONTRACT.md](docs/API_CONTRACT.md).
3. **Speaks the user's language.** Query in Tamil, get the answer in Tamil — via Bhashini,
   the Government of India's own Indic language stack.

## Golden path — the four queries that must be flawless

| # | Query | Output |
|---|-------|--------|
| 1 | "Where is the nearest Potential Fishing Zone today?" | Map with PFZ polygons + distance & bearing |
| 2 | "Is it safe to go to sea tomorrow morning near Kakinada?" | **Go / Caution / No-Go** card with reasons |
| 3 | "Am I approaching any restricted boundary?" | Proximity alert vs IMBL / EEZ / MPA |
| 4 | "Why has fish productivity declined in this region?" | Explainable narrative + chlorophyll trend chart |

Plus one multi-turn beat — *"…and is it safe there?"* after #1 — to prove conversational memory.
Route optimisation (#5) is a stretch goal. Full detail in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Architecture

```mermaid
flowchart TD
    U[User: text / voice, any Indian language] --> L[Language + Intent Agent<br/>detect lang, classify intent, extract location+time]
    L --> P[Planner / Supervisor Agent<br/>decomposes into sub-tasks, selects agents]
    P --> W[Weather Intelligence Agent]
    P --> S[Ocean / Sea-State Agent]
    P --> M[Marine Data Agent<br/>PFZ, chlorophyll, SST]
    P --> G[Geospatial / Geofencing Agent<br/>EEZ, IMBL, MPA]
    W --> R[Risk Assessment Agent<br/>correlate + Go/Caution/No-Go]
    S --> R
    M --> R
    G --> R
    R --> V[Visualization + Reporting Agent<br/>map layers, charts, alert cards]
    V --> X[Synthesis + Explainability<br/>answer + evidence + reasoning_trace]
    X --> O[Response: same language as input<br/>map + verdict + why]
```

Deeper treatment — including which modules are real LLM agents and which are deterministic
tools — in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Repo map

```
Orca/
├── docs/          Architecture, data sources, API contract, roadmap, demo script
├── backend/       FastAPI + LangGraph supervisor and specialist agents
│   └── app/
│       ├── api/         HTTP routes + WebSocket trace stream
│       ├── schemas/     ⭐ FROZEN response contract — code against this
│       ├── graph/       LangGraph state + supervisor topology
│       ├── agents/      The nine specialist modules
│       ├── adapters/    One thin client per data source
│       ├── services/    Cache, risk rules, PFZ proxy, explainability, LLM
│       ├── i18n/        Bhashini / Sarvam
│       └── rag/         ChromaDB advisory + rule retrieval
├── frontend/      React + Vite + Leaflet — chat, map, verdict card, reasoning trace
├── data/          GeoJSON boundaries, Copernicus subsets, cache, demo mocks (gitignored)
└── scripts/       One-shot P0 data-access spikes
```

## Quickstart

```bash
cp .env.example .env          # keys are optional — see below

# Backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn app.main:app --reload --app-dir backend    # → http://localhost:8000/docs

# Frontend (in a second terminal)
cd frontend && npm install && npm run dev          # → http://localhost:5173
```

Then ask *"Is it safe to go to sea tomorrow morning near Kakinada?"*

**`GET /ready` tells you what's wired up** — which data sources loaded, whether an LLM key
is live, and what command fixes anything missing. Check it before demoing.

```bash
# The P0 spikes still work standalone, straight against the live APIs:
python -m app.adapters.open_meteo_marine     # real wave height for Kakinada
python -m app.adapters.open_meteo_weather    # real wind + CAPE
python -m app.adapters.open_meteo_geocoding  # Kakinada → 16.99, 82.24
pytest backend/tests/                        # 52 tests, no network required
```

## Getting the data

Nothing below blocks you from running ORCA — each one unlocks a specific capability, and
until it lands the responsible agent emits a visible `skipped` step naming the fix.

| What | Unlocks | How |
|------|---------|-----|
| **Gemini key** (free) | Answers in the user's language, better edge-case classification | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → `GEMINI_API_KEY` in `.env` |
| **Groq key** (free) | Fallback when Gemini rate-limits | [console.groq.com](https://console.groq.com) → API Keys → Create → `GROQ_API_KEY` |

> **Model names go stale.** `gemini-2.5-flash` and `llama-3.3-70b-versatile` (the original
> defaults) are both retired for new keys and return 404. Defaults are now
> `gemini-flash-latest` — an alias, so it tracks the current model instead of pinning a
> version that expires — and `openai/gpt-oss-120b` on Groq. Check what a key can reach:
>
> ```bash
> curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"
> curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
> ```
>
> A dead model is not fatal — ORCA falls back to the deterministic path and answers
> correctly in English. Check `/ready` and the trace's `[via …]` tag to tell which ran.
| **Copernicus account** (free) | Golden query #1 — the computed PFZ proxy | [register](https://data.marine.copernicus.eu/register), then `copernicusmarine login` and `python scripts/fetch_copernicus_subset.py` |
| **EEZ / IMBL / MPA polygons** | Golden query #3 — geofencing | `python scripts/download_geojson.py` prints the two download links and converts what you drop in |

## Documentation

| Doc | Read it when |
|-----|--------------|
| [IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md) | You want the full strategy — the canonical source of truth |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | You're writing an agent or wiring the graph |
| [DATA_SOURCES.md](docs/DATA_SOURCES.md) | You're writing an adapter |
| [API_CONTRACT.md](docs/API_CONTRACT.md) | **Always.** Frontend and backend both code against this |
| [ROADMAP.md](docs/ROADMAP.md) | Start of every phase |
| [TEAM.md](docs/TEAM.md) | You're not sure whose file you're about to edit |
| [DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | Rehearsal week |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | Before your first PR |

## Timeline

**22 Aug → 10 Sept 2026.** Five phases, each ending in a runnable demo — never let
integration slip to the final week. See [docs/ROADMAP.md](docs/ROADMAP.md).

---

### Data attribution

ORCA is built on open data and credits it:

- Weather and marine forecasts by [Open-Meteo.com](https://open-meteo.com/), licensed
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Ocean colour and sea-surface-temperature products generated by the
  [E.U. Copernicus Marine Service Information](https://marine.copernicus.eu/).
- Potential Fishing Zone advisories from [INCOIS](https://incois.gov.in/), Ministry of Earth
  Sciences, Government of India.
- Maritime boundaries from [Marine Regions](https://www.marineregions.org/); protected areas
  from [Protected Planet (WDPA)](https://www.protectedplanet.net/).
