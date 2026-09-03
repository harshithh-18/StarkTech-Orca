# Data Sources

Owner: **B** (adapters) with **E** (geospatial + PFZ proxy).

Every source gets a thin adapter in [`backend/app/adapters/`](../backend/app/adapters/) exposing a
clean internal interface. Agents call adapters; agents never call `httpx` directly. This is
what makes the INCOIS fallback and demo-day mocking possible without touching agent code.

---

## ⚠️ The one real risk: INCOIS

> ## 🚦 P0 GATE — DECIDED 27 Aug 2026: **PROXY**
>
> The spike ran. **INCOIS cannot be depended on**, so
> [`services/pfz_proxy.py`](../backend/app/services/pfz_proxy.py) is the **primary** source
> for golden query #1, and INCOIS is wired as best-effort enrichment only.
>
> Evidence (reproduce with `python scripts/incois_spike.py`):
>
> | Endpoint | Result |
> |----------|--------|
> | `MarineFisheries/PfzAdvisory` | HTTP 200, but a **navigation shell**: 0 `<table>`, 0 `<form>`, 0 `<option>`, 0 coordinate-shaped strings, 0 AJAX/action URLs. Content is client-side rendered. |
> | `MarineFisheries/TextDataHome` | **404** — the documented text-advisory URL is dead |
> | `geoportal/MFASPFZ` | 302 → `/geoportal/MFASPFZ/` → **404** |
> | `incois.gov.in/erddap` | **404** — no ERDDAP endpoint |
>
> **Consequence:** golden query #1 requires the Copernicus subset
> (`python scripts/fetch_copernicus_subset.py`). Until it is downloaded, the marine agent
> emits a visible `skipped` trace step naming that script — it never returns a silent
> empty result, because "no zones today" and "we could not fetch" must stay distinguishable.
>
> The adapter keeps a working parser and re-checks on every call, so if INCOIS ever serves
> parseable advisory text we get corroboration for free.

**INCOIS has no clean REST API.** It publishes PFZ advisories as WebGIS layers and HTML/text
pages. Scraping them is doable but brittle, and it is the single thing most likely to break
on demo day.

**The spike (P0, ½ day, B + E):** run [`scripts/incois_spike.py`](../scripts/incois_spike.py) and answer one
question by **end of Day 2** — can we parse the PFZ text advisory reliably enough to depend on it?

**The fallback, which is better than it sounds:** compute a PFZ proxy ourselves from
Copernicus data — **high chlorophyll-a (> ~0.2–0.3 mg/m³) coinciding with a strong SST
gradient (a thermal front)** marks a likely fish-aggregation zone. That is scientifically
the actual method INCOIS uses. Building it means ORCA *reasons about* fishing zones instead
of echoing a scraped page — which is a stronger story for judges, not a weaker one.

Implementation: [`backend/app/services/pfz_proxy.py`](../backend/app/services/pfz_proxy.py).

**Either way, build the proxy.** If the scrape works, use INCOIS as the primary and the
proxy as corroborating evidence — two independent sources agreeing is exactly the kind of
evidence the problem statement is asking for.

---

## Source table

| Source | Gives us | Auth | Adapter |
|--------|----------|------|---------|
| Open-Meteo Marine | Wave height/period/direction, swell, SST, currents, **tide** | none | `open_meteo_marine.py` |
| Open-Meteo Weather | Wind, precip, temp, weather codes, thunderstorm probability | none | `open_meteo_weather.py` |
| Open-Meteo Geocoding | Place name → lat/lon | none | `open_meteo_geocoding.py` |
| Copernicus Marine | Gridded chlorophyll-a + SST (NetCDF) | free account | `copernicus.py` |
| INCOIS PFZ | Official Potential Fishing Zones | none (scrape) | `incois_pfz.py` |
| IMD wind bands | Cyclone **classification** of a modelled field (see below) | none | `imd_bulletins.py` |
| Marine Regions EEZ | India EEZ + IMBL polygons | download | `geojson_store.py` |
| Protected Planet (WDPA) | Marine Protected Areas | download | `geojson_store.py` |

