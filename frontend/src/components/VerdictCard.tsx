/**
 * Safety verdict card.
 *
 * Owner: D · Phase: P2 · Polished P3
 *
 * The single most important element on the screen. A big GO / CAUTION / NO-GO badge, the
 * top two or three reasons, and the validity window.
 *
 * Design rule: **one glanceable verdict beats a wall of numbers.** The user may be reading
 * this at 4 a.m. on a phone before leaving harbour. Colour carries the meaning before the
 * words do — green, amber, red, and never rely on colour alone (add the word and an icon).
 */

import type { Evidence, Verdict } from "@/types/orca";

interface Props {
  verdict: Verdict | null;
  reasons: string[];
  evidence: Evidence[];
  validUntil?: string | null;
  usedMockData?: boolean;
}

interface VerdictStyle {
  icon: string;
  label: string;
  /** Gradient rather than a flat fill — the card should read as the hero element. */
  surface: string;
  ring: string;
  glow: string;
}

const STYLES: Record<Exclude<Verdict, "NOT_APPLICABLE">, VerdictStyle> = {
  GO: {
    icon: "✓",
    label: "Safe to go",
    surface: "bg-gradient-to-br from-emerald-500 to-teal-600",
    ring: "ring-emerald-400/40",
    glow: "shadow-[0_0_32px_-8px_rgb(16_185_129/0.6)]",
  },
  CAUTION: {
    icon: "!",
    label: "Caution",
    surface: "bg-gradient-to-br from-amber-500 to-orange-600",
    ring: "ring-amber-400/40",
    glow: "shadow-[0_0_32px_-8px_rgb(245_158_11/0.6)]",
  },
  NO_GO: {
    icon: "✕",
    label: "Do not go to sea",
    surface: "bg-gradient-to-br from-rose-600 to-red-700",
    ring: "ring-rose-400/40",
    glow: "shadow-[0_0_32px_-8px_rgb(244_63_94/0.65)]",
  },
};

/** The fields worth surfacing as chips — the ones the thresholds actually judge. */
const HEADLINE_FIELDS = [
  "wave_height",
  "wind_gusts_10m",
  "wind_speed_10m",
  "visibility",
  "cape",
];

/** Friendly labels; the raw field name is a machine identifier, not user copy. */
const FIELD_LABELS: Record<string, string> = {
  wave_height: "Waves",
  wind_gusts_10m: "Gusts",
  wind_speed_10m: "Wind",
  visibility: "Visibility",
  cape: "Storm energy",
};

function chipLabel(item: Evidence): string {
  const name = FIELD_LABELS[item.field] ?? item.field.replace(/_/g, " ");
  const unit = item.unit ? ` ${item.unit}` : "";
  return `${name} ${item.value}${unit}`;
}

export default function VerdictCard({
  verdict,
  reasons,
  evidence,
  validUntil,
  usedMockData,
}: Props) {
  // Render nothing at all rather than an empty card for non-safety answers.
  if (!verdict || verdict === "NOT_APPLICABLE") return null;

  const style = STYLES[verdict];
  const chips = HEADLINE_FIELDS.map((field) =>
    evidence.find((item) => item.field === field),
  ).filter((item): item is Evidence => item !== undefined);

  return (
    <section
      // Announced to screen readers as soon as it appears — this is the safety-critical
      // element on the page.
      role="status"
      aria-live="polite"
      className={`animate-slide-up overflow-hidden rounded-2xl ${style.surface} ${style.glow} text-white ring-1 ${style.ring}`}
    >
      <div className="relative p-4">
        {/* Soft radial highlight so the gradient reads as depth, not a flat block. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl"
        />

        <div className="relative flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-2xl font-black backdrop-blur-sm"
          >
            {style.icon}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
              {style.label}
            </h2>
            {validUntil && (
              <p className="text-[11px] text-white/85">
                Valid until {new Date(validUntil).toLocaleString()}
              </p>
            )}
          </div>

          {usedMockData && (
            // We degrade honestly — cached or demo data is never presented as live.
            <span className="shrink-0 rounded-full bg-white/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
              Demo data
            </span>
          )}
        </div>

        {reasons.length > 0 && (
          <ul className="relative mt-3 space-y-1.5 text-sm leading-snug">
            {/* Top three only. The full picture is in the evidence footnotes. */}
            {reasons.slice(0, 3).map((reason, index) => (
              <li
                key={index}
                className="flex animate-fade-in gap-2"
                style={{ animationDelay: `${index * 70}ms`, animationFillMode: "backwards" }}
              >
                <span aria-hidden="true" className="mt-1 text-white/60">
                  ▸
                </span>
                <span className="text-white/95">{reason}</span>
              </li>
            ))}
          </ul>
        )}

        {chips.length > 0 && (
          <div className="relative mt-3 flex flex-wrap gap-1.5">
            {chips.map((item, index) => (
              <span
                key={item.field}
                title={`${item.source}${
                  item.time ? ` · ${new Date(item.time).toLocaleString()}` : ""
                }`}
                style={{
                  animationDelay: `${120 + index * 50}ms`,
                  animationFillMode: "backwards",
                }}
                className="animate-fade-in cursor-help rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-white/30"
              >
                {chipLabel(item)}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
