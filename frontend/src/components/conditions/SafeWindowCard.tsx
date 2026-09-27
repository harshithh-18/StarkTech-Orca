/**
 * 72-Hour Safe Departure Passage Windows.
 */

import Icon from "@/components/common/Icon";
import { formatWindow } from "@/components/conditions/formatWindow";
import type { SafeWindow } from "@/types/orca";

interface Props {
  next: SafeWindow | null | undefined;
  windows: SafeWindow[];
  blockedBy: string[];
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
    <section className="card p-3.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-ocean-500/15 text-ocean-700 dark:text-cyan-300">
          <Icon name="clock" size={14} />
        </span>
        <h3 className="panel-title text-[13.5px]">Safe Departure Windows</h3>
        <span className="ml-auto font-mono text-[10px] font-semibold text-ocean-700 dark:text-cyan-300">
          72-Hour Horizon
        </span>
      </div>

      {next ? (
        <p className="text-[12.5px] leading-snug text-slate-800 dark:text-slate-100">
          Next{" "}
          <span
            className={
              next.quality === "clear"
                ? "font-bold band-go"
                : "font-bold band-caution"
            }
          >
            {next.quality}
          </span>{" "}
          window: <span className="font-bold">{formatWindow(next)}</span>{" "}
          <span className="muted font-mono font-medium">({next.hours} h safe passage)</span>
        </p>
      ) : (
        <p className="text-[12px] leading-snug band-no_go font-semibold">
          No uninterrupted run of four safe sailing hours within the next 72 hours.
        </p>
      )}

      {/* ── Visual 72h Timeline Strip ─────────────────────────────────── */}
      <div className="relative pt-1">
        <div className="flex h-7 gap-px overflow-hidden rounded-lg border border-sky-200/60 dark:border-white/10 shadow-inner">
          {cells.map((quality, index) => (
            <div
              key={index}
              title={`${new Date(origin + index * 3600_000).toLocaleString(undefined, {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              })} — ${
                quality === "clear"
                  ? "Safe: inside all small-craft limits"
                  : quality === "workable"
                    ? "Workable: marginal weather limits"
                    : "No-go: exceeds safety limits"
              }`}
              className={`h-full flex-1 transition-colors ${
                quality === "clear"
                  ? "bg-emerald-500/90 hover:bg-emerald-400"
                  : quality === "workable"
                    ? "bg-amber-500/85 hover:bg-amber-400"
                    : "bg-sky-200/70 hover:bg-sky-300/80 dark:bg-white/10 dark:hover:bg-white/20"
              }`}
            />
          ))}
        </div>

        {/* Midnight day markers */}
        <div className="relative mt-1 h-3.5">
          {dayBoundaries.map(({ index, date }) => (
            <span
              key={index}
              className="absolute font-mono text-[9px] font-bold text-slate-500 dark:text-slate-400"
              style={{ left: `${(index / hours) * 100}%` }}
            >
              {date.toLocaleDateString(undefined, { weekday: "short" })}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[10px] muted font-medium">
        {[
          ["bg-emerald-500", "Clear window"],
          ["bg-amber-500", "Workable window"],
          ["bg-sky-200 dark:bg-white/10", "Past safety limit"],
        ].map(([swatch, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${swatch}`} />
            {label}
          </span>
        ))}
      </div>

      {blockedBy.length > 0 && (
        <div className="border-t border-sky-100 pt-2 dark:border-white/10">
          <p className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
            Limiting factors holding vessels in harbour:
          </p>
          <ul className="mt-1 space-y-0.5">
            {blockedBy.slice(0, 3).map((reason, index) => (
              <li key={index} className="text-[11px] leading-snug band-caution flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-amber-500" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
