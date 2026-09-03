/**
 * When is it next safe to sail?
 *
 * Owner: D · Phase: P4
 *
 * The backend scores every hour of the forecast against the same thresholds that decide
 * the verdict, then groups the runs of safe hours (`services/safe_window.py`). This draws
 * them as a 72-hour strip, one cell per hour, so the shape of the week is visible at a
 * glance: three green blocks with a red band through Thursday reads faster than any
 * sentence about it.
 *
 * The strip is derived from the returned windows rather than from the raw hourly bands,
 * because those windows are what the safety logic actually committed to. Drawing the
 * hours independently would risk a strip that disagrees with the window above it.
 */

import Icon from "@/components/common/Icon";
import { formatWindow } from "@/components/conditions/formatWindow";
import type { SafeWindow } from "@/types/orca";

interface Props {
  next: SafeWindow | null | undefined;
  windows: SafeWindow[];
  blockedBy: string[];
  /** Start of the strip. Defaults to now. */
  from?: Date;
  hours?: number;
}

export default function SafeWindowCard({
  next,
  windows,
  blockedBy,
  from = new Date(),
  hours = 72,
}: Props) {
  const origin = from.getTime();

  // Mark each hour of the strip according to which window, if any, covers it.
  const cells = Array.from({ length: hours }, (_, index) => {
    const at = origin + index * 3600_000;
    const covering = windows.find((window) => {
      const start = new Date(window.start).getTime();
      const end = new Date(window.end).getTime();
      return at >= start - 1800_000 && at <= end + 1800_000;
    });
    return covering?.quality ?? null;
  });

  const dayBoundaries = cells
    .map((_, index) => ({ index, date: new Date(origin + index * 3600_000) }))
    .filter(({ date }) => date.getHours() === 0);

  return (
    <section className="card p-3">
      <div className="flex items-center gap-2">
        <Icon name="clock" size={15} className="text-ocean-600 dark:text-ocean-300" />
        <h3 className="panel-title">Departure windows</h3>
        <span className="ml-auto text-[10.5px] muted">next 72 h</span>
      </div>

      {next ? (
        <p className="mt-2.5 text-[13px] leading-snug text-slate-800 dark:text-slate-100">
          Next{" "}
          <span
            className={
              next.quality === "clear"
                ? "font-semibold band-go"
                : "font-semibold band-caution"
            }
          >
            {next.quality}
          </span>{" "}
          window <span className="font-semibold">{formatWindow(next)}</span>{" "}
          <span className="muted">({next.hours} h)</span>
        </p>
      ) : (
        <p className="mt-2.5 text-[13px] leading-snug band-no_go">
          No run of four or more safe hours anywhere in the next 72 hours.
        </p>
      )}

      {/* ── The strip ──────────────────────────────────────────────────── */}
      <div className="relative mt-3">
        <div className="flex h-7 gap-px overflow-hidden rounded-md">
          {cells.map((quality, index) => (
            <div
              key={index}
              title={`${new Date(origin + index * 3600_000).toLocaleString(undefined, {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              })} — ${
                quality === "clear"
                  ? "inside all limits"
                  : quality === "workable"
                    ? "marginal, but workable"
                    : "past a small-craft limit"
              }`}
              className={`h-full flex-1 transition-colors ${
                quality === "clear"
                  ? "bg-emerald-500/80"
                  : quality === "workable"
                    ? "bg-amber-500/70"
                    : "bg-slate-300 dark:bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Midnight ticks, so "Thursday" is locatable on the strip. */}
        <div className="relative mt-1 h-3.5">
          {dayBoundaries.map(({ index, date }) => (
            <span
              key={index}
              className="absolute text-[9.5px] font-medium muted"
              style={{ left: `${(index / hours) * 100}%` }}
            >
              {date.toLocaleDateString(undefined, { weekday: "short" })}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] muted">
        {[
          ["bg-emerald-500/80", "Clear"],
          ["bg-amber-500/70", "Workable"],
          ["bg-slate-300 dark:bg-white/10", "Past a limit"],
        ].map(([swatch, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${swatch}`} />
            {label}
          </span>
        ))}
      </div>

      {blockedBy.length > 0 && (
        <div className="mt-2.5 border-t border-slate-200 pt-2.5 dark:border-white/10">
          <p className="text-[10.5px] font-medium muted">Keeping you in harbour right now</p>
          <ul className="mt-1 space-y-0.5">
            {blockedBy.slice(0, 3).map((reason, index) => (
              <li key={index} className="text-[11.5px] leading-snug band-caution">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
