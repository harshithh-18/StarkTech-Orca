/**
 * Safety verdict card — High-Visibility Maritime Safety Beacon.
 */

import Icon, { type IconName } from "@/components/common/Icon";
import { formatWindow } from "@/components/conditions/formatWindow";
import type { SafeWindow, Verdict } from "@/types/orca";

interface Props {
  verdict: Verdict | null | undefined;
  reasons: string[];
  nextWindow?: SafeWindow | null;
  usedMockData?: boolean;
  size?: "sm" | "lg";
}

interface Style {
  icon: IconName;
  label: string;
  sub: string;
  surface: string;
  chipBg: string;
  dotColor: string;
}

const STYLES: Record<Exclude<Verdict, "NOT_APPLICABLE">, Style> = {
  GO: {
    icon: "check",
    label: "Safe to Sail",
    sub: "All verified weather and marine telemetry remain within safe small-craft limits.",
    surface:
      "border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.03] to-teal-500/[0.06] dark:border-emerald-400/25 dark:bg-emerald-400/[0.08] shadow-sm shadow-emerald-500/10",
    chipBg: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
    dotColor: "bg-emerald-500",
  },
  CAUTION: {
    icon: "alert",
    label: "Caution Advised",
    sub: "Marginal coastal conditions detected. Inspect cautionary thresholds before departure.",
    surface:
      "border-amber-500/35 bg-gradient-to-br from-amber-500/[0.09] via-amber-500/[0.03] to-orange-500/[0.06] dark:border-amber-400/30 dark:bg-amber-400/[0.08] shadow-sm shadow-amber-500/10",
    chipBg: "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
    dotColor: "bg-amber-500",
  },
  NO_GO: {
    icon: "close",
    label: "Do Not Go To Sea",
    sub: "Hazardous marine thresholds exceeded. Small craft must remain in port.",
    surface:
      "border-rose-500/40 bg-gradient-to-br from-rose-500/[0.10] via-rose-500/[0.04] to-red-500/[0.08] dark:border-rose-400/35 dark:bg-rose-400/[0.10] shadow-sm shadow-rose-500/15",
    chipBg: "bg-rose-600 text-white shadow-sm shadow-rose-600/30",
    dotColor: "bg-rose-600",
  },
};

export default function VerdictCard({
  verdict,
  reasons,
  nextWindow,
  usedMockData,
  size = "lg",
}: Props) {
  if (!verdict || verdict === "NOT_APPLICABLE") return null;

  const style = STYLES[verdict];
  const large = size === "lg";

  return (
    <section
      role="status"
      aria-live="polite"
      className={`animate-slide-up rounded-2xl border ${style.surface} ${large ? "p-4" : "p-3"}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`grid shrink-0 place-items-center rounded-xl font-bold ${style.chipBg} ${
            large ? "h-11 w-11" : "h-8 w-8"
          }`}
        >
          <Icon name={style.icon} size={large ? 22 : 16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              className={`font-black leading-tight tracking-tight text-slate-900 dark:text-white ${
                large ? "text-[18px]" : "text-[14.5px]"
              }`}
            >
              {style.label}
            </h2>
            {usedMockData && (
              <span className="chip bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] py-0.5">
                Offline Cache
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11.5px] leading-snug muted">{style.sub}</p>
        </div>
      </div>

      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-black/[0.06] pt-3 dark:border-white/10">
          {reasons.slice(0, 3).map((reason, index) => (
            <li
              key={index}
              className="flex animate-fade-in items-start gap-2 text-[12px] leading-relaxed text-slate-800 dark:text-slate-200"
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: "backwards" }}
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.dotColor}`}
              />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {nextWindow && verdict !== "GO" && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 dark:bg-black/20 border border-sky-200/60 dark:border-white/10 shadow-sm">
          <Icon name="clock" size={15} className="text-ocean-600 dark:text-cyan-300" />
          <p className="text-[11.5px] leading-snug text-slate-800 dark:text-slate-200">
            <span className="font-bold">Next {nextWindow.quality} window:</span>{" "}
            {formatWindow(nextWindow)}{" "}
            <span className="muted font-mono">({nextWindow.hours} h safe passage)</span>
          </p>
        </div>
      )}
    </section>
  );
}