Two entries in that table are **computed, not retrieved**, and both say so in every
`Evidence.source` string they produce: the PFZ proxy and the cyclone classification. A
third — the tide — is a model field rather than a port tide table. The Sources view in the
frontend repeats all three in plain language, because a user who cannot tell an official
advisory from our arithmetic cannot calibrate how much to trust either.

---

## Open-Meteo Marine — the sea-state backbone

```
GET https://marine-api.open-meteo.com/v1/marine
    ?latitude=16.99&longitude=82.24
    &hourly=wave_height,wave_direction,wave_period,swell_wave_height,sea_surface_temperature
    &forecast_days=7&timezone=auto
```

- **No API key.** ~10 000 calls/day free. 16-day forecast horizon.
- **Cache TTL: 1 hour.** Forecasts don't update faster than that.
- Feeds golden queries #2 (safety) and #5 (route).
- **Attribution required:** `Weather data by Open-Meteo.com (CC BY 4.0)`.

## Open-Meteo Weather

```
GET https://api.open-meteo.com/v1/forecast
    ?latitude=16.99&longitude=82.24
    &hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,
            precipitation_probability,weather_code,cape,visibility
    &forecast_days=7&timezone=UTC
```

Wind and gusts drive the safety verdict alongside wave height.

> ### ⚠️ `thunderstorm_probability` is a trap — do not use it
> **Verified 27 Aug 2026:** Open-Meteo *accepts* the field (HTTP 200, unit reported as
> `"undefined"`) and returns **null for every hour** — 72/72 nulls at Kakinada. A rule
> keyed to it can never fire while looking perfectly wired, which is the worst failure
> mode in a safety system.
>
> **Use instead:** `cape` (convective available potential energy, J/kg — the standard
> measure of thunderstorm potential; >1000 storm-capable, >2500 strongly unstable),
> plus `precipitation_probability` and `weather_code` (WMO 95/96/99 = thunderstorm).
> All three return real values. Guarded by `test_weather_does_not_request_the_dead_thunderstorm_field`.

CAPE is our **proxy** for lightning risk — see the honesty note below.

### Sample offshore, not at the harbour wall

**Verified 27 Aug 2026:** geocoding "Kakinada" gives 16.96, 82.24 — a harbour cell reading
a peak of **0.56 m**, while points 25 km offshore in the same fishing ground read **1.4 m**.
The 1.5 m caution threshold sits between them, so sampling at the coast would answer GO for
a sea state that deserves CAUTION.

`adapters/open_meteo_marine.py` therefore samples the point **plus a ring of eight bearings**
at 25 km (one HTTP request — the endpoint takes comma-separated coordinates) and reports the
**worst** valid reading, recording which point it came from in `Evidence.location`.

Land cells are excluded by testing for an all-null series: the marine endpoint returns
HTTP 200 with nulls over land rather than an error, so **the null test is the land test**.

## Open-Meteo Geocoding

```
GET https://geocoding-api.open-meteo.com/v1/search?name=Kakinada&count=5&language=en
```

Resolves "near Vizag" to coordinates when the device gives no GPS. **Cache aggressively** —
place names don't move. Bias results to India (`country_code=IN`) and prefer coastal matches.

## Copernicus Marine — gridded ocean data

```bash
pip install copernicusmarine
copernicusmarine login          # free account: data.marine.copernicus.eu/register
```

Datasets:

| Product ID (cite this) | **Dataset ID** (download this) | Gives |
|---|---|---|
| `SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001` | `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` | SST, 0.05°, **kelvin** |
| `GLOBAL_ANALYSISFORECAST_BGC_001_028` | `cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m` | Chlorophyll-a (`chl`), 0.25°, mg/m³ |

