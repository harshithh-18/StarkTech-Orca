# Data Sources

Owner: **B** (adapters) with **E** (geospatial + PFZ proxy).

Every source gets a thin adapter in [`backend/app/adapters/`](../backend/app/adapters/) exposing a
clean internal interface. Agents call adapters; agents never call `httpx` directly. This is
what makes the INCOIS fallback and demo-day mocking possible without touching agent code.

---

## ⚠️ The one real risk: INCOIS

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
| Open-Meteo Marine | Wave height/period/direction, swell, SST, currents | none | `open_meteo_marine.py` |
| Open-Meteo Weather | Wind, precip, temp, weather codes, thunderstorm probability | none | `open_meteo_weather.py` |
| Open-Meteo Geocoding | Place name → lat/lon | none | `open_meteo_geocoding.py` |
| Copernicus Marine | Gridded chlorophyll-a + SST (NetCDF) | free account | `copernicus.py` |
| INCOIS PFZ | Official Potential Fishing Zones | none (scrape) | `incois_pfz.py` |
| IMD / RSMC | Cyclone + severe weather bulletins | none (scrape) | `imd_bulletins.py` |
| Marine Regions EEZ | India EEZ + IMBL polygons | download | `geojson_store.py` |
| Protected Planet (WDPA) | Marine Protected Areas | download | `geojson_store.py` |

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
            weather_code,thunderstorm_probability
    &forecast_days=7&timezone=auto
```

Wind and gusts drive the safety verdict alongside wave height.
`thunderstorm_probability` is our **proxy** for lightning risk — see the honesty note below.

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

| Product | Dataset ID | Gives |
|---------|-----------|-------|
| OSTIA SST | `SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001` | Sea-surface temperature (fronts) |
| Global BGC | `GLOBAL_ANALYSISFORECAST_BGC_001_028` | Chlorophyll-a (productivity) |

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

## IMD / RSMC cyclone bulletins

`https://mausam.imd.gov.in/` and the RSMC New Delhi bulletins.

Cyclone and lightning data are genuinely hard to obtain cleanly. Our approach: IMD bulletins
where parseable, plus Open-Meteo's `thunderstorm_probability` as a proxy.

> **Say this out loud in the demo.** "Lightning risk here is a modelled proxy, not an IMD
> lightning observation." Judges respect a team that knows the limits of its own data far
> more than one that overclaims. Surface it in the evidence `source` string too.

## Marine Regions — EEZ and IMBL

Download the EEZ v11/v12 GeoJSON from `marineregions.org`, filter to India, store in
`data/geojson/`. Loaded once at startup into shapely geometries by `geojson_store.py`.

Powers golden query #3: point-in-polygon plus **distance to the International Maritime
Boundary Line**, which is the alert fishermen actually need — crossing the IMBL is what gets
boats detained.

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
