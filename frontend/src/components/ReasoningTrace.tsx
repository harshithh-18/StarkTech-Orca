/**
 * Reasoning Trace panel — the differentiator.
 *
 * Owner: D · Phase: P2
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

import { useState } from "react";

import type { TraceStatus, TraceStep } from "@/types/orca";

interface Props {
  steps: TraceStep[];
  streaming: boolean;
  connected?: boolean;
  defaultExpanded?: boolean;
}

const STATUS: Record<TraceStatus, { icon: string; className: string; label: string }> = {
  started: { icon: "⟳", className: "text-ocean-mid animate-spin-slow", label: "running" },
  ok: { icon: "✓", className: "text-verdict-go", label: "ok" },
  skipped: { icon: "–", className: "text-amber-600", label: "skipped" },
  failed: { icon: "✕", className: "text-verdict-nogo", label: "failed" },
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

  // Parallel specialists finish out of order — always order by seq, never by arrival.
  const ordered = [...steps].sort((a, b) => a.seq - b.seq);

  return (
    <section className="border-t border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-slate-50"
      >
        <span aria-hidden="true" className="text-xs text-slate-400">
          {expanded ? "▾" : "▸"}
        </span>
        <span className="text-sm font-semibold text-ocean-deep">How I decided this</span>
        <span className="text-xs text-slate-500">{summarise(ordered)}</span>
        {streaming && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-ocean-mid">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ocean-mid" />
            thinking…
          </span>
        )}
        {!streaming && connected === false && ordered.length > 0 && (
          // The panel still works without the socket — the POST response carries the
          // full trace. Say so rather than implying something is broken.
          <span className="ml-auto text-xs text-slate-400">shown after completion</span>
        )}
      </button>

      {expanded && (
        <ol className="max-h-52 overflow-y-auto px-4 pb-3">
          {ordered.length === 0 && (
            <li className="py-2 text-sm text-slate-400">
              Ask a question and the agent trace will appear here.
            </li>
          )}
          {ordered.map((step) => {
            const status = STATUS[step.status] ?? STATUS.ok;
            return (
              <li
                key={`${step.seq}-${step.agent}`}
                // Newly-arrived steps fade in; a step that just appears is easy to miss
                // when you're watching from the back of a room.
                className="flex animate-fade-in items-start gap-2 border-b border-slate-100 py-1.5 last:border-0"
              >
                <span
                  aria-label={status.label}
                  title={status.label}
                  className={`w-4 shrink-0 text-center text-sm font-bold ${status.className}`}
                >
                  {status.icon}
                </span>
                {/* Monospaced so the agent column aligns and scans cleanly. */}
                <span className="w-32 shrink-0 truncate font-mono text-xs text-ocean-mid">
                  {step.agent}
                </span>
                <span className="min-w-0 flex-1 text-xs leading-relaxed text-slate-700">
                  {step.message}
                  {step.source && (
                    <span className="ml-1.5 text-slate-400">· {step.source}</span>
                  )}
                </span>
                {step.duration_ms != null && step.duration_ms > 0 && (
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">
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
