/**
 * Source citations.
 *
 * Owner: D (with C) · Phase: P3
 *
 * Every answer footnotes its data sources and timestamps. This is the visible half of the
 * evidence array — "here's exactly why" instead of "trust me", which is the entire point
 * of the problem statement.
 */

import { useState } from "react";

import type { Evidence } from "@/types/orca";

interface Props {
  evidence: Evidence[];
  attribution: string[];
  usedMockData?: boolean;
}

/** Group evidence by source so a five-field answer doesn't print "Open-Meteo" five times. */
function groupBySource(evidence: Evidence[]): Map<string, Evidence[]> {
  const groups = new Map<string, Evidence[]>();
  for (const item of evidence) {
    const existing = groups.get(item.source);
    if (existing) existing.push(item);
    else groups.set(item.source, [item]);
  }
  return groups;
}

/** The most recent validity time in a group — what the citation is "as of". */
function latestTime(items: Evidence[]): string | null {
  const times = items
    .map((item) => item.time)
    .filter((time): time is string => Boolean(time))
    .sort();
  return times.length ? times[times.length - 1] : null;
}

export default function SourceCitations({ evidence, attribution, usedMockData }: Props) {
  const [open, setOpen] = useState(false);

  if (evidence.length === 0 && attribution.length === 0) return null;

  const groups = groupBySource(evidence);

  return (
    <footer className="border-t border-slate-200 bg-slate-50 text-[11px] text-slate-600 transition-colors dark:border-white/10 dark:bg-abyss-950 dark:text-slate-400">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-white/5"
      >
        <span
          aria-hidden="true"
          className={`text-[8px] text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        <span className="font-semibold text-slate-500 dark:text-slate-400">Sources</span>
        {groups.size > 0 && (
          <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {groups.size}
          </span>
        )}

        {usedMockData && (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
            demo data
          </span>
        )}

        <span className="ml-auto truncate pl-2 text-[10px] text-slate-400 dark:text-slate-500">
          {attribution[0] ?? ""}
        </span>
      </button>

      {open && (
        <div className="animate-fade-in space-y-2 px-4 pb-3">
          {usedMockData && (
            <p className="rounded-lg bg-amber-100 px-2 py-1 font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              Some values were served from cached demo data, not a live feed.
            </p>
          )}

          {[...groups.entries()].map(([source, items]) => {
            const time = latestTime(items);
            return (
              <p key={source} className="leading-relaxed">
                <span className="text-slate-500 dark:text-slate-400">
                  {items.map((item) => item.field.replace(/_/g, " ")).join(", ")}
                </span>
                {" — "}
                <span className="font-medium text-ocean-700 dark:text-ocean-300">
                  {source}
                </span>
                {time && (
                  <span className="text-slate-400 dark:text-slate-500">
                    {" "}
                    · valid {new Date(time).toLocaleString()}
                  </span>
                )}
              </p>
            );
          })}

          {attribution.length > 0 && (
            // Open-Meteo (CC-BY) and Copernicus both REQUIRE credit. It is also the
            // cheapest possible signal of professionalism in front of a judge.
            <p className="border-t border-slate-200 pt-2 text-[10px] text-slate-400 dark:border-white/10 dark:text-slate-500">
              {attribution.join(" · ")}
            </p>
          )}
        </div>
      )}
    </footer>
  );
}
