/**
 * Legend for whatever is currently drawn.
 *
 * Owner: D · Phase: P4
 *
 * Floats over the map, lists only the active layers, and collapses to a single button so
 * it never fights the map for space on a phone. A legend listing layers that are not on
 * screen is worse than none — it makes the reader hunt for something that isn't there.
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

  // The pin is always on and explains itself; listing it is noise.
  const shown = layers.filter((layer) => layer !== "user_pin" && LAYERS[layer]);
  if (shown.length === 0) return null;

  return (
    <div className="absolute right-2 top-2 z-[400] max-w-[15rem]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-white/10 dark:bg-abyss-900/90 dark:text-slate-200 dark:hover:bg-abyss-900"
      >
        <Icon name="layers" size={14} />
        Legend
        <span className="ml-auto text-[10px] font-normal muted">{shown.length}</span>
        <Icon
          name="chevron"
          size={12}
          className={`text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <ul className="mt-1 animate-fade-in space-y-1.5 rounded-lg border border-slate-200 bg-white/90 p-2.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-abyss-900/90">
          {shown.map((layer) => {
            const meta = LAYERS[layer];
            const ramp = RAMPS[layer];

            return (
              <li key={layer} className="flex items-start gap-2">
                {ramp ? (
                  <span
                    aria-hidden="true"
                    className="mt-0.5 h-3 w-5 shrink-0 rounded-sm"
                    style={{ background: `linear-gradient(90deg, ${ramp.join(", ")})` }}
                  />
                ) : meta.shape === "line" ? (
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-[3px] w-5 shrink-0 rounded-full"
                    style={{ background: meta.swatch }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="mt-0.5 h-3 w-5 shrink-0 rounded-sm border"
                    style={{ background: `${meta.swatch}55`, borderColor: meta.swatch }}
                  />
                )}

                <span className="min-w-0">
                  <span className="block text-[11px] font-medium leading-tight text-slate-800 dark:text-slate-100">
                    {meta.label}
                  </span>
                  {ramp && (
                    <span className="block text-[9.5px] leading-tight muted">low → high</span>
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
