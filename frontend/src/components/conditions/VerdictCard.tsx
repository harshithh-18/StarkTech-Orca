/**
 * Safety verdict card.
 *
 * Owner: D · Phase: P2 · Rebuilt P4
 *
 * The single most important element in the product. A large GO / CAUTION / NO-GO badge,
 * the reasons behind it, and — new in P4 — **when it will next be safe**, because "no"
 * without "then when?" is not advice, it is a refusal.
 *
 * Design rules, unchanged from P3 and still the right ones:
 *   - one glanceable verdict beats a wall of numbers
 *   - colour carries the meaning before the words do
 *   - never colour alone: always the word and an icon too
 */

import Icon, { type IconName } from "@/components/common/Icon";
import { formatWindow } from "@/components/conditions/formatWindow";
import type { SafeWindow, Verdict } from "@/types/orca";

interface Props {
  verdict: Verdict | null | undefined;
  reasons: string[];
  /** The next safe departure window, when the answer carries one. */
  nextWindow?: SafeWindow | null;
  usedMockData?: boolean;
  /** Rendered small inside the answer rail, large on the conditions dashboard. */
  size?: "sm" | "lg";
}

interface Style {
  icon: IconName;
  label: string;
  sub: string;
  surface: string;
  chipBg: string;
}

const STYLES: Record<Exclude<Verdict, "NOT_APPLICABLE">, Style> = {
  GO: {
    icon: "check",
    label: "Safe to go",
    sub: "All checked conditions are inside small-craft limits.",
    surface:
      "border-emerald-500/25 bg-emerald-500/[0.07] dark:border-emerald-400/25 dark:bg-emerald-400/[0.07]",
    chipBg: "bg-emerald-500 text-white",
  },
  CAUTION: {
    icon: "alert",
    label: "Caution",
    sub: "Conditions are marginal. Read the reasons before deciding.",
    surface:
      "border-amber-500/30 bg-amber-500/[0.08] dark:border-amber-400/30 dark:bg-amber-400/[0.08]",
    chipBg: "bg-amber-500 text-white",
  },
  NO_GO: {
    icon: "close",
    label: "Do not go to sea",
    sub: "At least one condition is past the small-craft limit.",
    surface:
      "border-rose-500/35 bg-rose-500/[0.09] dark:border-rose-400/35 dark:bg-rose-400/[0.09]",
    chipBg: "bg-rose-600 text-white",
  },
};

export default function VerdictCard({
  verdict,
  reasons,
  nextWindow,
  usedMockData,
  size = "lg",
}: Props) {
  // Render nothing rather than an empty card for non-safety answers.
  if (!verdict || verdict === "NOT_APPLICABLE") return null;

  const style = STYLES[verdict];
  const large = size === "lg";

  return (
    <section
      // Announced to screen readers as soon as it appears — this is the safety-critical
      // element on the page.
      role="status"
      aria-live="polite"
      className={`animate-slide-up rounded-xl border ${style.surface} ${large ? "p-4" : "p-3"}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`grid shrink-0 place-items-center rounded-lg ${style.chipBg} ${
            large ? "h-10 w-10" : "h-8 w-8"
          }`}
        >
          <Icon name={style.icon} size={large ? 20 : 17} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              className={`font-bold leading-tight tracking-tight text-slate-900 dark:text-white ${
                large ? "text-lg" : "text-[15px]"
              }`}
            >
              {style.label}
            </h2>
            {usedMockData && (
              <span
                title="Some values came from the offline demo cache, not a live model."
                className="chip bg-amber-500/15 text-amber-700 dark:text-amber-300"
              >
                Demo data
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] leading-snug muted">{style.sub}</p>
        </div>
      </div>

      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-black/[0.06] pt-3 dark:border-white/10">
          {/* Top three only. The full picture is in the evidence list. */}
          {reasons.slice(0, 3).map((reason, index) => (
            <li
              key={index}
              className="flex animate-fade-in gap-2 text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200"
              style={{ animationDelay: `${index * 60}ms`, animationFillMode: "backwards" }}
            >
              <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-40" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {nextWindow && verdict !== "GO" && (
        <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-black/[0.04] px-3 py-2 dark:bg-white/[0.06]">
          <Icon name="clock" size={15} className="text-ocean-600 dark:text-ocean-300" />
          <p className="text-[12px] leading-snug text-slate-700 dark:text-slate-200">
            <span className="font-semibold">Next {nextWindow.quality} window:</span>{" "}
            {formatWindow(nextWindow)}{" "}
            <span className="muted">({nextWindow.hours} h)</span>
          </p>
        </div>
      )}
    </section>
  );
}
