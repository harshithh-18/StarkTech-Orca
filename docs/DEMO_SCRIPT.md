# Demo Script

> **Skeleton — fill in during P3 (Sep 7–9) once the real outputs exist.**
> Rehearse three times on Sep 10. Time it: aim for **6 minutes** of demo, leaving room for
> questions.

Owner: **A**.

---

## Before you walk on stage

- [ ] `ORCA_USE_MOCK_DATA=true` — or cache warmed by running all four queries once
- [ ] Backend running on **localhost**, not the deployed URL
- [ ] Frontend on localhost, browser zoom set for the projector
- [ ] Wi-Fi **off** for one rehearsal to prove it survives
- [ ] Map pre-centred on the Bay of Bengal
- [ ] Reasoning Trace panel expanded — it's the differentiator, don't leave it collapsed
- [ ] Second laptop with a video recording of the full demo, as a hard fallback
- [ ] Browser tabs: app, deck, GitHub repo. Nothing else.

---

## Opening (30 s)

> "A fisherman on the Andhra coast has three questions before he goes out: where are the
> fish, is it safe, and am I about to cross a line I shouldn't. Today he gets those answers
> from three different places, in English, if at all.
>
> ORCA answers all three — in his language, on one map, and it shows him exactly why."

Say what it is in one sentence: *a supervisor agent that plans a task, dispatches specialist
agents to real marine data, and returns a verdict with its evidence.*

---

## Query 1 — "Where is the nearest fishing zone today?" (60 s)

**Type/say:** _"Where is the nearest Potential Fishing Zone today?"_

**Point at:**
- The trace panel filling in live: `language_intent → planner → marine_data → geospatial`
- PFZ polygons appearing on the map
- The distance + bearing to the nearest zone

**Say:** how the zone is derived — chlorophyll concentration coinciding with a sea-surface
temperature front. _"That's not a scraped page. That's the same reasoning INCOIS itself uses."_

_TODO(P3): fill in the actual numbers this returns, and the exact screen state._

---

## Query 2 — the multi-turn beat (45 s)

**This is the moment that proves it's conversational.** Do not skip it, do not rush it.

**Type/say:** _"…and is it safe there?"_

No location named. The agent carries the PFZ coordinates from the previous turn.

**Point at:**
- The verdict card: **GO / CAUTION / NO-GO**
- The reason under it: *"wave height 3.4 m exceeds the 2.5 m small-craft threshold"*
- The trace showing weather and sea-state running **in parallel**, then risk correlating them

**Say:** _"The verdict is deterministic — thresholds, not a language model. The model only
explains it. We don't let an LLM decide whether it's safe to go to sea."_

_TODO(P3): confirm the follow-up reliably resolves context. This is the highest-risk moment
in the demo — rehearse it more than anything else._

---

## Query 3 — the language switch (60 s)

**Ask a safety question in Telugu or Tamil.**

> రేపు ఉదయం సముద్రంలోకి వెళ్ళడం సురక్షితమేనా?

**Point at:** the answer coming back in the same language — verdict card, reasons and all.

**Say:** _"Language detection and response are through Bhashini, the Government of India's
own national language stack. Same stack, same government, same users."_

_TODO(P3): pick the exact sentence and verify the round-trip. Have a Telugu speaker on the
team read the output aloud and confirm it isn't awkward — a bad translation on stage is worse
than English._

---

## Query 4 — boundary proximity (45 s)

**Type/say:** _"Am I approaching any restricted boundary?"_

**Point at:** the alert banner, the IMBL line on the map, the distance to it.

**Say:** why this matters — crossing the International Maritime Boundary Line is what gets
boats detained. This is the alert with real consequences attached.

_TODO(P3): choose a demo coordinate close enough to a boundary to trigger the alert._

---

## Query 5 — the reasoning showcase (60 s)

**Type/say:** _"Why has fish productivity declined in this region?"_

This one exists to show **reasoning depth**, not lookup. Chlorophyll trend chart, SST
anomaly, a narrative that connects them.

**Point at:** the chart, and the evidence citations underneath with sources and timestamps.

_TODO(P3): confirm the narrative is defensible. A judge may well be an oceanographer._

---

## Close (45 s)

Pull up the trace panel one more time and scroll it.

> "Every number on this screen has a source and a timestamp. Every answer shows the agents
> that produced it and the rule that fired. That's the difference between a chatbot that
> sounds confident and a system a fisherman can actually bet his boat on."

Mention, briefly: built entirely on free and open data — Open-Meteo, Copernicus, INCOIS —
so it costs nothing to run at scale.

---

## Anticipated questions

| Question | Answer |
|----------|--------|
| "Is this live data?" | Yes — Open-Meteo and Copernicus, live. Cached for demo reliability, and the UI badges when it's cached. *(Never claim live if you're on mocks.)* |
| "Where does the fishing zone come from?" | INCOIS advisories where available, plus our own chlorophyll + SST-front computation from Copernicus. Two independent sources. |
| "How accurate is the cyclone/lightning data?" | **Be honest:** lightning is a modelled proxy from thunderstorm probability, not an IMD lightning observation. We flag it in the evidence. |
| "Why not just one big LLM prompt?" | Five specialist agents with a deterministic risk layer. The safety verdict never comes from a language model. |
| "How many languages?" | Ten via Bhashini; demoed in Telugu/Tamil; the four coastal languages are the priority. |
| "What's not built?" | Route optimisation and voice are architected and stubbed. Say so plainly — pointing at a clean stub reads better than bluffing. |

---

## If something breaks

1. **Don't apologise twice.** Say "let me show you this from the cache" and move on.
2. **A partial answer is a feature.** If a data source drops out, the trace shows a `skipped`
   step with the reason — point at it: *"that's the degradation path working."*
3. **Video fallback** on the second laptop if the app won't start at all.
4. **Never** debug live in front of judges. Move to the next query.

---

## Timing

| Segment | Target |
|---------|--------|
| Opening | 0:30 |
| Query 1 — PFZ | 1:00 |
| Query 2 — multi-turn safety | 0:45 |
| Query 3 — language switch | 1:00 |
| Query 4 — boundary | 0:45 |
| Query 5 — reasoning | 1:00 |
| Close | 0:45 |
| **Total** | **~5:45** |
