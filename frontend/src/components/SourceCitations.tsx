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

export default function SourceCitations(_props: Props) {
  // TODO(P3, D): list each evidence value with its source and validity time
  // TODO(P3, D): group by source so a five-field answer doesn't print "Open-Meteo" five times
  // TODO(P3, D): licence lines from `attribution` in the footer — Open-Meteo CC-BY and
  //              Copernicus both REQUIRE credit, and it reads as professionalism
  // TODO(P3, D): visible badge when usedMockData — cached/demo data is never presented
  //              as live
  return <div>{/* TODO(P3, D) */}</div>;
}
