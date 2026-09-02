/**
 * Safety verdict card.
 *
 * Owner: D · Phase: P2
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

/** Icon, label and palette per verdict. The icon and word carry the meaning without colour. */
const STYLES: Record<
  Exclude<Verdict, "NOT_APPLICABLE">,
  { icon: string; label: string; bg: string; ring: string; text: string }
> = {
  GO: {
    icon: "✓",
    label: "Safe to go",
    bg: "bg-verdict-go",
    ring: "ring-green-700",
    text: "text-white",
  },
  CAUTION: {
    icon: "!",
    label: "Caution",
    bg: "bg-verdict-caution",
    ring: "ring-amber-700",
    text: "text-white",
  },
  NO_GO: {
    icon: "✕",
    label: "Do not go to sea",
    bg: "bg-verdict-nogo",
    ring: "ring-red-800",
    text: "text-white",
  },
};

/** Turn an evidence entry into a compact "wave height 1.26 m" chip label. */
function chipLabel(item: Evidence): string {
  const name = item.field.replace(/_10m$/, "").replace(/_/g, " ");
  const unit = item.unit ? ` ${item.unit}` : "";
  return `${name} ${item.value}${unit}`;
}

/** The fields worth surfacing as chips — the ones the thresholds actually judge. */
const HEADLINE_FIELDS = [
  "wave_height",
  "wind_gusts_10m",
  "wind_speed_10m",
  "visibility",
  "cape",
];

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
      className={`rounded-xl ${style.bg} ${style.text} p-4 shadow-lg ring-1 ${style.ring}`}
      // Announced to screen readers as soon as it appears — this is the safety-critical
      // element on the page.
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/25 text-2xl font-bold"
        >
          {style.icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold leading-tight sm:text-2xl">{style.label}</h2>
          {validUntil && (
            <p className="text-xs opacity-90">
              Valid until {new Date(validUntil).toLocaleString()}
            </p>
          )}
        </div>
        {usedMockData && (
          // We degrade honestly — cached or demo data is never presented as live.
          <span className="ml-auto shrink-0 rounded bg-white/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
            Demo data
          </span>
        )}
      </div>

      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm leading-snug">
          {/* Top three only. The full picture is in the evidence footnotes. */}
          {reasons.slice(0, 3).map((reason, index) => (
            <li key={index} className="flex gap-2">
              <span aria-hidden="true" className="opacity-70">
                •
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((item) => (
            <span
              key={item.field}
              title={`${item.source}${item.time ? ` · ${new Date(item.time).toLocaleString()}` : ""}`}
              className="rounded bg-white/20 px-2 py-0.5 text-xs font-medium"
            >
              {chipLabel(item)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
