# Deployment

The full system, deployed properly: **frontend on Vercel, backend in a container.** Both
halves live, connected, with real data — no mock-only shortcut.

> Still demo from localhost on the day. Zero cold-start risk, no venue Wi-Fi dependency,
> and offline mock mode only works on a machine you control. The deployment is so judges
> have a working link afterwards. See [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

---

## Why two hosts

Vercel runs serverless functions: no persistent disk, a 250 MB bundle limit, short-lived
invocations. ORCA's backend needs the opposite of all three.

| Backend needs | Vercel |
|---|---|
| `xarray`, `netCDF4`, `chromadb`, `shapely`, `geopandas` | Native wheels blow the bundle limit |
| ~60 MB of Copernicus NetCDF + boundary GeoJSON on disk | No persistent filesystem |
| SQLite checkpointer for multi-turn memory | Instances don't share disk |
| A WebSocket held open per session (`/ws/trace/…`) | Functions terminate |

So: **frontend → Vercel, backend → Render / Hugging Face Spaces / Railway / Fly.** Any of
them; the `Dockerfile` is portable.

---

# The environment variables

## 1. Vercel (frontend) — ONE variable

Importing this repo makes Vercel read `.env.example` and offer to collect all 14 keys.
**Add none of them at import time.** The frontend reads exactly one variable, and only
after the backend is up:

| Variable | Value | When |
|---|---|---|
| `VITE_ORCA_API_BASE` | `https://orca-api.onrender.com` | After the backend is deployed. No trailing slash. |

> ### ⚠️ Never put an API key in a Vercel variable
> Vite **inlines every `VITE_`-prefixed variable into the built JavaScript**. A key set
> that way is readable by anyone who opens devtools. Un-prefixed variables aren't inlined
> — but then the frontend can't read them either, so setting them achieves nothing except
> leaving a trap for whoever later "fixes" it by adding the prefix.

Build settings: set **Root Directory = `frontend`** and let Vercel auto-detect Vite.
See [Frontend on Vercel](#frontend-on-vercel) below.

---

## 2. Backend host — the real list

### Required

| Variable | Value | Why |
|---|---|---|
| `ORCA_CORS_ORIGINS` | your exact Vercel URL, e.g. `https://orca-xyz.vercel.app` | **Without this the browser blocks every request.** Scheme included, no trailing slash. Comma-separate to add more. |

That is genuinely the only *required* one — ORCA boots and answers correctly with nothing
else set, in English, on the deterministic path.

### Strongly recommended

| Variable | Value | Unlocks |
|---|---|---|
| `GEMINI_API_KEY` | your key | Answers in the user's language |
| `GROQ_API_KEY` | your key | Fallback when Gemini rate-limits (~20 req/day free) |
| `COPERNICUS_USERNAME` | your username | Golden queries **#1** (fishing zones) and **#4** (productivity) |
| `COPERNICUS_PASSWORD` | your password | ditto |

Without Copernicus, #1 and #4 report a visible `skipped` step naming the fix. #2, #3 and
#5 are unaffected — they need no local data.

### Has a sensible default; set only to change it

| Variable | Default | Notes |
|---|---|---|
| `GEMINI_MODEL` | `gemini-flash-latest` | An alias, so it can't go stale like `gemini-2.5-flash` did |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Avoid `qwen/qwen3.6-27b` — it emits its `<think>` reasoning inline |
| `ORCA_USE_MOCK_DATA` | `false` | **Keep false on a hosted instance.** True serves canned responses. |
| `ORCA_LOG_LEVEL` | `INFO` | |
| `ORCA_CACHE_TTL_SECONDS` | `3600` | |
| `ORCA_BOOTSTRAP_DAYS` | `45` | History fetched at boot. Lower = faster cold start, shorter trend for #4. |
| `ORCA_SKIP_BOOTSTRAP` | `false` | `true` skips the data fetch entirely |

### Set these only if you have them

| Variable | Effect if unset |
|---|---|
| `BHASHINI_USER_ID`, `BHASHINI_API_KEY`, `BHASHINI_PIPELINE_ID` | The LLM translates instead. Same output, minus the "Government of India stack" story. |
| `SARVAM_API_KEY` | Unused — the Sarvam adapter is a P3 stub. |

**Nothing else.** If a host asks for a variable not on this page, it is guessing from
`.env.example`; skip it.

---

# Deploying

## Backend on Render

```
New → Blueprint → point at this repo
```

`render.yaml` declares everything. Fill the four `sync: false` secrets in the dashboard.
Or do it by hand: **New → Web Service → Docker**, leave the build/start commands empty
(the `Dockerfile` and entrypoint handle both).

**Free tier caveat:** no persistent disk, and the instance spins down after ~15 minutes
idle. Each cold start re-runs the data bootstrap, so the first query or two after a sleep
degrade for a minute while ~30 MB downloads. Uncomment the `disk:` block in `render.yaml`
on a paid plan and it persists.

## Backend on Hugging Face Spaces

Create a **Docker** Space, push this repo, and set the same variables as Space secrets.
Spaces expose port 7860 — the container honours `$PORT`, so set `PORT=7860`.

## Frontend on Vercel

1. Import the repo.
2. **Set Root Directory to `frontend`.** This is the only build setting you touch — Vercel
   then auto-detects Vite and fills in the rest (`npm install`, `npm run build`, `dist`).
3. Add **no** environment variables yet. Deploy.
4. Once the backend is live, add `VITE_ORCA_API_BASE` and **redeploy** — Vite compiles the
   value into the bundle at build time, so setting it without rebuilding does nothing.

> ### Don't add a `vercel.json`
> There was one here and it caused a build failure: it specified
> `cd frontend && npm run build`, but with Root Directory set Vercel already runs *inside*
> `frontend/`, so the `cd` failed with "No such file or directory". The app has no
> client-side router either, so it needed no rewrite rules. Root Directory plus Vercel's
> Vite auto-detection is the whole configuration.

---

# Verifying it end to end

```bash
API=https://your-backend-host

curl $API/health                    # {"status":"ok", ...}
curl $API/ready                     # what loaded, and what's missing + how to fix it
curl -X POST $API/api/query -H 'Content-Type: application/json' \
  -d '{"query":"Is it safe to go to sea tomorrow morning near Kakinada?","session_id":"t1"}'
```

`/ready` is the one to check after a deploy — it reports the boundary layers, Copernicus
subsets, LLM providers and knowledge base, and names the command that fixes anything
missing.

Then open the Vercel URL and ask a question. If the answer appears but the trace panel
stays empty, the WebSocket isn't reaching the backend — check that your host supports
WebSocket upgrades (Render and HF Spaces both do).

## When something looks wrong

| Symptom | Cause |
|---|---|
| Works in `curl`, fails in the browser | `ORCA_CORS_ORIGINS` doesn't exactly match the Vercel origin |
| Every query says "inland" | The frontend is sending device GPS; pick a harbour in the header |
| #1 and #4 skip with "subset not found" | Copernicus credentials missing, or the bootstrap is still running |
| #3 skips with "no boundary data" | Bootstrap couldn't reach the Marine Regions WFS; it retries next restart |
| Answers are English-only | Both LLM keys missing or rate-limited — the verdict is still correct |
| Trace panel empty, answers fine | WebSocket blocked; the POST response still carries the full trace |
