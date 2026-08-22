# data/

Everything here is **gitignored** — large, regenerable, or licence-restricted. Only the
`.gitkeep` files are tracked. Each subdirectory has a script or a step that populates it.

If a directory is empty and something is failing, this file tells you how to fill it.

## `geojson/` — boundary polygons

| File | Source | Populate with |
|------|--------|---------------|
| `india_eez.geojson` | [Marine Regions](https://www.marineregions.org/) EEZ v11/v12 | `python scripts/download_geojson.py` |
| `india_imbl.geojson` | Marine Regions maritime boundaries | same |
| `india_mpa.geojson` | [Protected Planet (WDPA)](https://www.protectedplanet.net/) | same |

Loaded into shapely at application startup. Powers golden query #3 (geofencing).

⚠️ WDPA prohibits redistribution — that's why these are gitignored rather than committed.
Every teammate downloads their own copy.

## `copernicus/` — pre-downloaded NetCDF subsets

Bay of Bengal + Arabian Sea slices of SST and chlorophyll-a.

```bash
copernicusmarine login                        # free account, once
python scripts/fetch_copernicus_subset.py
```

Bounding box: **lon 65–95°E, lat 5–25°N** (Indian EEZ plus margin).

> Read from disk, **never streamed live**. Streaming NetCDF during a demo is how you get a
> 40-second pause on stage. Keep this in sync with `BBOX` in `app/adapters/copernicus.py`.

Feeds the PFZ proxy (query #1) and the productivity-decline analysis (query #4).

## `cache/` — adapter response cache

Written automatically at runtime by `app/services/cache.py`. Keyed by
`(adapter, params_hash)`, TTL per adapter. Safe to delete — it refills itself.

## `mock/` — demo-safety responses

Canned-but-**real** responses for the four golden queries, captured from live calls during
P3 rehearsal. `ORCA_USE_MOCK_DATA=true` serves these.

**Capture them, never hand-write them.** A hand-written mock is a lie you will eventually
show to a judge; a captured one is yesterday's truth. Use
`services/cache.capture_mock()` while pointed at the live APIs.

## `knowledge/` — RAG source documents *(created during P2)*

Advisory text, geofence rules and marine FAQ, ingested into ChromaDB with
`python -m app.rag.ingest`.

---

**Do not commit anything in here.** If a new data file needs to be tracked, add an explicit
negation to `.gitignore` and say why in this file.
