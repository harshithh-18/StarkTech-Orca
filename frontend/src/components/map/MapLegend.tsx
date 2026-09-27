/**
 * Legend for currently rendered chart layers.
 */

import { useState } from "react";

import Icon from "@/components/common/Icon";
import { LAYERS, RAMPS } from "@/components/map/mapConfig";
import type { MapLayer } from "@/types/orca";

interface Props {
  layers: MapLayer[];
}

export default function MapLegend({ layers }: Props) {
  const [open, setOpen] = useState(true);

  const shown = layers.filter((layer) => layer !== "user_pin" && LAYERS[layer]);
  if (shown.length === 0) return null;

  return (
    <div className="absolute right-3 top-3 z-[400] max-w-[16rem]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-sky-200/90 bg-white/95 px-3 py-2 text-[12px] font-bold text-slate-800 shadow-md backdrop-blur-md transition-all hover:border-ocean-400 dark:border-cyan-500/20 dark:bg-abyss-900/95 dark:text-slate-100"
      >
        <Icon name="layers" size={14} className="text-ocean-600 dark:text-cyan-300" />
        <span>Chart Legend</span>
        <span className="ml-auto rounded-full bg-ocean-500/15 px-1.5 py-0.2 font-mono text-[9.5px] font-black text-ocean-700 dark:text-cyan-300">
          {shown.length}
        </span>
        <Icon
          name="chevron"
          size={12}
          className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <ul className="mt-1.5 animate-fade-in space-y-2 rounded-2xl border border-sky-200/80 bg-white/95 p-3 shadow-lg backdrop-blur-md dark:border-cyan-500/20 dark:bg-abyss-900/95">
          {shown.map((layer) => {
            const meta = LAYERS[layer];
            const ramp = RAMPS[layer];

            return (
              <li key={layer} className="flex items-start gap-2.5">
                {ramp ? (
                  <span
                    aria-hidden="true"
                    className="mt-0.5 h-3 w-5 shrink-0 rounded-sm shadow-sm"
                    style={{ background: `linear-gradient(90deg, ${ramp.join(", ")})` }}
                  />
                ) : meta.shape === "line" ? (
                  <span
                    aria-hidden="true"
                    className="mt-[6px] h-[3px] w-5 shrink-0 rounded-full"
                    style={{ background: meta.swatch }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="mt-0.5 h-3 w-5 shrink-0 rounded-sm border shadow-sm"
                    style={{ background: `${meta.swatch}55`, borderColor: meta.swatch }}
                  />
                )}

                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold leading-tight text-slate-800 dark:text-slate-100">
                    {meta.label}
                  </span>
                  {ramp && (
                    <span className="block font-mono text-[9px] leading-tight text-ocean-700 dark:text-cyan-300">
                      low → high gradient
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
