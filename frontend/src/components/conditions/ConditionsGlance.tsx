/**
 * Conditions glance widget — Compressed Harbour Summary for the conversation empty-state.
 */

import Icon, { tileIcon } from "@/components/common/Icon";
import { formatWindowShort } from "@/components/conditions/formatWindow";
import type { ConditionsSnapshot, Verdict } from "@/types/orca";

interface Props {
  data: ConditionsSnapshot | null;
  loading: boolean;
  locationName: string;
  onOpen: () => void;
}

const VERDICT: Record<Verdict, { label: string; band: string; dot: string }> = {
  GO: { label: "Safe to Sail", band: "band-go", dot: "bg-emerald-500 shadow-sm shadow-emerald-500/50" },
  CAUTION: { label: "Caution Advised", band: "band-caution", dot: "bg-amber-500 shadow-sm shadow-amber-500/50" },
  NO_GO: { label: "Do Not Sail", band: "band-no_go", dot: "bg-rose-500 shadow-sm shadow-rose-500/50" },
  NOT_APPLICABLE: { label: "Inland Station", band: "band-none", dot: "bg-slate-400" },
};

const HEADLINE = ["wave_height", "wind_gusts_10m", "sea_level_height_msl"];

function formatValue(value: number, unit?: string | null): string {
  if (unit === "m" && value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  const decimals = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return `${Number(value.toFixed(decimals))}${unit ? ` ${unit}` : ""}`;
}

export default function ConditionsGlance({ data, loading, locationName, onOpen }: Props) {
  if (loading && !data) {
    return (
      <div className="card p-3 space-y-2">
        <div className="shimmer h-4 w-32 rounded bg-sky-200/50 dark:bg-white/10" />
        <div className="shimmer h-12 w-full rounded-xl bg-sky-200/50 dark:bg-white/10" />
      </div>
    );
  }

  if (!data) return null;

  const verdict = VERDICT[data.verdict] ?? VERDICT.NOT_APPLICABLE;
  const tiles = HEADLINE.map((field) => data.tiles.find((tile) => tile.field === field))
    .filter((tile): tile is NonNullable<typeof tile> => Boolean(tile))
    .slice(0, 3);

  const window = data.next_window;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-2xl border border-sky-100 bg-white/95 p-3.5 text-left transition-all hover:border-ocean-400 hover:shadow-md dark:border-white/10 dark:bg-abyss-850 dark:hover:border-cyan-400/40"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${verdict.dot}`} />
        <span className={`text-[13px] font-bold ${verdict.band}`}>{verdict.label}</span>
        <span className="truncate text-[11px] muted font-medium">at {locationName} right now</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-ocean-600 dark:text-cyan-300">
          <span>Inspect</span>
          <Icon
            name="arrow-right"
            size={13}
            className="transition-transform group-hover:translate-x-1"
          />
        </span>
      </div>

      {tiles.length > 0 && (
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {tiles.map((tile) => (
            <div
              key={tile.field}
              className="rounded-xl bg-sky-50/60 p-2 dark:bg-white/[0.04] border border-sky-100/60 dark:border-white/5"
            >
              <span className="flex items-center gap-1 text-[9.5px] muted font-semibold truncate">
                <Icon name={tileIcon(tile.icon)} size={11} className="text-ocean-600 dark:text-cyan-300" />
                <span className="truncate">{tile.label}</span>
              </span>
              <span
                className={`mt-1 block font-mono text-[14px] font-black leading-none ${
                  tile.band === "none" ? "text-slate-800 dark:text-slate-100" : `band-${tile.band}`
                }`}
              >
                {formatValue(tile.value, tile.unit)}
              </span>
            </div>
          ))}
        </div>
      )}

      {window && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[10.5px] muted font-medium border-t border-sky-100/80 pt-2 dark:border-white/10">
          <Icon name="clock" size={12} className="text-ocean-600 dark:text-cyan-300" />
          <span>Next {window.quality} sailing passage:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {formatWindowShort(window)}
          </span>
        </p>
      )}
    </button>
  );
}
