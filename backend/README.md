# ORCA backend

FastAPI + LangGraph. Python 3.11+.

> **Scaffold status:** every module is a stub raising `NotImplementedError`, except
> `app/schemas/` — the frozen response contract, which is real from day one so that
> frontend and backend can be built in parallel.

## Run

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env          # fill in keys

uvicorn app.main:app --reload --app-dir backend
# → http://localhost:8000/docs
```

## Layout

```
app/
├── main.py       App factory, lifespan (loads GeoJSON, compiles the graph)
├── config.py     Settings from .env
├── api/          HTTP + WebSocket boundary. No business logic.
├── schemas/      ⭐ The frozen contract. Everything codes against this.
├── graph/        LangGraph state + supervisor topology
├── agents/       The nine specialists
├── adapters/     One thin client per data source — the only place HTTP lives
├── services/     Risk rules, PFZ proxy, cache, LLM, explainability
├── i18n/         Bhashini / Sarvam
└── rag/          ChromaDB
```

**Dependencies point downward only.** An adapter importing an agent is a bug; so is an
agent importing another agent — route that through the graph.

## Where to start

| You are | Read | Then build |
|---------|------|------------|
| **A** (agents) | [ARCHITECTURE.md](../docs/ARCHITECTURE.md) | `graph/`, `agents/planner.py` |
| **B** (backend) | [DATA_SOURCES.md](../docs/DATA_SOURCES.md) | `adapters/open_meteo_*.py` first |
| **C** (RAG) | [API_CONTRACT.md](../docs/API_CONTRACT.md) | `services/explainability.py` |
| **E** (geo/ML) | [DATA_SOURCES.md](../docs/DATA_SOURCES.md) | `services/pfz_proxy.py`, `risk_rules.py` |
| **F** (i18n) | Report §8 | `i18n/bhashini.py` |

## Finding your work

TODOs carry a phase and an owner:

```bash
grep -rn "TODO(P0" backend/        # everything due in P0
grep -rn "TODO(P1, E)" backend/    # everything E owes in P1
```

## Spiking an adapter

Each adapter is runnable standalone:

```bash
python -m app.adapters.open_meteo_marine
python -m app.adapters.incois_pfz        # the P0 risk — spike this first
```

## Tests

```bash
pytest backend/tests -q
ruff check backend/
```

Priorities: `test_risk_rules.py` (it decides GO/NO_GO), `test_schemas.py` (the contract),
then adapter parsers against recorded fixtures. **No live network calls in tests.**

## Two rules that aren't negotiable

1. **Every agent appends a `TraceStep`.** The trace panel is the product.
2. **The safety verdict never comes from an LLM.** `services/risk_rules.py` decides; the
   model only phrases the reasons in the user's language.
