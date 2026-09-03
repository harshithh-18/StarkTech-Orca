# Roadmap — 22 Aug → 10 Sept 2026

**19 days. 6 people. One rule above all others:**

> ### At the end of every phase there must be a runnable demo, even if it is thin.
> The number one hackathon killer is "everyone integrates on day 18." Merge to `main` daily.

---

## P0 — De-risk & Setup · Aug 22–24 (Sat–Mon)

**Goal:** prove we can actually get the data. Lock the architecture. Nothing else matters yet.

- [ ] Repo pushed to GitHub, everyone has clone + push access — **A**
- [x] FastAPI skeleton boots, `/health` returns 200 — **B**
- [x] LangGraph "hello agent" runs one node end-to-end — **A**
- [x] Open-Meteo **Marine** adapter returns real wave height for a coastal lat/lon — **B**
- [x] Open-Meteo **Weather** adapter returns real wind — **B**
- [x] Open-Meteo **Geocoding** resolves "Kakinada" → 16.99, 82.24 — **B**
- [x] Copernicus free account registered; one `copernicusmarine.subset` call lands a
      Bay-of-Bengal SST + chlorophyll slice in `data/copernicus/` — **E**
- [x] **INCOIS parse spike** — can we read the PFZ text page reliably? — **B + E**
- [x] India EEZ GeoJSON downloaded, loaded into shapely, point-in-polygon works — **E**
- [x] Gemini free key works; Telugu and Tamil round-trip correctly — **F**
- [ ] Six roles assigned, daily standup time set — **all**
- [x] **Response schema frozen** (Day 3) — [API_CONTRACT.md](API_CONTRACT.md) — **C**

> ### 🚦 Gate — end of Day 2 (Aug 23): INCOIS go/no-go — ✅ **DECIDED: PROXY** (27 Aug)
> No parseable INCOIS endpoint exists: the advisory page is a client-rendered shell and
> both the documented text and geoportal URLs 404. `services/pfz_proxy.py` is **primary**
> for query #1; INCOIS stays wired as best-effort enrichment. Evidence and reproduction
> in [DATA_SOURCES.md](DATA_SOURCES.md) and `scripts/incois_spike.py`.

**Demo at end of P0:** a terminal script that fetches real wave height and wind for a named
port. Unglamorous, but it proves the foundation isn't fiction.

---

## P1 — Golden query #1 end-to-end · Aug 25–31

**Goal:** one complete vertical slice. Text in → map out. Depth over breadth, starting now.

> *"Where is the nearest Potential Fishing Zone today?"*

- [x] Language + Intent agent: detect language, classify intent, extract location — **A**
- [x] Planner agent: decompose and select specialists — **A**
- [x] LangGraph supervisor topology wired with shared append-only state — **A**
- [x] Marine Data agent: PFZ from INCOIS **or** the Copernicus proxy — **E**
- [x] Geospatial agent: nearest zone, **distance + bearing** from the user — **E**
- [x] `POST /api/query` returns a valid `OrcaResponse` — **B**
- [x] React + Leaflet shell: chat panel left, map right — **D**
- [x] PFZ polygons render on the map with the user pin — **D**
- [x] `evidence[]` and `reasoning_trace[]` populated on every response — **C**
- [x] First tests: schema validation + risk rules — **C**

**Demo at end of P1:** ask query #1 in English in the browser, get a real map with real
zones and a real distance. This is the moment the project becomes real.

---

## P2 — Queries #2–#4 + multilingual · Sep 1–6

**Goal:** complete the golden path and make the agentic behaviour *visible*.

- [x] Weather + Sea-state agents wired into the graph — **B**
- [x] `risk_rules.py`: deterministic thresholds → **GO / CAUTION / NO_GO** — **E**
- [x] Risk agent phrases the reasons in the user's language — **A + F**
- [x] **Query #2** — safety verdict card with top reasons — **D + E**
- [x] Geofencing vs EEZ / IMBL / MPA with proximity alerts — **E**
- [x] **Query #3** — boundary proximity alert on map + banner — **D + E**
- [x] Chlorophyll + SST trend analysis over time — **E**
- [x] **Query #4** — "why productivity declined" narrative + trend chart — **A + D**
- [x] Map layer toggles: SST, chlorophyll, wave heatmaps — **D**
- [x] **Reasoning Trace panel streaming live over WebSocket** — **D + B**
- [x] **Bhashini NMT** integrated for ta / te / ml / bn / hi — **F**
- [x] Multi-turn memory: *"…and is it safe there?"* carries context — **A**
- [x] RAG over advisory text + geofence rules — **C**

> ### 🚦 Gate — Sep 6: golden path complete
> All four queries answer correctly in at least two languages, with a visible trace.
> **If anything here is incomplete, cut a stretch goal — do not cut polish.**

**Demo at end of P2:** the full four-query walkthrough, in Telugu, with the trace panel
streaming. This is essentially the final demo; P3 only makes it survivable.

---

## P3 — Polish & harden · Sep 7–9

**Goal:** make it impossible to break on stage.

