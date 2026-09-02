# Demo Script

**Rehearse this once end-to-end before you present.** Timings assume ~6 minutes.

---

## Before you leave for the venue

Run these **on the demo machine, on good Wi-Fi**, in this order:

```bash
# 1. Confirm what's wired up
python scripts/prepare_demo.py --check

# 2. Warm the cache against live sources, then capture mocks from it
python scripts/prepare_demo.py

# 3. Flip the safety switch
#    .env →  ORCA_USE_MOCK_DATA=true

# 4. Start both servers
uvicorn app.main:app --app-dir backend          # :8000
cd frontend && npm run dev                       # :5173

# 5. REHEARSE WITH THE WI-FI OFF. If it works offline, nothing on stage can break it.
```

> ### Why mocks, and how to answer if a judge asks
> "Mocks" here are **real responses captured from the live APIs this morning**, not
> hand-written data. Every answer still carries its real source and timestamp, and the UI
> badges `demo data` so nothing is presented as live when it isn't. Say that plainly if
> asked — it is a strength, not a hedge.

**Known limit:** the Gemini free tier is ~20 requests/day and *will* rate-limit. Groq is
the automatic fallback and handles it, and below that a deterministic path answers with no
model at all. This is worth demonstrating rather than hiding (see the failure beat).

---

## The narrative

Open with the problem, not the architecture. **30 seconds:**

> "A fisherman leaving harbour at 4 a.m. has three questions: where are the fish, is it
> safe, and am I about to cross a line that gets my boat impounded. The data to answer all
> three is public — and completely unusable to him. It's in NetCDF files, English-only
> government portals, and satellite products. ORCA answers those questions in his own
> language, and shows its working."

---

## Query 1 — Nearest fishing zone · 60s

Type: **"Where is the nearest Potential Fishing Zone today?"**

Point at the map as the zones draw, then at the trace panel.

> "That zone wasn't scraped from anywhere. INCOIS — the official source — has no usable
> API; we checked, and the advisory page is a client-rendered shell. So we compute the
> zones the same way INCOIS does: high chlorophyll-a where it meets a sea-surface
> temperature front. Click a zone and it tells you the two numbers that qualified it."

**Click a zone polygon** to show the popup with chlorophyll and gradient.

---

## Query 2 — Is it safe? · 90s · *the core*

Type: **"Is it safe to go to sea tomorrow morning near Kakinada?"**

Let the verdict card land. Then the point that matters most:

> "The verdict is **not** from the language model. It's a deterministic rule engine
> comparing forecast values against small-craft thresholds. The model only phrases it in
> the user's language, and it is never allowed to change or soften a verdict. A
> hallucinated 'safe to go' could kill someone — so the model is never in that decision."

Then the detail that shows real domain thinking:

> "One thing we found building this: sampling wave height at the harbour reads about a
> third of what it is 25 km offshore where the boat actually fishes — and the caution
> threshold sits between the two. So we sample a ring of points offshore and report the
> worst, and we show you which point it came from."

Expand **Why?** on the message to show the evidence list.

---

## Query 3 — Boundary proximity · 60s

Type: **"Am I approaching any restricted boundary?"**

Best shown near the Sri Lanka boundary (Palk Strait). The red banner fires.

> "This is the alert that matters most. Crossing the International Maritime Boundary Line
> is what gets Indian boats detained by a neighbouring coast guard. We alert on *approach*,
> not on breach — a warning after the crossing is worthless."

If asked why the EEZ doesn't warn: being inside India's own EEZ is the normal lawful
state, and international waters are lawful too. Only an IMBL crossing or a protected area
is a breach. **We deliberately removed baselines from the alert set** — they hug the coast
and would fire at every harbour, training the user to ignore the warning that counts.

---

## Query 4 — Why fewer fish? · 60s

Type: **"Why has fish productivity declined in this region?"**

This is the beat that shows integrity. The data may well contradict the question:

> "Notice what it did — the question assumes a decline, and the data says chlorophyll has
> actually *risen* 160%, because we're in the monsoon bloom. It contradicts the premise
> rather than inventing a decline to match. It also says exactly what it compared against:
> recent weeks versus the preceding period, not a multi-year seasonal normal, because the
> product we read doesn't have that history."

---

## The multilingual beat · 45s

Type the Telugu query: **రేపు సముద్రంలోకి వెళ్ళడం సురక్షితమేనా?**

> "Same engine, same deterministic verdict, answered in Telugu. Every number is preserved
> exactly — the model translates the verdict, it never rewrites it."

If Bhashini credentials are configured, add:

> "Translation is going through Bhashini, the Government of India's own language stack —
> on a government problem statement, using the government's own AI infrastructure."

---

## Multi-turn · 30s

Ask query 1, then: **"…and is it safe there?"**

> "It resolved 'there' from the previous turn. The conversation has memory, keyed by
> session."

---

## The failure beat — rehearse this · 30s

**Practise what you say when something degrades**, because something will.

Every answer that couldn't use a source says so in the trace with a `skipped` step naming
the reason. If a judge sees one:

> "That's the system telling you what it *couldn't* check. It answered with what it had and
> told you what was missing, rather than quietly answering with less. For a safety tool,
> knowing what you don't know is the whole point."

If the LLM rate-limits mid-demo, the answer comes back in English with the correct verdict.
Say so:

> "That's the free tier rate-limiting. The verdict is unaffected — it's deterministic. We
> lost the translation, not the answer."

---

## Closing · 30s

> "Four queries, in five languages, on live public data — with every number sourced and
> every agent's step visible. The three things we'd never cut are on screen right now: the
> reasoning trace, the evidence array, and the map."

---

## If asked

**"Why 2.5 metres?"** — Provisional small-craft thresholds; they are in one tested pure
function, sourced and cited before production use. Say it's provisional; don't invent a
source.

**"Is the lightning real?"** — No, and we label it. It's CAPE, a modelled measure of
atmospheric instability, not an observed strike. That label is in the evidence string.

**"What's actually agentic here?"** — Show the trace: a planner chooses which specialists
to dispatch per query, they run in parallel, and a risk node correlates them. Different
questions dispatch different agents; you can see it happen live.

**"What if a data source is down?"** — Every adapter cascades live → cache → mock, and no
source can produce a 500. Offer to show it: the trace will name the skipped agent.

---

## Do not

- Do not demo on a cold live API call.
- Do not claim the lightning proxy is an observation.
- Do not claim the productivity trend is a climatological anomaly.
- Do not say "the AI decides if it's safe" — the rule engine does, and that distinction is
  the strongest thing you have to say.
