/**
 * Proactive Safety Watch Station — Automated Coastal Surveillance.
 */

import Icon, { type IconName } from "@/components/common/Icon";
import type { Location, WatchAlert, WatchStatus } from "@/types/orca";

interface Props {
  location: Location;
  status: WatchStatus | null;
  alerts: WatchAlert[];
  starting: boolean;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  /** Action bridge to pan the map to the alert zone. */
  onShowOnMap?: (coords?: { lat: number; lon: number }) => void;
  /** Action bridge to Ask AI about this alert. */
  onAskAdvice?: (alert: WatchAlert) => void;
}

const SEVERITY: Record<
  WatchAlert["severity"],
  { icon: IconName; label: string; ring: string; text: string; dot: string }
> = {
  critical: {
    icon: "alert",
    label: "Critical Hazard",
    ring: "border-rose-500/40 bg-gradient-to-br from-rose-500/[0.08] to-red-500/[0.03]",
    text: "band-no_go",
    dot: "bg-rose-500 shadow-sm shadow-rose-500/50",
  },
  warning: {
    icon: "alert",
    label: "Coastal Warning",
    ring: "border-amber-500/40 bg-gradient-to-br from-amber-500/[0.08] to-yellow-500/[0.03]",
    text: "band-caution",
    dot: "bg-amber-500 shadow-sm shadow-amber-500/50",
  },
  info: {
    icon: "info",
    label: "Advisory Note",
    ring: "border-sky-200/90 bg-sky-50/40 dark:border-white/10 dark:bg-white/[0.03]",
    text: "band-none",
    dot: "bg-slate-400",
  },
};

