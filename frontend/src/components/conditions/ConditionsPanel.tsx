/**
 * The conditions dashboard — Live Sea State, Telemetry Gauges, and Safety Windows.
 */

import ConditionTile from "@/components/conditions/ConditionTile";
import NoCoastCard from "@/components/conditions/NoCoastCard";
import ForecastChart from "@/components/conditions/ForecastChart";
import SafeWindowCard from "@/components/conditions/SafeWindowCard";
import TideCard from "@/components/conditions/TideCard";
import VerdictCard from "@/components/conditions/VerdictCard";
import Icon from "@/components/common/Icon";
import type { ConditionsSnapshot, Location } from "@/types/orca";

interface Props {
  location: Location;
  data: ConditionsSnapshot | null;
  loading: boolean;
  error: string | null;
  updatedAt: Date | null;
  onRefresh: () => void;
  isDark: boolean;
  /** Rendered under the tiles so the watch is one click from readings. */
  watchSlot?: React.ReactNode;
  /** Jump to the nearest harbour when this point has no sea. */
  onGoToCoast: (location: Location) => void;
  /** Action bridge to Ask with a pre-filled maritime query. */
  onAskPrompt?: (query: string) => void;
}

function SkeletonTile() {
  return (
    <div className="card p-3">
      <div className="shimmer h-3 w-16 rounded bg-sky-200/50 dark:bg-white/10" />
      <div className="shimmer mt-2.5 h-6 w-20 rounded bg-sky-200/50 dark:bg-white/10" />
      <div className="shimmer mt-3 h-1.5 w-full rounded bg-sky-200/50 dark:bg-white/10" />
    </div>
  );
}

export default function ConditionsPanel({
  location,
  data,
  loading,
  error,
  updatedAt,
  onRefresh,
  isDark,
  watchSlot,
  onGoToCoast,
  onAskPrompt,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white/50 dark:bg-abyss-900/50 backdrop-blur-sm">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-sky-100 px-4 py-3 dark:border-white/10">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            <h2 className="text-[14.5px] font-bold leading-tight text-slate-900 dark:text-white">
              Sea Conditions & Nowcast
            </h2>
          </div>
          <p className="truncate text-[10.5px] muted">
            {location.name ?? "Selected Station"} ·{" "}
            {updatedAt
              ? `Sensor cycle: ${updatedAt.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Fetching telemetry…"}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="btn-icon"
          title="Refresh current sea readings"
          aria-label="Refresh conditions"
        >
          <Icon name="refresh" size={15} className={loading ? "animate-spin-slow text-ocean-600" : ""} />
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-3.5">
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.08] p-3 shadow-sm">
            <p className="flex items-start gap-2 text-[12px] leading-snug band-no_go">
              <Icon name="alert" size={15} className="mt-px shrink-0" />
              <span>{error}</span>
            </p>
          </div>
        )}

        {!data && loading && (
          <>
            <div className="shimmer h-28 rounded-2xl bg-sky-200/40 dark:bg-white/10" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <SkeletonTile key={index} />
              ))}
            </div>
          </>
        )}

        {data && (
          <>
            {/* Safety Verdict Beacon */}
            {data.coastal ? (
              <VerdictCard
                verdict={data.verdict}
                reasons={data.reasons}
                nextWindow={data.next_window}
                usedMockData={data.used_mock_data}
              />
            ) : (
              <NoCoastCard
                locationName={location.name ?? "this point"}
                coast={data.nearest_coast}
                reasons={data.reasons}
                onGoToCoast={onGoToCoast}
              />
            )}

            {/* Cross-page Connection: Ask About Conditions Action */}
            {onAskPrompt && data.coastal && (
              <button
                type="button"
                onClick={() =>
                  onAskPrompt(
                    `Based on current conditions at ${location.name ?? "my location"} (verdict: ${data.verdict}), is it safe for small craft to sail today? What precautions are needed?`,
                  )
                }
                className="group flex w-full items-center justify-between rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-50/60 via-teal-50/40 to-white p-2.5 text-left transition-all hover:border-emerald-500 hover:shadow-sm dark:border-emerald-400/30 dark:from-[#091a18] dark:via-[#0c1826] dark:to-[#081220]"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    <Icon name="chat" size={13} />
                  </span>
                  <span className="text-[12px] font-bold text-slate-900 dark:text-slate-100">
                    Ask ORCA to analyze these conditions
                  </span>
                </div>
                <Icon
                  name="arrow-right"
                  size={13}
                  className="text-emerald-600 dark:text-emerald-400 transition-transform group-hover:translate-x-1"
                />
              </button>
            )}

            {data.coastal && data.degraded.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2">
                <p className="text-[11px] leading-snug band-caution">
                  Sensor notice: {data.degraded.join("; ")}. Displaying live telemetry from active feeds.
                </p>
              </div>
            )}

            {/* Telemetry Tiles */}
            <div>
              <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                <Icon name="gauge" size={12} />
                {data.coastal ? "Atmospheric & Marine Readings" : `Weather at ${location.name ?? "this point"}`}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2">
                {data.tiles.map((tile) => (
                  <ConditionTile
                    key={tile.field}
                    tile={tile}
                    onAsk={
                      onAskPrompt
                        ? () =>
                            onAskPrompt(
                              `Explain the current ${tile.label} reading of ${tile.value} ${tile.unit ?? ""} at ${location.name ?? "my location"} and what risks it poses for small craft.`,
                            )
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>

            {/* Coastal Specific Modules */}
            {data.coastal && (
              <>
                {watchSlot}

                <SafeWindowCard
                  next={data.next_window}
                  windows={data.windows}
                  blockedBy={data.blocked_by}
                />

                {data.tide && <TideCard tide={data.tide} />}
              </>
            )}

            {/* Forecast Curves */}
            {data.charts.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <p className="eyebrow flex items-center gap-1.5">
                  <Icon name="chart" size={12} />
                  48-Hour Wave & Wind Forecast Curves
                </p>
                {data.charts.map((chart) => (
                  <ForecastChart key={chart.id} spec={chart} isDark={isDark} />
                ))}
              </div>
            )}

            <p className="pt-1 text-[10px] leading-relaxed muted">
              Attribution: {data.attribution.join(" · ")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
