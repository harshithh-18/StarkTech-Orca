/**
 * The conditions dashboard — what the sea is doing, before anyone asks.
 *
 * Owner: D · Phase: P4
 *
 * The one view in ORCA that requires no question. Pick a harbour and this is already
 * true: the verdict, eight readings against their limits, the tide, the next safe
 * departure window, and the forecast curves behind all of it.
 *
 * It exists because the problem statement's own example query — *"what are the tide,
 * weather and sea conditions near my fishing location?"* — should not need a
 * conversational turn, and because an interface that shows nothing until you type
 * something has to be learned before it can be trusted.
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
  /** Rendered under the tiles so the watch is one click from the readings it watches. */
  watchSlot?: React.ReactNode;
  /** Jump to the nearest harbour when this point has no sea. */
  onGoToCoast: (location: Location) => void;
}

function SkeletonTile() {
  return (
    <div className="card p-3">
      <div className="shimmer h-3 w-16 rounded bg-slate-200 dark:bg-white/10" />
      <div className="shimmer mt-2.5 h-5 w-20 rounded bg-slate-200 dark:bg-white/10" />
      <div className="shimmer mt-3 h-1 w-full rounded bg-slate-200 dark:bg-white/10" />
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
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold leading-tight text-slate-900 dark:text-white">
            Conditions
          </h2>
          <p className="truncate text-[11px] muted">
            {location.name ?? "Selected point"} ·{" "}
            {updatedAt
              ? `updated ${updatedAt.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "loading…"}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="btn-icon ml-auto"
          title="Refresh now"
          aria-label="Refresh conditions"
        >
          <Icon name="refresh" size={15} className={loading ? "animate-spin-slow" : ""} />
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-3">
            <p className="flex items-start gap-2 text-[12.5px] leading-snug band-no_go">
              <Icon name="alert" size={15} className="mt-px" />
              <span>{error}</span>
            </p>
          </div>
        )}

        {!data && loading && (
          <>
            <div className="shimmer h-24 rounded-xl bg-slate-200 dark:bg-white/10" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <SkeletonTile key={index} />
              ))}
            </div>
          </>
        )}

        {data && (
          <>
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

            {data.coastal && data.degraded.length > 0 && (
              // We degrade honestly. A missing model costs the user some tiles, and the
              // panel says which ones and why rather than quietly showing fewer.
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2">
                <p className="text-[11.5px] leading-snug band-caution">
                  Partial data —{" "}
                  {data.degraded.join("; ")}. Everything below is from the models that did
                  answer.
                </p>
              </div>
            )}

            <div>
              <p className="eyebrow mb-1.5">
                {data.coastal ? "Right now" : `Weather at ${location.name ?? "this point"}`}
              </p>
              {/* Three columns only while the panel is full-width (phone landscape and
                  small tablets). From `md` the panel is a fixed 360–392 px column, and
                  three tiles in it would clip the values. */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2">
                {data.tiles.map((tile) => (
                  <ConditionTile key={tile.field} tile={tile} />
                ))}
              </div>
            </div>

            {/* A safety watch, a departure window and a tide table are all statements
                about a sea that is not there. Shown only for a coastal point. */}
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

            {data.charts.length > 0 && (
              <div className="space-y-2">
                <p className="eyebrow">Forecast</p>
                {data.charts.map((chart) => (
                  <ForecastChart key={chart.id} spec={chart} isDark={isDark} />
                ))}
              </div>
            )}

            <p className="pt-1 text-[10.5px] leading-relaxed muted">
              {data.attribution.join(" · ")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
