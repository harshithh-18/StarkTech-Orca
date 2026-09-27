/**
 * One reading on the conditions dashboard — Nautical Telemetry Gauge.
 */

import Icon, { tileIcon } from "@/components/common/Icon";
import type { ConditionTile as Tile } from "@/types/orca";

interface Props {
  tile: Tile;
  compact?: boolean;
  onAsk?: () => void;
}

const BAND_TEXT: Record<string, string> = {
  none: "band-none",
  go: "band-go",
  caution: "band-caution",
  no_go: "band-no_go",
};

const BAND_FILL: Record<string, string> = {
  none: "bg-slate-400 dark:bg-slate-500",
  go: "bg-emerald-500 shadow-sm shadow-emerald-500/50",
  caution: "bg-amber-500 shadow-sm shadow-amber-500/50",
  no_go: "bg-rose-500 shadow-sm shadow-rose-500/50",
};

const BAND_WORD: Record<string, string> = {
  none: "",
  go: "Within safe limit",
  caution: "Approaching advisory limit",
  no_go: "Exceeds small-craft limit",
};

const LOWER_IS_WORSE = new Set(["visibility"]);

function formatValue(value: number, unit?: string | null): string {
  if (unit === "m" && value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  const decimals = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return `${Number(value.toFixed(decimals))}${unit ? ` ${unit}` : ""}`;
}

function formatHour(iso?: string | null): string | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function ConditionTile({ tile, compact = false, onAsk }: Props) {
  const band = BAND_TEXT[tile.band] ?? BAND_TEXT.none;
  const lowerIsWorse = LOWER_IS_WORSE.has(tile.field);

  const reference = tile.threshold ?? null;

  const fractionOf = (value: number) =>
    reference === null
      ? null
      : Math.min(
          1,
          Math.max(0.02, lowerIsWorse ? reference / Math.max(value, 1e-6) : value / reference),
        );

  const fraction = fractionOf(tile.value);
  const peakFraction = tile.peak_value != null ? fractionOf(tile.peak_value) : null;

  const peakHour = formatHour(tile.peak_time);
  const peakDiffers =
    tile.peak_value != null && Math.abs(tile.peak_value - tile.value) > 0.01;

  return (
    <div
      title={`${tile.source}${tile.time ? ` · valid ${new Date(tile.time).toLocaleString()}` : ""}`}
      className="card group relative overflow-hidden p-3 transition-all hover:border-ocean-300 dark:hover:border-ocean-500/40"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-sky-100 dark:bg-white/5 text-ocean-700 dark:text-cyan-300">
            <Icon name={tileIcon(tile.icon)} size={13} className={band} />
          </span>
          <span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            {tile.label}
          </span>
        </div>

        {onAsk && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAsk();
            }}
            title={`Ask ORCA about ${tile.label}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-ocean-600 dark:text-cyan-300 hover:bg-ocean-500/10"
          >
            <Icon name="chat" size={13} />
          </button>
        )}
      </div>

      <p className={`mt-2 font-mono text-[20px] font-black leading-none tracking-tight ${band}`}>
        {formatValue(tile.value, tile.unit)}
      </p>

      {!compact && (
        <>
          {fraction !== null && (
            <div
              className="relative mt-2.5 h-1.5 rounded-full bg-sky-100 dark:bg-white/10 overflow-hidden"
              role="img"
              aria-label={`${tile.label}: ${
                BAND_WORD[tile.band] || "no safety limit applies"
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  BAND_FILL[tile.band] ?? BAND_FILL.none
                }`}
                style={{ width: `${fraction * 100}%` }}
              />

              {peakFraction !== null && peakDiffers && (
                <span
                  aria-hidden="true"
                  title={`Peaks at ${formatValue(tile.peak_value!, tile.unit)}`}
                  className={`absolute -top-0.5 h-2.5 w-[3px] rounded-full z-10 ${
                    BAND_FILL[tile.peak_band] ?? BAND_FILL.none
                  }`}
                  style={{ left: `calc(${peakFraction * 100}% - 1.5px)` }}
                />
              )}
            </div>
          )}

          <p className="mt-1.5 text-[10px] leading-tight muted font-medium">
            {peakDiffers && peakHour ? (
              <>
                {lowerIsWorse ? "Min" : "Peak"}{" "}
                <span
                  className={`font-bold ${
                    tile.peak_band !== tile.band && tile.peak_band !== "none"
                      ? BAND_TEXT[tile.peak_band]
                      : "text-slate-800 dark:text-slate-200"
                  }`}
                >
                  {formatValue(tile.peak_value!, tile.unit)}
                </span>{" "}
                at {peakHour}
              </>
            ) : reference !== null ? (
              <>Limit: {formatValue(reference, tile.unit)}</>
            ) : (
              "Informational sensor reading"
            )}
          </p>
        </>
      )}
    </div>
  );
}
