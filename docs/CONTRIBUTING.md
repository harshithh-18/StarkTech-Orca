# Contributing

Nineteen days, six people, one `main`. These conventions exist to keep us out of merge hell.

## The rules that matter

1. **Merge to `main` daily.** A branch older than 48 hours is a problem.
2. **Never break `main`.** If `main` is broken, that's the whole team blocked — fix it first.
3. **Don't edit files you don't own** without asking. See [TEAM.md](TEAM.md).
4. **No secrets in commits.** Ever. `.env` is gitignored; add new keys to `.env.example` as
   blanks with a comment saying where to register.
5. **The API contract is frozen after Day 3.** See [API_CONTRACT.md](API_CONTRACT.md).

## Branches

```
feat/<area>-<short-desc>     feat/adapter-open-meteo-marine
fix/<area>-<short-desc>      fix/geofence-antimeridian
docs/<short-desc>            docs/data-sources-incois
spike/<short-desc>           spike/incois-parse
```

`spike/` branches are throwaway — prove something works, then rewrite it properly. Don't
merge a spike.

## Commits

```
<area>: <what changed, imperative>

adapters: add Open-Meteo marine wave height fetch
graph: wire risk node after parallel specialists
frontend: stream trace steps into the reasoning panel
```

Areas: `graph`, `agents`, `adapters`, `services`, `schemas`, `api`, `i18n`, `rag`,
`frontend`, `scripts`, `docs`.

## Pull requests

Small and frequent beats big and rare. In the description say **what** and **why**, and
name the golden query or roadmap checkbox it advances.

One review before merge during P0–P2. **During P3–P4, two reviews** — late changes are where
demos die.

---

## Adding a new adapter

1. Create `backend/app/adapters/<source>.py`, following [`base.py`](../backend/app/adapters/base.py).
2. Return **`Evidence` objects**, never raw JSON. Put the model name in `source`:
   `"Open-Meteo Marine (ICON-Wave)"`.
3. Declare `ATTRIBUTION` and `CACHE_TTL` as module constants.
4. Implement the cascade: **live → cache → mock**. A network failure must not raise past
   the caller — return the best rung available and record which one you used.
5. Add a `if __name__ == "__main__":` block so it can be spiked standalone.
6. Document it in [DATA_SOURCES.md](DATA_SOURCES.md): endpoint, auth, TTL, attribution, gotchas.
7. Add a test with a recorded fixture — **no live network calls in tests.**

## Adding a new agent

1. Create `backend/app/agents/<name>.py`, following [`base.py`](../backend/app/agents/base.py).
2. **Append at least one `TraceStep`.** An agent that touches data without leaving a trace
   step is a bug — the trace panel is the product.
3. **Append `Evidence` for every value that influences the answer.**
4. Call adapters, never `httpx` directly. Never import another agent — route through the graph.
5. Register it as a node in [`graph/builder.py`](../backend/app/graph/builder.py) and teach the planner when to pick it.
6. Failure path: catch, append a `skipped` trace step with the reason, return partial state.
   **Never let one specialist fail the whole run.**

## Adding a map layer

1. Add the value to `MapLayer` in `schemas/enums.py` **and** `frontend/src/types/orca.ts`.
2. Serve it from `GET /api/layers/{layer}` as a GeoJSON `FeatureCollection`.
3. Render it in `MapView.tsx` and add a toggle in `LayerToggles.tsx`.
4. Have the visualization agent include it in `map_layers` when relevant.

## Changing the response contract

Only with A + B + C + D sign-off, and **all three change in one PR**:

- [`docs/API_CONTRACT.md`](API_CONTRACT.md)
- [`backend/app/schemas/response.py`](../backend/app/schemas/response.py) — source of truth
- [`frontend/src/types/orca.ts`](../frontend/src/types/orca.ts) — mirror

---

## Code style

**Python** — 3.11+, type hints on every public function, `ruff` for lint and format,
`snake_case` modules. Module docstring names the owner and phase:

```python
"""Ocean / Sea-State Agent — wave height, swell, currents, tides.

Owner: B · Phase: P2 · Source: Open-Meteo Marine
"""
```

**TypeScript** — strict mode, `PascalCase` components one per file, types imported from
`types/orca.ts` (never redeclared locally).

**TODOs** carry a phase and an owner so they're greppable:

```python
# TODO(P2, E): compute SST gradient magnitude over the 3-day window
```

```bash
grep -rn "TODO(P2" backend/    # everything due this phase
grep -rn "TODO(P2, E)" .       # everything E owes this phase
```

## Tests

`pytest` in `backend/tests/`. Not everything needs a test in 19 days, but these do:

- **`risk_rules.py`** — it decides GO / NO_GO. Test every threshold boundary.
- **`schemas/response.py`** — the contract. Test that the report's §12 example validates.
- **Adapter parsers** — against recorded fixtures, especially the INCOIS parser.

```bash
pytest backend/tests -q
```

## Before you push

```bash
ruff check backend/ && ruff format --check backend/
pytest backend/tests -q
git diff --cached --name-only | grep -q '\.env$' && echo "STOP: .env staged"
```
