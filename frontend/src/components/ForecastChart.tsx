/**
 * Forecast and trend charts.
 *
 * Owner: D · Phase: P2
 *
 * Renders a ChartSpec from the response — 48-hour wave and wind, tide curve, chlorophyll
 * trend for the "why has productivity declined?" answer. Recharts.
 */

import type { ChartSpec } from "@/types/orca";

interface Props {
  spec: ChartSpec;
  /** Draw a horizontal rule at the small-craft threshold, e.g. 2.5 m. */
  thresholdY?: number | null;
}

export default function ForecastChart(_props: Props) {
  // TODO(P2, D): switch on spec.kind; render series from spec.series
  // TODO(P2, D): draw the threshold line — seeing the forecast cross 2.5 m explains the
  //              verdict faster than any sentence can
  // TODO(P2, D): null y values render as gaps, never as zero. A zero-metre wave reads as
  //              "flat calm" when it actually means "no data".
  // TODO(P3, D): responsive container; charts must not overflow on a phone
  return <div>{/* TODO(P2, D) */}</div>;
}
