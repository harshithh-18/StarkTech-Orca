/**
 * Conditions, compressed to one card.
 *
 * Owner: D · Phase: P4
 *
 * The Ask panel opens empty — a greeting, five starters, and then a lot of nothing above
 * the composer. This fills it with the one thing the user would have asked first anyway:
 * the verdict where they are, the three readings that decided it, and when the next safe
 * window opens.
 *
 * It is a summary, not a second dashboard: three tiles and a line. Anything more and there
 * would be two places showing the same data with different amounts of it, which is how a
 * user stops believing either.
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
  GO: { label: "Safe to go", band: "band-go", dot: "bg-emerald-500" },
  CAUTION: { label: "Caution", band: "band-caution", dot: "bg-amber-500" },
  NO_GO: { label: "Do not go to sea", band: "band-no_go", dot: "bg-rose-500" },
  NOT_APPLICABLE: { label: "No assessment", band: "band-none", dot: "bg-slate-400" },
};

/** The three that decide most verdicts. Shown in this order whenever they are present. */
const HEADLINE = ["wave_height", "wind_gusts_10m", "sea_level_height_msl"];

function formatValue(value: number, unit?: string | null): string {
  if (unit === "m" && value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  const decimals = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return `${Number(value.toFixed(decimals))}${unit ? ` ${unit}` : ""}`;
}

export default function ConditionsGlance({ data, loading, locationName, onOpen }: Props) {
  if (loading && !data) {
    return (
      <div className="card p-3">
        <div className="shimmer h-4 w-32 rounded bg-slate-200 dark:bg-white/10" />
        <div className="shimmer mt-3 h-10 w-full rounded bg-slate-200 dark:bg-white/10" />
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
      className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-ocean-400 dark:border-white/10 dark:bg-abyss-850 dark:hover:border-ocean-500/60"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${verdict.dot}`} />
        <span className={`text-[12.5px] font-semibold ${verdict.band}`}>{verdict.label}</span>
        <span className="truncate text-[11px] muted">at {locationName} right now</span>
        <Icon
          name="arrow-right"
          size={13}
          className="ml-auto shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ocean-500 dark:text-slate-600"
        />
      </div>

      {tiles.length > 0 && (
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {tiles.map((tile) => (
            <div
              key={tile.field}
              className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-white/[0.04]"
            >
              <span className="flex items-center gap-1 text-[10px] muted">
                <Icon name={tileIcon(tile.icon)} size={11} />
                <span className="truncate">{tile.label}</span>
              </span>
              <span
                className={`mt-0.5 block text-[13px] font-bold leading-none ${
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
        <p className="mt-2 flex items-center gap-1.5 text-[11px] muted">
          <Icon name="clock" size={12} />
          Next {window.quality} window {formatWindowShort(window)}
        </p>
      )}
    </button>
  );
}
