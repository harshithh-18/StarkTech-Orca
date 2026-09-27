/**
 * Reasoning Trace — Live Collaborative Multi-Agent Stream.
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
    className: "text-ocean-600 dark:text-cyan-300",
    label: "running",
    spin: true,
  },
  ok: { icon: "check", className: "band-go", label: "done" },
  skipped: { icon: "close", className: "band-caution", label: "skipped" },
  failed: { icon: "alert", className: "band-no_go", label: "failed" },
};

const AGENT_LABEL: Record<string, string> = {
  language_intent: "Language & Intent",
  planner: "Supervisor Planner",
  weather: "Weather Intelligence",
  sea_state: "Sea-State & Waves",
  marine_data: "Marine Biology & PFZ",
  geospatial: "Geospatial & IMBL",
  route: "Least-Risk Routing",
  risk: "Risk Synthesis",
  visualization: "Chart & Visualization",
  explainability: "Explainability Synthesis",
};

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

  const open = expanded && steps.length > 0;
  const ordered = [...steps].sort((a, b) => a.seq - b.seq);

  useEffect(() => {
    if (streaming && open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [ordered.length, streaming, open]);

  return (
    <section className="shrink-0 border-t border-sky-200/80 bg-white/95 backdrop-blur-md dark:border-cyan-500/15 dark:bg-abyss-900/95 shadow-md">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-sky-50/60 dark:hover:bg-white/[0.03]"
      >
        <Icon
          name="chevron"
          size={13}
          className={`text-slate-400 transition-transform duration-200 ${
            open ? "rotate-90 text-ocean-600 dark:text-cyan-300" : ""
          }`}
        />
        <Logo size={20} rounded="rounded-md" />

        <span className="text-[12.5px] font-bold text-slate-900 dark:text-slate-100">
          Agent Reasoning Pipeline
        </span>

        <span className="hidden font-mono text-[10.5px] text-ocean-700 dark:text-cyan-300 sm:inline font-semibold">
          {summarise(ordered)}
        </span>

        {streaming ? (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-ocean-500/10 px-2 py-0.5 text-[10.5px] font-bold text-ocean-700 dark:text-cyan-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-cyan-400" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            Synthesizing agents…
          </span>
        ) : (
          !connected &&
          ordered.length > 0 && (
            <span className="ml-auto text-[10.5px] muted">Batch completed</span>
          )
        )}
      </button>

      {open && (
        <ol ref={listRef} className="max-h-40 overflow-y-auto px-4 pb-3 sm:max-h-48 space-y-1">
          {ordered.map((step, index) => {
            const status = STATUS[step.status] ?? STATUS.ok;
            return (
              <li
                key={`${step.seq}-${step.agent}-${step.status}`}
                style={{
                  animationDelay: `${Math.min(index, 8) * 25}ms`,
                  animationFillMode: "backwards",
                }}
                className="group relative flex animate-fade-in items-start gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-sky-50/50 dark:hover:bg-white/[0.02]"
              >
                {/* Timeline connector */}
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[15px] top-6 w-px bg-sky-200 group-last:hidden dark:bg-white/10"
                />

                <span
                  title={status.label}
                  className={`relative z-10 mt-[2px] ${status.className} ${
                    status.spin ? "animate-spin-slow" : ""
                  }`}
                >
                  <Icon name={status.icon} size={14} />
                </span>

                <span className="w-[124px] shrink-0 truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  {AGENT_LABEL[step.agent] ?? step.agent}
                </span>

                <span className="min-w-0 flex-1 text-[11px] leading-relaxed muted">
                  {step.message}
                  {step.source && (
                    <span className="ml-1.5 font-mono text-[10px] text-ocean-700 dark:text-cyan-300">
                      [{step.source}]
                    </span>
                  )}
                </span>

                {step.duration_ms != null && step.duration_ms > 0 && (
                  <span className="shrink-0 rounded-md bg-sky-100/70 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-ocean-800 dark:bg-white/5 dark:text-cyan-300">
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