> ### ⚠️ Product ID ≠ Dataset ID
> `copernicusmarine subset` needs the **dataset** id. Passing the product id fails with
> *"Please check that the dataset exists"* — the scaffold had this wrong. A product
> contains many datasets: the BGC product ships 15, of which only the `pft` (plankton
> functional types) one carries `chl`. List them with:
>
> ```bash
> copernicusmarine describe --product-id GLOBAL_ANALYSISFORECAST_BGC_001_028
> ```
>
> SST arrives in **kelvin** (`analysed_sst`, ~296–304 K); `adapters/copernicus.py`
> converts by magnitude rather than trusting the units attribute, which some product
> versions omit.

### PFZ proxy thresholds — tuned 2 Sep 2026

Measured on the real subsets over 14–20°N, 80–86°E (late SW monsoon), ocean cells only:

| Gradient percentile | p50 | p75 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| °C/km (native 0.05°) | 0.0077 | 0.0119 | 0.0172 | 0.0219 | 0.0332 | 0.068 |

- **Front threshold 0.015 °C/km** ≈ the p90 — the usual operational definition of a front
  as the top ~10% of the local gradient field. Absolute rather than a live percentile on
  purpose: a percentile would *always* find "fronts", so the system could never honestly
  report that there are none.
- **Chlorophyll 0.25 mg/m³** is weakly selective here — 72% of ocean cells clear it,
  because monsoon river discharge makes the whole basin productive. The gradient does the
  real discriminating; the chlorophyll floor just stops barren water qualifying on a front alone.
- **Minimum zone 2000 km²** — stored as an area, not a cell count, so it means the same
  thing regardless of which product's grid it runs on.

**Compute the gradient at native SST resolution, then resample.** Regridding SST down to
the chlorophyll grid first loses **55% of p95 front strength** (measured) — a 28 km cell
cannot represent a 15 km front, and fronts are the entire basis of the method.

> **Do not stream NetCDF at request time.** It is slow and it will fail on conference Wi-Fi.
> Pre-download a Bay-of-Bengal + Arabian-Sea subset into `data/copernicus/` with
> [`scripts/fetch_copernicus_subset.py`](../scripts/fetch_copernicus_subset.py) and read it with `xarray`.

Suggested bounding box — Indian EEZ plus margin:

```
lon 65 … 95 °E     lat 5 … 25 °N
```

Feeds golden queries #1 (PFZ proxy) and #4 (productivity decline trend).
**Attribution required:** `Generated using E.U. Copernicus Marine Service Information`.

## INCOIS PFZ Advisory

Entry points:

- `https://incois.gov.in/MarineFisheries/PfzAdvisory`
- `https://incois.gov.in/MarineFisheries/TextDataHome` — the text advisories
- `https://incois.gov.in/geoportal/MFASPFZ` — the WebGIS layers

14 coastal sectors, roughly 1223 nodes. Advisories are issued **daily** (weather permitting)
and are not issued during the fishing ban period — handle the empty case, don't crash on it.

- **Cache TTL: 24 hours**, and keep the last good response indefinitely as a fallback.
- Parse with `beautifulsoup4` + `lxml`. Expect the layout to change without notice; make the
  parser fail loudly into the fallback rather than silently returning empty zones.

Also from INCOIS, lower priority: **Ocean State Forecast** and **Marine Heat Wave**
advisories — useful supporting evidence for query #4.

## Cyclones — resolved as a declared proxy (P4)

### The scrape is not possible, and that was verified rather than assumed

Every documented IMD entry point returns HTTP 404 (checked 3 Sep 2026):

```
mausam.imd.gov.in/api/cyclone_api.php                       404
rsmcnewdelhi.imd.gov.in/api/cyclone                         404
mausam.imd.gov.in/responsive/rss/allIndiaWeatherReport.xml  404
internal.imd.gov.in/pages/cyclone_mainpage.php              404
```

That is the same conclusion the team reached for INCOIS, and the same answer follows:
build a proxy from a source that *does* respond, and label it as a proxy everywhere.

### What `imd_bulletins.py` actually does

