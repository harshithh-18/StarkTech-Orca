/**
 * One reading on the conditions dashboard.
 *
 * Owner: D · Phase: P4
 *
 * Shows the value now, the worst value in the next 24 hours, and where that sits against
 * the small-craft limit. Three facts, because two of them are useless alone: "waves 1.1 m"
 * sounds calm right up until you learn it becomes 2.8 m before you would be back.
 *
 * The `band` comes from the backend (`services/conditions._band_for`) and is never
 * re-derived here. If this component decided its own colour it could disagree with the
 * verdict, and a dashboard that contradicts the safety card is worse than no dashboard.
 * `band: "none"` means the field has no threshold at all — tide and sea temperature are
 * context, and painting them green would claim a safety check that nobody performed.
 */

import Icon, { tileIcon } from "@/components/common/Icon";
import type { ConditionTile as Tile } from "@/types/orca";

interface Props {
  tile: Tile;
  /** Lower is worse for visibility, so the bar and the wording have to flip. */
  compact?: boolean;
}

const BAND_TEXT: Record<string, string> = {
  none: "band-none",
  go: "band-go",
  caution: "band-caution",
  no_go: "band-no_go",
};

const BAND_FILL: Record<string, string> = {
  none: "bg-slate-400 dark:bg-slate-500",
  go: "bg-emerald-500",
  caution: "bg-amber-500",
  no_go: "bg-rose-500",
};

const BAND_WORD: Record<string, string> = {
  none: "",
  go: "Within limits",
  caution: "Over the caution limit",
  no_go: "Over the no-go limit",
};

/** Fields where a smaller number is the dangerous one. Mirrors risk_rules.LOWER_IS_WORSE. */
const LOWER_IS_WORSE = new Set(["visibility"]);

function formatValue(value: number, unit?: string | null): string {
  // Visibility arrives in metres and reads as noise at five digits; kilometres is how
  // anyone at sea actually talks about it.
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

export default function ConditionTile({ tile, compact = false }: Props) {
  const band = BAND_TEXT[tile.band] ?? BAND_TEXT.none;
  const lowerIsWorse = LOWER_IS_WORSE.has(tile.field);

  // The bar is the reading **now** against the caution limit; the peak is a separate tick.
  //
  // Filling it to the peak instead was actively misleading: gusts of 32 km/h now, peaking
  // at 44 later, drew a bar full to the brim *in green* — the length said "at the limit"
  // and the colour said "fine". Two facts need two marks.
  //
  // Measured against the caution limit rather than the no-go one because that is the line
  // the user is trying not to cross; a bar that only fills at "do not go to sea" gives no
  // warning on the way there.
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
      className="card group relative overflow-hidden p-3 transition-colors hover:border-slate-300 dark:hover:border-white/20"
    >
      <div className="flex items-center gap-2">
        <Icon name={tileIcon(tile.icon)} size={15} className={band} />
        <span className="truncate text-[11.5px] font-medium muted">{tile.label}</span>
      </div>

      <p className={`mt-1.5 text-[19px] font-bold leading-none tracking-tight ${band}`}>
        {formatValue(tile.value, tile.unit)}
      </p>

      {!compact && (
        <>
          {fraction !== null && (
            <div
              className="relative mt-2.5 h-1 rounded-full bg-slate-200 dark:bg-white/10"
              role="img"
              aria-label={`${tile.label}: ${
                BAND_WORD[tile.band] || "no safety limit applies"
              }${
                peakDiffers && tile.peak_band !== tile.band
                  ? `, ${BAND_WORD[tile.peak_band]?.toLowerCase()} at its peak`
                  : ""
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  BAND_FILL[tile.band] ?? BAND_FILL.none
                }`}
                style={{ width: `${fraction * 100}%` }}
              />

              {/* Where the next 24 hours take it. Only drawn when it is somewhere else —
                  a tick sitting exactly on the bar's end is just a thicker bar. */}
              {peakFraction !== null && peakDiffers && (
                <span
                  aria-hidden="true"
                  title={`Peaks at ${formatValue(tile.peak_value!, tile.unit)}`}
                  className={`absolute -top-0.5 h-2 w-[3px] rounded-full ${
                    BAND_FILL[tile.peak_band] ?? BAND_FILL.none
                  }`}
                  style={{ left: `calc(${peakFraction * 100}% - 1.5px)` }}
                />
              )}
            </div>
          )}

          <p className="mt-1.5 text-[10.5px] leading-tight muted">
            {peakDiffers && peakHour ? (
              <>
                {lowerIsWorse ? "Lowest" : "Peak"}{" "}
                <span
                  className={`font-semibold ${
                    // Say it in the peak's own colour when it crosses a line the current
                    // reading has not: "peak 43.6 km/h" in amber is the actual warning.
                    tile.peak_band !== tile.band && tile.peak_band !== "none"
                      ? BAND_TEXT[tile.peak_band]
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {formatValue(tile.peak_value!, tile.unit)}
                </span>{" "}
                at {peakHour}
              </>
            ) : reference !== null ? (
              <>Limit {formatValue(reference, tile.unit)}</>
            ) : (
              "Context — no safety limit applies"
            )}
          </p>
        </>
      )}
    </div>
  );
}
