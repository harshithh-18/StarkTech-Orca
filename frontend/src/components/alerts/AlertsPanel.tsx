/**
 * Proactive safety watch.
 *
 * Owner: D · Phase: P4
 *
 * Everywhere else in ORCA the user asks and the platform answers. This is the one place it
 * speaks first: arm a watch on a location and the backend re-checks it every fifteen
 * minutes, pushing anything that turned dangerous — a threshold crossed, the verdict
 * degrading, drifting within warning distance of the IMBL, the departure window closing.
 *
 * ## What the panel promises, and what it does not
 *
 * Watches live in the backend's memory (`services/watch.py`) and do not survive a server
 * restart or a closed tab. The panel says so in plain words rather than implying a
 * durability that is not there — a safety feature that quietly stops watching is worse
 * than one that never started, and "we would need Redis and a worker for that" is a
 * perfectly good thing to tell a user.
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
}

const SEVERITY: Record<
  WatchAlert["severity"],
  { icon: IconName; label: string; ring: string; text: string; dot: string }
> = {
  critical: {
    icon: "alert",
    label: "Critical",
    ring: "border-rose-500/35 bg-rose-500/[0.07]",
    text: "band-no_go",
    dot: "bg-rose-500",
  },
  warning: {
    icon: "alert",
    label: "Warning",
    ring: "border-amber-500/35 bg-amber-500/[0.07]",
    text: "band-caution",
    dot: "bg-amber-500",
  },
  info: {
    icon: "info",
    label: "Note",
    ring: "border-slate-300 bg-slate-500/[0.05] dark:border-white/10",
    text: "band-none",
    dot: "bg-slate-400",
  },
};

function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
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
}: Props) {
  const active = Boolean(status?.watch.active);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <h2 className="text-[15px] font-bold leading-tight text-slate-900 dark:text-white">
          Safety watch
        </h2>
        <p className="text-[11px] muted">
          ORCA re-checks this location and warns you without being asked.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {/* ── The switch ──────────────────────────────────────────────── */}
        <section
          className={`card p-3 ${active ? "border-emerald-500/35 bg-emerald-500/[0.05]" : ""}`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                active
                  ? "bg-emerald-500/15 band-go"
                  : "bg-slate-500/10 text-slate-500 dark:text-slate-400"
              }`}
            >
              <Icon name={active ? "shield" : "bell"} size={17} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                {active ? "Watching" : "Watch not running"}{" "}
                <span className="font-normal muted">
                  · {status?.watch.location.name ?? location.name ?? "selected point"}
                </span>
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug muted">
                {active
                  ? `Re-checked every ${Math.round(
                      (status?.watch.interval_seconds ?? 900) / 60,
                    )} minutes. ${status?.checks ?? 0} check${
                      (status?.checks ?? 0) === 1 ? "" : "s"
                    } so far${
                      status?.watch.last_checked_at
                        ? `, last ${timeAgo(status.watch.last_checked_at)}`
                        : ""
                    }.`
                  : "Arm a watch and ORCA will re-check conditions and boundary distance on a timer."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={active ? onStop : onStart}
            disabled={starting}
            className={`mt-3 w-full ${active ? "btn-ghost" : "btn-primary"} py-2`}
          >
            {starting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-current border-t-transparent" />
                Starting…
              </>
            ) : active ? (
              <>
                <Icon name="stop" size={14} />
                Stop watching
              </>
            ) : (
              <>
                <Icon name="bell" size={14} />
                Watch {location.name ?? "this location"}
              </>
            )}
          </button>

          {error && <p className="mt-2 text-[11.5px] leading-snug band-no_go">{error}</p>}

          <p className="mt-2.5 border-t border-slate-200 pt-2 text-[10.5px] leading-relaxed muted dark:border-white/10">
            Watches are held in the server's memory: they stop when this tab closes or the
            backend restarts. There are no push notifications — the alert appears here and
            on the map while ORCA is open.
          </p>
        </section>

        {/* ── What it has found ───────────────────────────────────────── */}
        <div>
          <p className="eyebrow mb-1.5">
            Raised {alerts.length > 0 && `· ${alerts.length}`}
          </p>

          {alerts.length === 0 ? (
            <div className="card grid place-items-center gap-2 px-4 py-8 text-center">
              <Icon
                name={active ? "eye" : "bell"}
                size={22}
                className="text-slate-300 dark:text-slate-600"
              />
              <p className="text-[12.5px] muted">
                {active
                  ? "Nothing yet. ORCA only speaks up when something changes for the worse."
                  : "No alerts. Arm a watch to be told when conditions turn."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((alert, index) => {
                const style = SEVERITY[alert.severity] ?? SEVERITY.info;
                return (
                  <li
                    key={`${alert.raised_at}-${index}`}
                    className={`animate-slide-up rounded-xl border p-3 ${style.ring}`}
                    style={{
                      animationDelay: `${Math.min(index, 6) * 40}ms`,
                      animationFillMode: "backwards",
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon name={style.icon} size={16} className={`mt-px ${style.text}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] font-semibold leading-snug ${style.text}`}>
                          {alert.title}
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-slate-700 dark:text-slate-200">
                          {alert.detail}
                        </p>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] muted">
                          <span className="inline-flex items-center gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                            {style.label}
                          </span>
                          <span>·</span>
                          <span>{timeAgo(alert.raised_at)}</span>
                          {alert.evidence.length > 0 && (
                            <>
                              <span>·</span>
                              <span title={alert.evidence[0].source}>
                                {alert.evidence[0].source.split("(")[0].trim()}
                              </span>
                            </>
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
