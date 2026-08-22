# ORCA frontend

React + Vite + TypeScript + Tailwind + Leaflet. Owner: **D**.

> **Scaffold status:** components are typed stubs. Nothing is wired.

## Run

```bash
npm install
npm run dev     # → http://localhost:5173
```

Vite proxies `/api` and `/ws` to the backend on `:8000`, so all URLs stay origin-relative
and the deployed build needs no environment config.

## Layout

```
┌──────────────┬────────────────────────────────┐
│ AlertBanner (full width, only when alerts)    │
├──────────────┼────────────────────────────────┤
│              │  MapView            [Layers]   │
│  ChatPanel   │                                │
│              ├────────────────────────────────┤
│              │  VerdictCard + ForecastChart   │
├──────────────┴────────────────────────────────┤
│ ReasoningTrace (collapsible, streams live)    │
├───────────────────────────────────────────────┤
│ SourceCitations · attribution footer          │
└───────────────────────────────────────────────┘
```

On mobile this stacks — **verdict first**, then map, then chat, trace collapsed.

## Files

```
src/
├── types/orca.ts        ⭐ contract mirror — import types from here, never redeclare
├── api/client.ts        REST
├── api/socket.ts        WebSocket trace stream
├── hooks/               useOrcaQuery (conversation), useReasoningTrace (live steps)
└── components/          ChatPanel, MapView, VerdictCard, ReasoningTrace, …
```

## Build order

1. `ChatPanel` + `useOrcaQuery` — get a round-trip working
2. `MapView` with the user pin and PFZ polygons (golden query #1)
3. `VerdictCard` (golden query #2)
4. **`ReasoningTrace` + the WebSocket** — the biggest visible differentiator
5. `AlertBanner`, `ForecastChart`, `SourceCitations`, polish

## Three things that decide whether this works

1. **The map is the hero.** A pretty chatbot with no map is a generic RAG bot.
2. **The trace panel is why it looks agentic.** Expanded by default during the demo.
3. **Mobile-legible.** The real user is a fisherman on a phone, possibly at 4 a.m.
   One glanceable verdict beats a wall of numbers.

## Contract

`src/types/orca.ts` mirrors `backend/app/schemas/response.py`. Changing either requires
A + B + C + D and simultaneous edits to both plus [docs/API_CONTRACT.md](../docs/API_CONTRACT.md).

```bash
npm run lint    # tsc --noEmit — catches contract drift
```
