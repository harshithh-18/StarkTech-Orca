/**
 * Reasoning Trace — the differentiator.
 *
 * Owner: D · Phase: P2 · Rebuilt P4
 *
 * > Judges cannot see planning or tool selection unless we show it to them. Steps stream
 * > in live over the WebSocket as each agent completes, so the user watches the platform
 * > think rather than staring at a spinner.
 *
 *   ✓ language_intent   Intent=safety_check, lang=te, resolved Kakinada→16.99,82.24
 *   ✓ planner           Planner → [weather, sea_state]
 *   ⟳ sea_state         Fetching Open-Meteo Marine…
 *   – marine_data       Skipped: not required for this intent
 *   ✕ geospatial        Skipped: no boundary data loaded
 *
 * **Show the skipped and failed steps.** A visible skip demonstrates that the system knows
 * what it does not know, which is the entire argument for evidence-based answers — hiding
 * them would make the trace decorative.
 */

import { useEffect, useRef, useState } from "react";

import Icon, { type IconName } from "@/components/common/Icon";
import Logo from "@/components/common/Logo";
import type { TraceStatus, TraceStep } from "@/types/orca";

interface Props {
  steps: TraceStep[];
  streaming: boolean;
  connected: boolean;
  defaultExpanded?: boolean;
}

const STATUS: Record<
  TraceStatus,
  { icon: IconName; className: string; label: string; spin?: boolean }
> = {
  started: {
    icon: "refresh",
    className: "text-ocean-600 dark:text-ocean-300",
    label: "running",
    spin: true,
  },
  ok: { icon: "check", className: "band-go", label: "done" },
  skipped: { icon: "close", className: "band-caution", label: "skipped" },
  failed: { icon: "alert", className: "band-no_go", label: "failed" },
};

/** Human names for the agents. The raw module name is a developer's label. */
const AGENT_LABEL: Record<string, string> = {
  language_intent: "Language & intent",
  planner: "Planner",
  weather: "Weather",
  sea_state: "Sea state",
  marine_data: "Marine data",
  geospatial: "Geospatial",
  route: "Route",
  risk: "Risk",
  visualization: "Visualization",
  explainability: "Explainability",
};

/** "5 agents · 3 sources · 2.1 s" — what the header shows. */
function summarise(steps: TraceStep[]): string {
  if (steps.length === 0) return "";

  const agents = new Set(steps.map((step) => step.agent));
  const sources = new Set(steps.map((step) => step.source).filter(Boolean));
  const totalMs = steps.reduce((sum, step) => sum + (step.duration_ms ?? 0), 0);

  const parts = [`${agents.size} agent${agents.size === 1 ? "" : "s"}`];
  if (sources.size) parts.push(`${sources.size} source${sources.size === 1 ? "" : "s"}`);
  if (totalMs) parts.push(`${(totalMs / 1000).toFixed(1)} s`);

  const skipped = steps.filter((step) => step.status === "skipped").length;
  if (skipped) parts.push(`${skipped} skipped`);

  return parts.join(" · ");
}

export default function ReasoningTrace({
  steps,
  streaming,
  connected,
  defaultExpanded = true,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const listRef = useRef<HTMLOListElement>(null);

  // Nothing to show yet: collapse to the header rather than reserving a fifth of the
  // screen for the words "ask something". It opens on its own the moment steps arrive.
  const open = expanded && steps.length > 0;

  // Parallel specialists finish out of order — always order by seq, never by arrival.
  const ordered = [...steps].sort((a, b) => a.seq - b.seq);

  // Follow the newest step while streaming, so the panel doesn't need scrolling on stage.
  useEffect(() => {
    if (streaming && open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [ordered.length, streaming, open]);

  return (
    <section className="shrink-0 border-t border-slate-200 bg-white dark:border-white/10 dark:bg-abyss-900">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]"
      >
        <Icon
          name="chevron"
          size={13}
          className={`text-slate-400 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        />
        <Logo size={18} rounded="rounded-md" />

        <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          How I decided this
        </span>

        <span className="hidden text-[11px] muted sm:inline">{summarise(ordered)}</span>

        {streaming ? (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-ocean-600 dark:text-ocean-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-ocean-400" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ocean-500" />
            </span>
            thinking…
          </span>
        ) : (
          !connected &&
          ordered.length > 0 && (
            // The panel still works without the socket — the POST response carries the
            // full trace. Say so rather than implying something is broken.
            <span className="ml-auto text-[11px] muted">filled in after the answer</span>
          )
        )}
      </button>

      {open && (
        <ol ref={listRef} className="max-h-40 overflow-y-auto px-4 pb-3 sm:max-h-48">
          {ordered.map((step, index) => {
            const status = STATUS[step.status] ?? STATUS.ok;
            return (
              <li
                key={`${step.seq}-${step.agent}-${step.status}`}
                // Newly-arrived steps fade in; a step that just appears is easy to miss
                // when you're watching from the back of a room.
                style={{
                  animationDelay: `${Math.min(index, 8) * 30}ms`,
                  animationFillMode: "backwards",
                }}
                className="group relative flex animate-fade-in items-start gap-2.5 border-b border-slate-100 py-1.5 last:border-0 dark:border-white/[0.06]"
              >
                {/* Timeline rail joining the steps into one run. */}
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[7px] top-6 w-px bg-slate-200 group-last:hidden dark:bg-white/10"
                />

                <span
                  title={status.label}
                  className={`relative z-10 mt-[3px] ${status.className} ${
                    status.spin ? "animate-spin-slow" : ""
                  }`}
                >
                  <Icon name={status.icon} size={13} />
                </span>

                <span className="w-[104px] shrink-0 truncate text-[11.5px] font-medium text-slate-700 dark:text-slate-200">
                  {AGENT_LABEL[step.agent] ?? step.agent}
                </span>

                <span className="min-w-0 flex-1 text-[11.5px] leading-relaxed muted">
                  {step.message}
                  {step.source && (
                    <span className="ml-1.5 opacity-70">· {step.source}</span>
                  )}
                </span>

                {step.duration_ms != null && step.duration_ms > 0 && (
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] muted dark:bg-white/5">
                    {step.duration_ms} ms
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
