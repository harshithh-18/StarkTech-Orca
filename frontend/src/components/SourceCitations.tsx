/**
 * Source citations.
 *
 * Owner: D (with C) · Phase: P3
 *
 * Every answer footnotes its data sources and timestamps. This is the visible half of the
 * evidence array — "here's exactly why" instead of "trust me", which is the entire point
 * of the problem statement.
 */

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
  if (evidence.length === 0 && attribution.length === 0) return null;

  const groups = groupBySource(evidence);

  return (
    <footer className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
      {usedMockData && (
        <p className="mb-2 inline-block rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
          Some values were served from cached demo data, not a live feed.
        </p>
      )}

      {groups.size > 0 && (
        <div className="space-y-1">
          <p className="font-semibold text-ocean-deep">Sources</p>
          {[...groups.entries()].map(([source, items]) => {
            const time = latestTime(items);
            return (
              <p key={source} className="leading-relaxed">
                <span className="text-slate-500">
                  {items.map((item) => item.field.replace(/_/g, " ")).join(", ")}
                </span>
                {" — "}
                <span className="text-slate-700">{source}</span>
                {time && (
                  <span className="text-slate-400">
                    {" "}
                    · valid {new Date(time).toLocaleString()}
                  </span>
                )}
              </p>
            );
          })}
        </div>
      )}

      {attribution.length > 0 && (
        // Open-Meteo (CC-BY) and Copernicus both REQUIRE credit. It is also the cheapest
        // possible signal of professionalism in front of a judge.
        <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-400">
          {attribution.join(" · ")}
        </p>
      )}
    </footer>
  );
}