Samples mean-sea-level pressure and sustained 10 m wind on a 250 km ring around the
location and classifies the result against **IMD's own published wind bands** for the north
Indian Ocean:

| Band | Sustained wind |
|------|----------------|
| Low pressure area | < 31 km/h |
| Depression | 31–49 km/h |
| Deep depression | 50–61 km/h |
| Cyclonic storm | 62–88 km/h |
| Severe cyclonic storm | 89–117 km/h |
| Very severe and above | ≥ 118 km/h |

A system is reported only when **both** tests pass: gale-force sustained wind *and* a
pressure centre below 1000 hPa. Wind alone is a squall line; low pressure alone is the
monsoon trough. Requiring both is what stops this crying cyclone every July.

Only a **cyclonic storm or worse** sets `cyclone_bulletin_active`, the flag that raises the
CYCLONE alert and caps the safety verdict. A depression is named and left as context.

> ## This is not a cyclone warning.
> It is a model field, classified. IMD issues warnings; ORCA does not, and every evidence
> `source` string says so. When IMD has a bulletin out, IMD's bulletin is the authority and
> this proxy is at best a corroboration. **Say that out loud in the demo.**

The check always returns evidence — including an explicit `cyclone_bulletin_active: false`
— because absence of a warning is not evidence of safety, and the trace should show that
the check ran. An empty list would be indistinguishable from the check never happening.

### Lightning stays CAPE

Unchanged from P2 and still correct: the lightning signal is Open-Meteo's CAPE, which says
the atmosphere is capable of storms. It is not an observed strike. `open_meteo_weather.py`
documents why `thunderstorm_probability` could not be used (it returns null for every hour).

---

## Tides — modelled sea level (P4)

Open-Meteo Marine publishes `sea_level_height_msl`, the modelled sea-surface height above
mean sea level. That is the tidal signal, and it arrives on the **same request** the sea
state already makes, so it costs nothing extra and cannot disagree with the rest of the
forecast.

Turning points are found by sign change in the hourly difference rather than by harmonic
analysis. At hourly resolution that lands within about 30 minutes of true slack water,
which is the honest precision to claim from a one-hour series — a boat crossing a harbour
bar needs "high water is around 06:00", not a second-accurate prediction.

**It is not a port tide table.** The evidence source says so, and so does the tide card in
the frontend. For a bar crossing, use the official table.

---

## Thermal fronts — computed from SST (P4)

`services/fronts.py`. Classical edge detection on the SST field, which is what "front
detection" means in an oceanographic context:

1. NaN-aware 3×3 box smoothing, to kill single-pixel satellite noise
2. gradient magnitude in °C/km, longitude spacing scaled by cos(latitude)
3. threshold at `pfz_proxy.SST_FRONT_GRADIENT_THRESHOLD_C_PER_KM` — the top ~10% of the
   local gradient field, the operational definition of a front
4. connected-component labelling into distinct features
5. a **shape heuristic**: compact features are reported as `eddy_like`, elongated ones as
   `front`

Step 5 is not a dynamical eddy detection — that needs sea-surface height and geostrophic
velocity, which the SST subset does not carry. The feature type is therefore `eddy_like`,
never `eddy`, and each feature's `method` property records exactly what was done.

Features below `MIN_FRONT_AREA_KM2` (800 km²) are discarded. That floor is set by what the
smoother leaves behind: a 3×3 boxcar spreads one bad pixel across a 5×5 gradient
neighbourhood, about a dozen cells of which clear the threshold — roughly 350 km² on the
0.05° grid. One hot pixel is not an ocean front.

## Marine Regions — EEZ and IMBL

**No manual download needed.** Marine Regions runs a public GeoServer WFS, and
`scripts/download_geojson.py` pulls both layers straight from it:

```
https://geo.vliz.be/geoserver/MarineRegions/wfs
  MarineRegions:eez              CQL: sovereign1='India'
  MarineRegions:eez_boundaries   CQL: sovereign1='India' OR sovereign2='India'
```

