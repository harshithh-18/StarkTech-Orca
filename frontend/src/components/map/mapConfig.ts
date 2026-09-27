/**
 * Map layer catalogue — style, legend copy and provenance, in one place.
 *
 * Owner: D · Phase: P4
 *
 * The map, the layer control and the legend all need the same three facts about a layer:
 * what it looks like, what it means, and where it came from. Keeping them in three
 * components is how a legend ends up describing a colour the map stopped using.
 */

import type { PathOptions } from "leaflet";

import type { IconName } from "@/components/common/Icon";
import type { MapLayer } from "@/types/orca";

export interface LayerMeta {
  label: string;
  /** One line, plain language. Rendered in the layer control and the legend. */
  description: string;
  /**
   * The official name, when the plain one replaced an acronym.
   *
   * Shown once, in muted type, in the Layers list only. A fisherman never needs to read
   * "IMBL"; a port authority or a researcher will go looking for it, and a platform that
   * refuses to print the real term is as unhelpful as one that prints nothing else.
   */
  term?: string;
  icon: IconName;
  /** The colour the legend swatch shows. Must match `style` below. */
  swatch: string;
  /** How the swatch is drawn, so a line layer doesn't get a filled square. */
  shape: "fill" | "line" | "dots";
  source: string;
  /** Vector layers only. Gridded layers are drawn as coloured points instead. */
  style?: PathOptions;
  /** Layers the user may switch on themselves, rather than only the answer switching on. */
  explorable: boolean;
  /** Needs a location to fetch. */
  needsLocation: boolean;
}

export const LAYERS: Record<MapLayer, LayerMeta> = {
  user_pin: {
    label: "Your position",
    description: "The point every answer is about.",
    icon: "gps",
    swatch: "#0891b2",
    shape: "dots",
    source: "Chosen in the header",
    explorable: false,
    needsLocation: true,
  },
  pfz_zones: {
    label: "Fishing zones",
    description: "Productive water: high chlorophyll on a temperature front.",
    icon: "fish",
    swatch: "#22c55e",
    shape: "fill",
    source: "Copernicus Marine, computed proxy (INCOIS advisory when available)",
    style: { color: "#16a34a", weight: 1.5, fillColor: "#22c55e", fillOpacity: 0.3 },
    explorable: true,
    needsLocation: true,
  },
  ocean_fronts: {
    label: "Thermal fronts",
    description: "Where two water masses meet — what makes a fishing zone a fishing zone.",
    icon: "front",
    swatch: "#f97316",
    shape: "dots",
    source: "Copernicus Marine SST, computed front detection",
    explorable: true,
    needsLocation: true,
  },
  eez_boundary: {
    label: "India's own waters",
    description:
      "The sea India controls, out to 200 nautical miles. Fishing outside it is not illegal.",
    term: "Exclusive Economic Zone (EEZ)",
    icon: "boundary",
    swatch: "#38bdf8",
    shape: "line",
    source: "Flanders Marine Institute (Marine Regions)",
    style: { color: "#38bdf8", weight: 1.5, fillOpacity: 0.05, dashArray: "6 4" },
    explorable: true,
    needsLocation: true,
  },
  imbl_line: {
    label: "Sea border with another country",
    description:
      "Where India's waters meet a neighbour's. Crossing it without permission gets boats seized.",
    term: "International Maritime Boundary Line (IMBL)",
    icon: "boundary",
    swatch: "#f43f5e",
    shape: "line",
    source: "Flanders Marine Institute (Marine Regions)",
    style: { color: "#f43f5e", weight: 3, fillOpacity: 0 },
    explorable: true,
    needsLocation: true,
  },
  mpa_zones: {
    label: "Protected marine areas",
    description:
      "Conservation areas for marine life. Fishing here may be restricted or banned.",
    term: "Marine Protected Area (MPA)",
    icon: "shield",
    swatch: "#a78bfa",
    shape: "fill",
    source: "Protected Planet (WDPA)",
    style: { color: "#8b5cf6", weight: 1.5, fillColor: "#a78bfa", fillOpacity: 0.18 },
    explorable: true,
    needsLocation: true,
  },
  wave_heatmap: {
    label: "Wave field",
    description: "Significant wave height across the area, at the forecast hour.",
    icon: "wave",
    swatch: "#0ea5e9",
    shape: "dots",
    source: "Open-Meteo Marine",
    explorable: true,
    needsLocation: true,
  },
  sst_heatmap: {
    label: "Sea temperature",
    description: "Sea-surface temperature. Warm and cool sides of a front.",
    icon: "temperature",
    swatch: "#fb923c",
    shape: "dots",
    source: "Copernicus Marine (OSTIA)",
    explorable: true,
    needsLocation: true,
  },
  chlorophyll_heatmap: {
    label: "Chlorophyll",
    description: "Ocean colour: how much plankton the water is carrying.",
    icon: "chart",
    swatch: "#34d399",
    shape: "dots",
    source: "Copernicus Marine (ocean colour)",
    explorable: true,
    needsLocation: true,
  },
  hazard_overlay: {
    label: "Hazard cells",
    description: "Where waves exceed the small-craft no-go limit.",
    icon: "alert",
    swatch: "#e11d48",
    shape: "dots",
    source: "Open-Meteo Marine, against the ORCA thresholds",
    explorable: true,
    needsLocation: true,
  },
  route_line: {
    label: "Planned route",
    description: "The least-risk path, costed against the forecast at arrival time.",
    icon: "route",
    swatch: "#f59e0b",
    shape: "line",
    source: "Computed by ORCA over the Open-Meteo Marine wave grid",
    style: {
      color: "#f59e0b",
      weight: 3.5,
      fillOpacity: 0,
      dashArray: "1 7",
      lineCap: "round",
    },
    explorable: false,
    needsLocation: false,
  },
};

