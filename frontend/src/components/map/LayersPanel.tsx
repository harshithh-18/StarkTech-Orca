/**
 * The Layers view — Maritime Chart Room & Ocean Data Layers.
 */

import { useState } from "react";

import Icon, { type IconName } from "@/components/common/Icon";
import { BASEMAPS, LAYERS, RAMPS, type BasemapId } from "@/components/map/mapConfig";
import type { MapLayer } from "@/types/orca";

interface Props {
  fromAnswer: MapLayer[];
  manual: MapLayer[];
  onToggle: (layer: MapLayer) => void;
  basemap: BasemapId;
  onBasemapChange: (basemap: BasemapId) => void;
  onQueryLayer?: (query: string) => void;
}

const CATEGORIES: {
  id: "all" | "bio" | "ocean" | "borders" | "hazards";
  label: string;
  icon: IconName;
  layers?: MapLayer[];
}[] = [
  { id: "all", label: "All Layers", icon: "layers" },
  {
    id: "bio",
    label: "Fisheries & Bio",
    icon: "fish",
    layers: ["pfz_zones", "chlorophyll_heatmap", "ocean_fronts"],
  },
  {
    id: "ocean",
    label: "Sea State & SST",
    icon: "wave",
    layers: ["wave_heatmap", "sst_heatmap"],
  },
  {
    id: "borders",
    label: "Boundaries",
    icon: "boundary",
    layers: ["eez_boundary", "imbl_line", "mpa_zones"],
  },
  {
    id: "hazards",
    label: "Hazards & Route",
    icon: "storm",
    layers: ["hazard_overlay", "route_line"],
  },
];

const LAYER_PROMPTS: Partial<Record<MapLayer, string>> = {
  pfz_zones: "Where is the nearest Potential Fishing Zone today?",
  chlorophyll_heatmap: "What is the chlorophyll concentration and productivity in this area?",
  ocean_fronts: "Are there any thermal fronts or eddies near my coordinates?",
  wave_heatmap: "What is the wave height and sea state swell forecast for the next 48 hours?",
  sst_heatmap: "What is the sea surface temperature gradient across this coast?",
  eez_boundary: "Am I approaching India's Exclusive Economic Zone limit?",
  imbl_line: "How far am I from the International Maritime Boundary Line (IMBL)?",
  mpa_zones: "Are there any Marine Protected Areas or restricted reserves nearby?",
  hazard_overlay: "Are there any cyclone or convective lightning hazards active here?",
  route_line: "What is the safest passage route from Kakinada to Chennai?",
};

