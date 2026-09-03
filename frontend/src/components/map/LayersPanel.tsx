/**
 * The Layers view — the map's data, explored directly.
 *
 * Owner: D · Phase: P3 (toggles) · Rebuilt P4 as a panel
 *
 * Two kinds of layer are on the map at any moment, and conflating them is confusing:
 *
 *   - **from the answer** — switched on by the visualization agent because the answer
 *     needs them. Shown first, marked, and not removable: hiding the fishing zones that
 *     an answer about fishing zones just drew would make the answer unreadable.
 *   - **added by you** — anything else, switched on here and switched off here.
 *
 * Each row carries what the layer means and where it came from, because a legend that
 * only names a colour tells the user nothing they could not already see.
 */

import Icon from "@/components/common/Icon";
import { BASEMAPS, LAYERS, RAMPS, type BasemapId } from "@/components/map/mapConfig";
import type { MapLayer } from "@/types/orca";

interface Props {
  /** Layers the current answer asked for. */
  fromAnswer: MapLayer[];
  /** Layers the user switched on. */
  manual: MapLayer[];
  onToggle: (layer: MapLayer) => void;
  basemap: BasemapId;
  onBasemapChange: (basemap: BasemapId) => void;
}

const EXPLORABLE = (Object.keys(LAYERS) as MapLayer[]).filter(
  (layer) => LAYERS[layer].explorable,
);

function Swatch({ layer }: { layer: MapLayer }) {
  const meta = LAYERS[layer];
  const ramp = RAMPS[layer];

  if (ramp) {
    return (
      <span
        aria-hidden="true"
        className="h-3.5 w-6 shrink-0 rounded-sm"
        style={{ background: `linear-gradient(90deg, ${ramp.join(", ")})` }}
      />
    );
  }
  if (meta.shape === "line") {
    return (
      <span aria-hidden="true" className="grid h-3.5 w-6 shrink-0 place-items-center">
        <span className="h-[3px] w-full rounded-full" style={{ background: meta.swatch }} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-6 shrink-0 rounded-sm border"
      style={{ background: `${meta.swatch}55`, borderColor: meta.swatch }}
    />
  );
}

export default function LayersPanel({
  fromAnswer,
  manual,
  onToggle,
  basemap,
  onBasemapChange,
}: Props) {
  const answerDataLayers = fromAnswer.filter((layer) => layer !== "user_pin");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <h2 className="text-[15px] font-bold leading-tight text-slate-900 dark:text-white">
          Map layers
        </h2>
        <p className="text-[11px] muted">
          Everything ORCA can draw, and where each layer comes from.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {/* ── Basemap ─────────────────────────────────────────────────── */}
        <div>
          <p className="eyebrow mb-1.5">Base map</p>
          <div className="flex gap-1.5">
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onBasemapChange(id)}
                aria-pressed={basemap === id}
                className={`flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors ${
                  basemap === id
                    ? "border-ocean-500 bg-ocean-500/10 text-ocean-700 dark:text-ocean-300"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-abyss-850 dark:text-slate-300 dark:hover:bg-white/5"
                }`}
              >
                {BASEMAPS[id].label}
              </button>
            ))}
          </div>
        </div>

        {/* ── From the answer ─────────────────────────────────────────── */}
        {/* The pin is excluded: it is always on, explains itself, and listing it under
            "the answer needs them" would claim an answer that may not exist yet. */}
        {answerDataLayers.length > 0 && (
          <div>
            <p className="eyebrow mb-1.5">On, because the answer needs them</p>
            <ul className="space-y-1">
              {answerDataLayers.map((layer) => {
                const meta = LAYERS[layer];
                if (!meta) return null;
                return (
                  <li
                    key={layer}
                    className="flex items-start gap-2.5 rounded-lg border border-ocean-500/25 bg-ocean-500/[0.05] px-2.5 py-2"
                  >
                    <Swatch layer={layer} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">
                        {meta.label}
                      </span>
                      <span className="block text-[11px] leading-snug muted">
                        {meta.description}
                      </span>
                    </span>
                    <Icon
                      name="check"
                      size={14}
                      className="mt-0.5 text-ocean-600 dark:text-ocean-300"
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ── Everything else ─────────────────────────────────────────── */}
        <div>
          <p className="eyebrow mb-1.5">Add a layer</p>
          <ul className="space-y-1">
            {EXPLORABLE.filter((layer) => !fromAnswer.includes(layer)).map((layer) => {
              const meta = LAYERS[layer];
              const on = manual.includes(layer);

              return (
                <li key={layer}>
                  <button
                    type="button"
                    onClick={() => onToggle(layer)}
                    aria-pressed={on}
                    className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      on
                        ? "border-slate-300 bg-slate-50 dark:border-white/20 dark:bg-white/[0.06]"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-abyss-850 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <Swatch layer={layer} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">
                        {meta.label}
                      </span>
                      <span className="block text-[11px] leading-snug muted">
                        {meta.description}
                      </span>
                      {meta.term && (
                        // The acronym, once, for whoever came looking for it.
                        <span className="mt-0.5 block truncate text-[10px] muted opacity-80">
                          Officially: {meta.term}
                        </span>
                      )}
                      <span className="mt-0.5 block truncate text-[10px] muted opacity-80">
                        {meta.source}
                      </span>
                    </span>

                    <span
                      aria-hidden="true"
                      className={`mt-0.5 grid h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                        on ? "bg-ocean-500" : "bg-slate-300 dark:bg-white/15"
                      }`}
                    >
                      <span
                        className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                          on ? "translate-x-3" : ""
                        }`}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-[10.5px] leading-relaxed muted">
          A layer that returns nothing is omitted rather than drawn empty — usually because
          the Copernicus subset has not been downloaded, or because the point is inland.
          Click anywhere on the map to move the pin there.
        </p>
      </div>
    </div>
  );
}