/** Served as GeoJSON polygons or lines and drawn with `style`. */
export const VECTOR_LAYERS: MapLayer[] = [
  "pfz_zones",
  "eez_boundary",
  "imbl_line",
  "mpa_zones",
  "route_line",
];

/** Gridded point fields, drawn as a coloured scatter with a ramp. */
export const GRID_LAYERS: MapLayer[] = [
  "chlorophyll_heatmap",
  "sst_heatmap",
  "wave_heatmap",
  "hazard_overlay",
];

/**
 * Colour ramps, low → high.
 *
 * Sequential and perceptually ordered rather than a rainbow: a rainbow ramp has no
 * intrinsic order, so a reader has to consult the legend for every cell. Wave and hazard
 * ramps run cool → hot because higher is worse; chlorophyll runs pale → green because
 * higher is *better*, and reusing the hazard ramp for it would code productive water as
 * dangerous.
 */
export const RAMPS: Record<string, string[]> = {
  chlorophyll_heatmap: ["#f0fdf4", "#bbf7d0", "#4ade80", "#16a34a", "#14532d"],
  sst_heatmap: ["#2c7bb6", "#abd9e9", "#ffffbf", "#fdae61", "#d7191c"],
  wave_heatmap: ["#e0f2fe", "#7dd3fc", "#0ea5e9", "#f59e0b", "#e11d48"],
  hazard_overlay: ["#fecdd3", "#fb7185", "#e11d48", "#be123c", "#881337"],
};

export function rampColor(layer: MapLayer, value: number, min: number, max: number): string {
  const ramp = RAMPS[layer] ?? RAMPS.chlorophyll_heatmap;
  if (!Number.isFinite(value) || max <= min) return ramp[0];
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
}

/**
 * Basemaps. Both are free and need no key; ocean is the default for obvious reasons.
 *
 * The ocean basemap ships bathymetry with **no place labels** — Esri publishes those as a
 * separate reference tile set, which `reference` names. A chart with no ports on it is a
 * texture, not a map.
 *
 * ## Dark mode needs two different treatments, not one
 *
 * Both tile sets are drawn for a light page, so both need adjusting — but not the same
 * way, and getting this wrong is very visible:
 *
 *   - **Street (OSM)** inverts. Land is pale, water is pale blue, and inverting with a
 *     185° hue rotation lands both in the right place.
 *   - **Ocean** must NOT invert. Its bathymetry gets *darker* with depth, so inverting
 *     turns the deep Bay of Bengal white — the brightest thing on the screen is then the
 *     open ocean, in a marine application, in dark mode. Dimming it instead keeps deep
 *     water deep and darkens the land.
 *   - **Ocean's labels** in dark mode reuse Esri's own reference tiles, inverted in CSS
 *     (see `.orca-reference-dark`). Esri publishes dark text with a pale halo; inverting it
 *     yields light text with a dark halo, which reads cleanly over the dimmed base. We used
 *     to load CARTO's `dark_only_labels` here instead, but CARTO retired its keyless
 *     basemaps and now stamps every tile with an "API KEY REQUIRED" watermark — so a
 *     keyless, watermark-free Esri layer is strictly better, and keeps ORCA true to its
 *     "runs with no API keys" promise.
 */

// Esri's ocean place-name labels — keyless, used in both themes (inverted in CSS for dark).
const ESRI_OCEAN_REFERENCE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}";

export const BASEMAPS = {
  ocean: {
    label: "Ocean",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    reference: ESRI_OCEAN_REFERENCE,
    // Same keyless Esri labels; dark mode inverts them via the `orca-reference-dark` class.
    darkReference: ESRI_OCEAN_REFERENCE,
    attribution:
      'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — GEBCO, NOAA',
    maxZoom: 13,
    darkBase: "orca-dim",
  },
  street: {
    label: "Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    reference: null,
    darkReference: null,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    darkBase: "orca-invert",
  },
} as const;

export type BasemapId = keyof typeof BASEMAPS;