function Swatch({ layer }: { layer: MapLayer }) {
  const meta = LAYERS[layer];
  const ramp = RAMPS[layer];

  if (ramp) {
    return (
      <span
        aria-hidden="true"
        className="h-3.5 w-6 shrink-0 rounded-sm shadow-sm"
        style={{ background: `linear-gradient(90deg, ${ramp.join(", ")})` }}
      />
    );
  }
  if (meta?.shape === "line") {
    return (
      <span aria-hidden="true" className="grid h-3.5 w-6 shrink-0 place-items-center">
        <span className="h-[3px] w-full rounded-full" style={{ background: meta.swatch }} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-6 shrink-0 rounded-sm border shadow-sm"
      style={{ background: `${meta?.swatch ?? "#0891b2"}55`, borderColor: meta?.swatch ?? "#0891b2" }}
    />
  );
}

export default function LayersPanel({
  fromAnswer,
  manual,
  onToggle,
  basemap,
  onBasemapChange,
  onQueryLayer,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<"all" | "bio" | "ocean" | "borders" | "hazards">("all");
  const answerDataLayers = fromAnswer.filter((layer) => layer !== "user_pin");

  const explorableLayers = (Object.keys(LAYERS) as MapLayer[]).filter((layer) => {
    if (!LAYERS[layer].explorable) return false;
    if (activeCategory === "all") return true;
    const cat = CATEGORIES.find((c) => c.id === activeCategory);
    return cat?.layers?.includes(layer) ?? true;
  });

  return (
    <div className="flex h-full min-h-0 flex-col bg-white/50 dark:bg-abyss-900/50 backdrop-blur-sm">
      {/* Header */}
      <div className="shrink-0 border-b border-sky-100 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-1.5">
          <Icon name="layers" size={16} className="text-ocean-600 dark:text-cyan-300" />
          <h2 className="text-[14.5px] font-bold leading-tight text-slate-900 dark:text-white">
            Maritime Charts & Layer Room
          </h2>
        </div>
        <p className="text-[11px] muted">
          Satellite telemetry, biological fronts, hydrodynamics & maritime security borders.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3.5">
        {/* ── Basemap Selector ────────────────────────────────────────── */}
        <div>
          <p className="eyebrow mb-1.5">Nautical Basemap</p>
          <div className="flex gap-1.5">
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <button
                key={id}
                type="button"
                        className={`flex-1 rounded-xl border px-3 py-2 text-[12px] font-bold transition-all ${
                  basemap === id
                    ? "border border-emerald-400/50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-500/20"
                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400/40 hover:bg-emerald-500/[0.04] dark:border-white/10 dark:bg-abyss-850 dark:text-slate-300 dark:hover:bg-white/5"
                }`}
              >
                {BASEMAPS[id].label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Active Layers From Current Answer ───────────────────────── */}
        {answerDataLayers.length > 0 && (
          <div>
            <p className="eyebrow mb-1.5 flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <Icon name="check" size={12} />
              Active in Current Intelligence Answer
            </p>
            <ul className="space-y-1.5">
              {answerDataLayers.map((layer) => {
                const meta = LAYERS[layer];
                if (!meta) return null;
                return (
                  <li
                    key={layer}
                    className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2.5 shadow-sm"
                  >
                    <Swatch layer={layer} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-bold text-slate-900 dark:text-slate-100">
                        {meta.label}
                      </span>
                      <span className="block text-[11px] leading-snug muted">
                        {meta.description}
                      </span>
                    </span>
                    <span className="chip bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] py-0.5">
                      Answer Layer
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ── Category Filter Tabs ────────────────────────────────────── */}
        <div>
          <p className="eyebrow mb-1.5">Explore Chart Layers</p>
          <div className="flex flex-wrap gap-1 border-b border-sky-100 pb-2 dark:border-white/10">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                  activeCategory === cat.id
                    ? "border border-emerald-500/60 bg-emerald-600 text-white shadow-sm shadow-emerald-500/20"
                    : "text-slate-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Explorable Layers ───────────────────────────────────────── */}
        <div>
          <ul className="space-y-1.5">
            {explorableLayers
              .filter((layer) => !fromAnswer.includes(layer))
              .map((layer) => {
                const meta = LAYERS[layer];
                const on = manual.includes(layer);
                const prompt = LAYER_PROMPTS[layer];

                return (
                  <li key={layer} className="card p-2.5 transition-all hover:border-emerald-400/50">
                    <div className="flex items-start gap-2.5">
                      <Swatch layer={layer} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="block text-[12.5px] font-bold text-slate-900 dark:text-slate-100">
                            {meta.label}
                          </span>

                          {/* Toggle switch */}
                          <button
                            type="button"
                            onClick={() => onToggle(layer)}
                            aria-pressed={on}
                            title={on ? "Deactivate on map" : "Activate on map"}
                            className={`grid h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                              on ? "bg-emerald-600 dark:bg-emerald-500" : "bg-slate-200 dark:bg-white/20"
                            }`}
                          >
                            <span
                              className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                on ? "translate-x-4" : ""
                              }`}
                            />
                          </button>
                        </div>

                        <p className="mt-0.5 text-[11px] leading-snug muted">
                          {meta.description}
                        </p>

                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-sky-100/60 dark:border-white/5">
                          <span className="font-mono text-[9.5px] text-ocean-700 dark:text-cyan-300">
                            {meta.source}
                          </span>

                          {prompt && onQueryLayer && (
                            <button
                              type="button"
                              onClick={() => onQueryLayer(prompt)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold text-ocean-700 hover:bg-ocean-50 dark:text-cyan-300 dark:hover:bg-white/5 transition-colors"
                            >
                              <Icon name="chat" size={11} />
                              Ask in Console
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>
    </div>
  );
}