- [x] **Cache + mock fallback** working; `ORCA_USE_MOCK_DATA=true` runs the whole demo — **B**
- [x] `data/mock/` captured from real responses for all four queries — **B**
- [x] Every adapter degrades gracefully; no data source can produce a 500 — **B**
- [x] Alert banners: cyclone / high wave / lightning / geofence — **D**
- [x] Forecast charts: 48-hour wave + wind, tide curve — **D**
- [x] Source citations visible under every answer — **C + D**
- [x] Mobile-legible layout — the real user is on a phone — **D + F**
- [x] UI polish pass: one glanceable verdict, not a wall of numbers — **D**
- [x] Attribution footer (Open-Meteo CC-BY, Copernicus, INCOIS) — **D**
- [x] [DEMO_SCRIPT.md](DEMO_SCRIPT.md) written and rehearsed once — **A**
- [ ] Deck built — **all**
- [ ] Deployed to Vercel + HF Spaces so judges have a link — **B + D**

**Stretch, only if the above is genuinely done:**

- [x] **Voice I/O** — ask by mic, answers read aloud, safety verdicts spoken automatically.
      Browser-native Web Speech API, so it needs no credentials; Bhashini ASR/TTS remains
      the documented upgrade. — **F**
- [x] **Route optimisation** (golden query #5) — A* over a forecast wave grid, costed at
      estimated time of arrival, land impassable. — **E**
- [x] **CV front/eddy detection** — delivered in P4, see below — **F**
- [x] **Proactive alerts** — delivered in P4, see below

**Demo at end of P3:** the whole thing, from a cold laptop, with the Wi-Fi turned off.

---

## P4 — Buffer & rehearsal · Sep 10

- [ ] Full end-to-end rehearsal **× 3**, timed
- [ ] Rehearse the failure path: what you say when a query returns partial data
- [ ] Fix demo-breakers **only** — no new features, no refactors, no "quick improvements"
- [ ] Submit

---

## P4 — Operational depth · Sep 3

**Goal:** close the gap between "answers five questions" and "is a platform someone would
open in the morning". Everything here is additive; nothing in P0–P3 was renegotiated, and
the frozen response contract was not touched.

### The platform speaks first

- [x] **Conditions dashboard** — `GET /api/conditions` returns the live now-cast for a
      point: eight readings against their limits, the verdict, the tide, the forecast
      curves. No question required. — **B**
- [x] **Next safe departure window** — `services/safe_window.py` scores every hour of the
      forecast with the *same* `risk_rules.breaches` the verdict uses, groups the safe
      runs, and answers "then when?" — the question a NO_GO always provokes. — **E**
- [x] **Proactive watches** — `POST /api/watch` registers a standing watch; the backend
      re-checks conditions and boundary distance on a timer and pushes anything that
      turned worse down the existing trace socket. Announces changes, never repeats
      itself, never announces good news. — **B + E**

### New data

- [x] **Tides** — `sea_level_height_msl` from the marine model, rides on the request we
      already make. Curve + next high/low. Closes the problem statement's "tide, weather
      and sea conditions" query. — **B**
- [x] **Thermal front / eddy detection** — `services/fronts.py`. Gradient magnitude of a
      smoothed SST field, thresholded at the operational front definition, connected
      components, shape heuristic for eddy-like features. Feeds the fishing-zone and
      productivity answers, so "there is a zone 38 km north-east" becomes "…on the edge of
      a 200 km temperature front". — **E**
- [x] **Cyclone classification** — `adapters/imd_bulletins.py`, the P2 TODO resolved. IMD
      publishes no machine-readable bulletin (all four documented URLs 404, verified), so
      modelled pressure and sustained wind are classified against IMD's own wind bands and
      labelled a proxy everywhere they surface. — **B**
- [x] **wave_heatmap and hazard_overlay** now return real data. Both were selected by the
      visualization agent and served an empty collection — a layer switched on for every
      safety answer that drew nothing. — **B**

### The interface

- [x] **Rebuilt as a console, not a page.** Five named destinations — Ask, Conditions,
      Alerts, Layers, Sources — with the map always beside them. — **D**
- [x] **First-run setup**: what ORCA is, who it is for, and the three settings that make
      the first answer a good one (role, harbour, language). — **D**
- [x] Role-aware starters: a fisher, a coastal authority, a researcher and an operator ask
      different questions of the same data. — **D**
- [x] One SVG icon system replacing emoji chrome; a three-level surface system; shared
      formatters so no two panels describe the same window differently. — **D**
- [x] Map: real dark treatment per basemap, place labels, click-to-repoint, live legend,
      coordinate readout, `ResizeObserver` re-measure. — **D**
- [x] An error boundary around the map, after a hidden-container `flyTo` crash was found to
      blank the entire application on every screen narrower than 768px. — **D**

### Tests

211 passing, up from 144. New suites for the departure window, the conditions snapshot,
front detection, watches and the cyclone proxy — each pinning the property that would be
dangerous to get wrong rather than the shape of the output.

---

## Scope discipline

The problem statement lists ~10 capabilities. We are building **4 queries flawlessly**,
wrapped in a visible reasoning trace and a multilingual layer. Everything else is
*architected but stubbed* — the structure is in the repo and we can point to it.

A judge remembers one flawless demo. They do not remember ten broken ones.

When you're behind, cut in this order:

1. Stretch goals (voice, route, CV)
2. Golden query #4
3. Languages beyond Telugu + English

**Never cut:** the reasoning trace, the evidence array, or the map. Those three *are* the project.
