/**
 * Map layer toggles.
 *
 * Owner: D · Phase: P2 · Polished P3
 *
 * The agent picks sensible defaults per answer; this lets the user explore beyond them.
 * Keep the default set small — two or three layers, not all ten. A map with everything on
 * communicates nothing.
 */

import { useState } from "react";

import type { MapLayer } from "@/types/orca";

interface Props {
  active: MapLayer[];
  onToggle: (layer: MapLayer) => void;
}

interface LayerInfo {
  layer: MapLayer;
  label: string;
  /** Swatch colour, matching MapView's LAYER_STYLE so the legend actually means something. */
  color: string;
}

const GROUPS: { name: string; layers: LayerInfo[] }[] = [
  {
    name: "Zones",
    layers: [
      { layer: "pfz_zones", label: "Fishing zones", color: "#22c55e" },
      { layer: "eez_boundary", label: "EEZ", color: "#38bdf8" },
      { layer: "imbl_line", label: "IMBL", color: "#f43f5e" },
      { layer: "mpa_zones", label: "Protected areas", color: "#a78bfa" },
    ],
  },
  {
    name: "Conditions",
    layers: [
      { layer: "chlorophyll_heatmap", label: "Chlorophyll", color: "#4ade80" },
      { layer: "sst_heatmap", label: "Sea temp.", color: "#fb923c" },
    ],
  },
];

export default function LayerToggles({ active, onToggle }: Props) {
  // Collapsed by default — the map is the point, not the controls.
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute right-2 top-2 z-[1000] w-44">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-xl border border-slate-300/70 bg-white/90 px-2.5 py-1.5 text-xs font-bold text-ocean-800 shadow-lg backdrop-blur-md transition-all hover:bg-white dark:border-white/10 dark:bg-abyss-900/90 dark:text-ocean-200 dark:hover:bg-abyss-800"
      >
        <span aria-hidden="true">🗺</span>
        Layers
        {active.length > 0 && (
          <span className="ml-auto rounded-full bg-ocean-500 px-1.5 text-[10px] font-black text-white">
            {active.length}
          </span>
        )}
        <span
          aria-hidden="true"
          className={`text-[8px] transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▶
        </span>
      </button>

      {open && (
        <div className="mt-1.5 animate-slide-in-right rounded-xl border border-slate-300/70 bg-white/95 p-2.5 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-abyss-900/95">
          {GROUPS.map((group) => (
            <fieldset key={group.name} className="mb-2.5 last:mb-0">
              <legend className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                {group.name}
              </legend>
              {group.layers.map(({ layer, label, color }) => {
                const isOn = active.includes(layer);
                return (
                  <label
                    key={layer}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-[11px] font-medium transition-colors ${
                      isOn
                        ? "bg-ocean-50 text-ocean-800 dark:bg-ocean-500/15 dark:text-ocean-200"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => onToggle(layer)}
                      className="h-3 w-3 accent-ocean-500"
                    />
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                  </label>
                );
              })}
            </fieldset>
          ))}

          <p className="mt-1 border-t border-slate-200 pt-1.5 text-[9px] leading-tight text-slate-400 dark:border-white/10">
            Heatmaps need the Copernicus subset; boundaries need the GeoJSON download.
          </p>
        </div>
      )}
    </div>
  );
}