function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AlertsPanel({
  location,
  status,
  alerts,
  starting,
  error,
  onStart,
  onStop,
  onShowOnMap,
  onAskAdvice,
}: Props) {
  const active = Boolean(status?.watch.active);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white/50 dark:bg-abyss-900/50 backdrop-blur-sm">
      {/* Header */}
      <div className="shrink-0 border-b border-sky-100 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-1.5">
          <Icon name="radar" size={16} className="text-ocean-600 dark:text-cyan-300" />
          <h2 className="text-[14.5px] font-bold leading-tight text-slate-900 dark:text-white">
            Coastal Safety Watch Station
          </h2>
        </div>
        <p className="text-[11px] muted">
          Proactive background surveillance monitoring weather limits and boundary proximity.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-3.5">
        {/* ── Watch Station Radar Terminal ───────────────────────────── */}
        <section
          className={`card relative overflow-hidden p-4 transition-all ${
            active
              ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.08] via-teal-500/[0.04] to-sky-500/[0.05] dark:border-emerald-400/30"
              : "border-sky-100"
          }`}
        >
          {/* Radar Scanner Animation Indicator */}
          {active && (
            <div className="absolute right-3 top-3 h-10 w-10 overflow-hidden rounded-full border border-emerald-500/40 bg-emerald-950/20 shadow-inner">
              <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
              <div className="absolute inset-1.5 rounded-full border border-emerald-500/30" />
              <div className="absolute inset-0 animate-radar-sweep bg-gradient-to-tr from-transparent via-transparent to-emerald-400/50" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold ${
                active
                  ? "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/30"
                  : "bg-sky-100 text-ocean-700 dark:bg-white/[0.06] dark:text-slate-300"
              }`}
            >
              <Icon name={active ? "shield" : "radar"} size={18} />
            </span>

            <div className="min-w-0 flex-1 pr-10">
              <p className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100">
                {active ? "Surveillance Active" : "Radar Watch Inactive"}
              </p>
              <p className="font-mono text-[10.5px] text-ocean-700 dark:text-cyan-300 font-semibold">
                Station: {status?.watch.location.name ?? location.name ?? "Selected Coordinates"}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed muted">
                {active
                  ? `Cycle: every ${Math.round(
                      (status?.watch.interval_seconds ?? 900) / 60,
                    )}m. Completed ${status?.checks ?? 0} automated sweeps${
                      status?.watch.last_checked_at
                        ? ` (last ${timeAgo(status.watch.last_checked_at)})`
                        : ""
                    }.`
                  : "Arm surveillance to continuously monitor sea-state limits and maritime boundary buffers."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={active ? onStop : onStart}
            disabled={starting}
            className={`mt-3.5 w-full py-2.5 font-bold ${
              active
                ? "btn-ghost text-rose-600 hover:border-rose-400 hover:bg-rose-50/50 dark:text-rose-400"
                : "btn-primary"
            }`}
          >
            {starting ? (
              <>
                <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-current border-t-transparent" />
                Connecting Watch Stream…
              </>
            ) : active ? (
              <>
                <Icon name="stop" size={14} />
                Disarm Coastal Watch
              </>
            ) : (
              <>
                <Icon name="radar" size={14} />
                Arm Proactive Watch on {location.name ?? "Current Point"}
              </>
            )}
          </button>

          {error && <p className="mt-2 text-[11px] band-no_go font-semibold">{error}</p>}
        </section>

        {/* ── Active Watch Log ────────────────────────────────────────── */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1.5">
              <Icon name="bell" size={12} />
              Surveillance Log
            </p>
            {alerts.length > 0 && (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-700 dark:text-rose-300">
                {alerts.length} Event{alerts.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="card grid place-items-center gap-2 p-8 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-sky-100 dark:bg-white/5 text-ocean-600 dark:text-cyan-300">
                <Icon name={active ? "eye" : "radar"} size={20} />
              </span>
              <p className="text-[12.5px] font-bold text-slate-800 dark:text-slate-200">
                {active ? "All Monitored Parameters Normal" : "No Active Alerts"}
              </p>
              <p className="text-[11px] muted max-w-xs">
                {active
                  ? "Surveillance is running. ORCA will broadcast immediately if sea conditions deteriorate or boundaries are approached."
                  : "Arm the surveillance watch to receive automated hazard and geofence alerts."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {alerts.map((alert, index) => {
                const style = SEVERITY[alert.severity] ?? SEVERITY.info;
                return (
                  <li
                    key={`${alert.raised_at}-${index}`}
                    className={`animate-slide-up rounded-2xl border p-3.5 shadow-sm transition-all hover:scale-[1.01] ${style.ring}`}
                    style={{
                      animationDelay: `${Math.min(index, 6) * 40}ms`,
                      animationFillMode: "backwards",
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon name={style.icon} size={16} className={`mt-0.5 shrink-0 ${style.text}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-[13px] font-bold leading-snug ${style.text}`}>
                            {alert.title}
                          </p>
                          <span className="font-mono text-[10px] muted shrink-0">
                            {timeAgo(alert.raised_at)}
                          </span>
                        </div>

                        <p className="mt-1 text-[12px] leading-relaxed text-slate-700 dark:text-slate-200">
                          {alert.detail}
                        </p>

                        {/* Interactive Bridges: Show on Map & Ask Advice */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-2 border-t border-black/[0.06] dark:border-white/10">
                          {onShowOnMap && (
                            <button
                              type="button"
                              onClick={() => onShowOnMap()}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/80 bg-white/90 px-2 py-1 text-[10.5px] font-bold text-ocean-700 hover:bg-sky-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-cyan-300"
                            >
                              <Icon name="map" size={12} />
                              Locate on Chart
                            </button>
                          )}

                          {onAskAdvice && (
                            <button
                              type="button"
                              onClick={() => onAskAdvice(alert)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-ocean-600 to-teal-600 px-2 py-1 text-[10.5px] font-bold text-white shadow-sm hover:from-ocean-500 hover:to-teal-500"
                            >
                              <Icon name="chat" size={12} />
                              Ask AI Action Plan
                            </button>
                          )}

                          {alert.evidence.length > 0 && (
                            <span className="font-mono text-[9.5px] muted ml-auto">
                              Source: {alert.evidence[0].source.split("(")[0].trim()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
