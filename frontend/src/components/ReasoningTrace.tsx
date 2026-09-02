/**
 * Reasoning Trace panel — the differentiator.
 *
 * Owner: D · Phase: P2 · Polished P3
 *
 * > This component is why the project looks agentic. Judges cannot see planning or tool
 * > selection unless we show it to them. Steps stream in live over the WebSocket as each
 * > agent completes, so the user literally watches the platform think.
 *
 * Collapsible, headed "How I decided this", **expanded by default during the demo**.
 *
 *   ✓ language_intent   Intent=safety_check, lang=te, resolved Kakinada→16.99,82.24
 *   ✓ planner           Planner → [Weather, Sea-state, Risk]
 *   ⟳ sea_state         Fetching Open-Meteo Marine…
 *   – marine_data       Skipped: not required for this intent
 *   ✗ imd_bulletins     Failed: timeout — continuing without cyclone data
 *
 * Status icons: started ⟳ · ok ✓ · skipped – · failed ✗
 *
 * Show the skipped and failed steps. A visible skip demonstrates that the system knows
 * what it doesn't know — that's the whole argument for evidence-based answers.
 */

import { useEffect, useRef, useState } from "react";

import type { TraceStatus, TraceStep } from "@/types/orca";

interface Props {
  steps: TraceStep[];
  streaming: boolean;
  connected?: boolean;
  defaultExpanded?: boolean;
}

const STATUS: Record<
  TraceStatus,
  { icon: string; className: string; label: string; dot: string }
> = {
  started: {
    icon: "⟳",
    className: "text-ocean-500 animate-spin-slow dark:text-ocean-300",
    label: "running",
    dot: "bg-ocean-400",
  },
  ok: {
    icon: "✓",
    className: "text-emerald-600 dark:text-emerald-400",
    label: "ok",
    dot: "bg-emerald-500",
  },
  skipped: {
    icon: "–",
    className: "text-amber-600 dark:text-amber-400",
    label: "skipped",
    dot: "bg-amber-500",
  },
  failed: {
    icon: "✕",
    className: "text-rose-600 dark:text-rose-400",
    label: "failed",
    dot: "bg-rose-500",
  },
};

/** "4 agents · 2 sources · 1.2 s" — what the header shows when collapsed. */
function summarise(steps: TraceStep[]): string {
  if (steps.length === 0) return "no steps yet";

  const agents = new Set(steps.map((s) => s.agent));
  const sources = new Set(steps.map((s) => s.source).filter(Boolean));
  const totalMs = steps.reduce((sum, s) => sum + (s.duration_ms ?? 0), 0);

  const parts = [`${agents.size} agent${agents.size === 1 ? "" : "s"}`];
  if (sources.size) parts.push(`${sources.size} source${sources.size === 1 ? "" : "s"}`);
  if (totalMs) parts.push(`${(totalMs / 1000).toFixed(1)} s`);

  const skipped = steps.filter((s) => s.status === "skipped").length;
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

  // Parallel specialists finish out of order — always order by seq, never by arrival.
  const ordered = [...steps].sort((a, b) => a.seq - b.seq);

  // Follow the newest step while streaming, so the panel doesn't need scrolling on stage.
  useEffect(() => {
    if (streaming && expanded && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [ordered.length, streaming, expanded]);

  return (
    <section className="border-t border-slate-200 bg-white transition-colors dark:border-white/10 dark:bg-abyss-900">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
      >
        <span
          aria-hidden="true"
          className={`text-[10px] text-slate-400 transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>

        <span className="bg-gradient-to-r from-ocean-600 to-ocean-400 bg-clip-text text-sm font-bold text-transparent dark:from-ocean-300 dark:to-ocean-100">
          How I decided this
        </span>

        <span className="hidden text-[11px] text-slate-500 sm:inline dark:text-slate-400">
          {summarise(ordered)}
        </span>

        {streaming ? (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-ocean-600 dark:text-ocean-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-ocean-400" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ocean-500" />
            </span>
            thinking…
          </span>
        ) : (
          connected === false &&
          ordered.length > 0 && (
            // The panel still works without the socket — the POST response carries the
            // full trace. Say so rather than implying something is broken.
            <span className="ml-auto text-[11px] text-slate-400">shown after completion</span>
          )
        )}
      </button>

      {expanded && (
        <ol
          ref={listRef}
          className="max-h-44 overflow-y-auto px-4 pb-3 sm:max-h-52"
        >
          {ordered.length === 0 && (
            <li className="py-3 text-sm text-slate-400 dark:text-slate-500">
              Ask a question and each agent will report here as it runs.
            </li>
          )}

          {ordered.map((step, index) => {
            const status = STATUS[step.status] ?? STATUS.ok;
            return (
              <li
                key={`${step.seq}-${step.agent}`}
                // Newly-arrived steps fade in; a step that just appears is easy to miss
                // when you're watching from the back of a room.
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms`, animationFillMode: "backwards" }}
                className="group relative flex animate-fade-in items-start gap-2.5 border-b border-slate-100 py-2 last:border-0 dark:border-white/5"
              >
                {/* Timeline rail joining the steps into one run. */}
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[7px] top-6 w-px bg-slate-200 group-last:hidden dark:bg-white/10"
                />

                <span
                  aria-label={status.label}
                  title={status.label}
                  className={`relative z-10 mt-0.5 w-4 shrink-0 text-center text-sm font-bold ${status.className}`}
                >
                  {status.icon}
                </span>

                {/* Monospaced so the agent column aligns and scans cleanly. */}
                <span className="w-28 shrink-0 truncate font-mono text-[11px] font-medium text-ocean-700 sm:w-32 dark:text-ocean-300">
                  {step.agent}
                </span>

                <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-700 sm:text-xs dark:text-slate-300">
                  {step.message}
                  {step.source && (
                    <span className="ml-1.5 text-slate-400 dark:text-slate-500">
                      · {step.source}
                    </span>
                  )}
                </span>

                {step.duration_ms != null && step.duration_ms > 0 && (
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-white/5 dark:text-slate-400">
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
