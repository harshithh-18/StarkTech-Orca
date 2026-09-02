/**
 * Map layer toggles.
 *
 * Owner: D · Phase: P2
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
      { layer: "pfz_zones", label: "Fishing zones", color: "#15803d" },
      { layer: "eez_boundary", label: "EEZ", color: "#2563eb" },
      { layer: "imbl_line", label: "IMBL", color: "#b91c1c" },
      { layer: "mpa_zones", label: "Protected areas", color: "#7c3aed" },
    ],
  },
  {
    name: "Conditions",
    layers: [
      { layer: "wave_heatmap", label: "Waves", color: "#0891b2" },
      { layer: "sst_heatmap", label: "Sea temp.", color: "#ea580c" },
      { layer: "chlorophyll_heatmap", label: "Chlorophyll", color: "#65a30d" },
    ],
  },
];

export default function LayerToggles({ active, onToggle }: Props) {
  // Collapsed by default on small screens — the map is the point, not the controls.
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute right-2 top-2 z-[1000] w-44">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="w-full rounded-md border border-slate-300 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-ocean-deep shadow hover:bg-white"
      >
        Layers {open ? "▾" : "▸"}
        {!open && active.length > 0 && (
          <span className="ml-1 text-slate-400">({active.length})</span>
        )}
      </button>

      {open && (
        <div className="mt-1 rounded-md border border-slate-300 bg-white/95 p-2 shadow">
          {GROUPS.map((group) => (
            <fieldset key={group.name} className="mb-2 last:mb-0">
              <legend className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {group.name}
              </legend>
              {group.layers.map(({ layer, label, color }) => (
                <label
                  key={layer}
                  className="flex cursor-pointer items-center gap-1.5 py-0.5 text-xs text-ocean-deep"
                >
                  <input
                    type="checkbox"
                    checked={active.includes(layer)}
                    onChange={() => onToggle(layer)}
                    className="h-3 w-3 accent-ocean-mid"
                  />
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