Field names are **lowercase** (`sovereign1`, not `SOVEREIGN1`) — check with
`DescribeFeatureType` if a filter returns "Illegal property name".

India's EEZ is **two MultiPolygons** — mainland (1,659,500 km²) and Andaman & Nicobar
(664,448 km²). Keeping only the largest would put every island query outside Indian waters.

### Not every boundary line is an IMBL

The WFS returns **32** line features for India. Only **17** go into `india_imbl.geojson`:

| `line_type` | Keep? | Why |
|---|---|---|
| Treaty, Median line, Court ruling | ✅ | Agreed boundaries with a neighbouring state — the lines that get boats detained |
| 200 NM | ❌ | Outer EEZ edge facing the high seas; leaving it is lawful, and `inside_eez` covers it |
| **Straight baseline** | ❌ | The coastal reference line the territorial sea is measured *from*. It hugs the shore, so including it would place a "boundary" a few km from every harbour and fire a proximity alert on essentially every query |
| Connection line | ❌ | Cartographic joins, not boundaries |

Powers golden query #3: point-in-polygon plus **distance to the International Maritime
Boundary Line**, which is the alert fishermen actually need — crossing the IMBL is what gets
boats detained.

### What counts as a breach — two bugs worth not repeating

Found against real data on 2 Sep 2026:

1. **`inside_eez == False` is NOT a breach.** It fired at Kakinada (the EEZ polygon covers
   water, so a quayside point is outside it) and in lawful international waters. Only
   *inside an MPA* or *across an IMBL* is a breach. An alert that cries wolf at the
   harbour wall trains the user to ignore the one that matters.
2. **The proximity warning is deterministic and the LLM may only translate it.** Asked to
   "rewrite naturally" a result 2.3 km from the Sri Lanka boundary, the model deleted the
   warning entirely — and in an earlier run added *"Continue your current course"*, advice
   nobody computed, in exactly the situation where boats get detained. Same principle as
   the safety verdict: the model phrases, it never decides. Guarded by
   `tests/test_geofence.py`.

## Protected Planet (WDPA)

Marine Protected Areas polygons from `protectedplanet.net`, filtered to Indian waters.
Drives "avoid this zone" alerts. WDPA requires attribution and prohibits redistribution —
so it stays gitignored in `data/geojson/`, downloaded per-machine.

---

## Adapter conventions

Every adapter follows the same shape — see [`adapters/base.py`](../backend/app/adapters/base.py):

1. **Returns `Evidence` objects**, not raw JSON. The `source` string is human-readable and
   names the model where relevant: `"Open-Meteo Marine (ICON-Wave)"`.
2. **Cascade: live → cache → mock.** Never raise past the caller on a network failure —
   return the best available rung and mark which one it used.
3. **Declares its attribution string** as a module constant, collected into
   `OrcaResponse.attribution`.
4. **Has a documented cache TTL** matching how often the upstream actually updates.
5. **Is independently runnable** as `python -m app.adapters.open_meteo_marine` for spiking.

## Cache and demo safety

`services/cache.py` — SQLite or flat JSON under `data/cache/`, keyed by
`(adapter, params_hash)`, TTL per adapter.

`data/mock/` holds canned-but-**real** responses for the four golden queries, captured from
live calls during rehearsal. `ORCA_USE_MOCK_DATA=true` serves them.

**Demo rule: never demo on a cold live API call.** Warm the cache before you present. The
response carries `used_mock_data` so the UI can show a small badge — we degrade honestly,
we don't fake.

---

## Attribution strings

Collected in `OrcaResponse.attribution` and rendered in the app footer and the deck:

```
Weather data by Open-Meteo.com (CC BY 4.0)
Generated using E.U. Copernicus Marine Service Information
Potential Fishing Zone advisories © INCOIS, Ministry of Earth Sciences, Government of India
Maritime boundaries © Flanders Marine Institute (Marine Regions)
Protected area data © UNEP-WCMC and IUCN, Protected Planet (WDPA)
```
