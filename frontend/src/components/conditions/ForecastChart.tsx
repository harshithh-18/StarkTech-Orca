/**
 * Forecast and trend charts.
 *
 * Owner: D · Phase: P2 · Rebuilt P4
 *
 * Renders a ChartSpec from the backend — 48-hour wave and gusts, the tide curve, the
 * chlorophyll trend behind "why has productivity declined?".
 *
 * Two marks carry most of the meaning and both are drawn here rather than left to the
 * reader:
 *
 *   - the **small-craft limit**, as a dashed rule. Watching the forecast cross it explains
 *     a CAUTION verdict faster than any sentence can.
 *   - **now**, as a vertical rule. Without it a 48-hour series gives no sense of how much
 *     of it has already happened.
 *
 * Recharts renders SVG, which does not inherit Tailwind's dark variants — every colour has
 * to be passed explicitly or the axes stay near-black on a dark panel.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartSpec } from "@/types/orca";

interface Props {
  spec: ChartSpec;
  isDark?: boolean;
  height?: number;
}

/** Per-chart accent, so wave / wind / tide / chlorophyll are distinguishable at a glance. */
const ACCENT: Record<string, string> = {
  wave_48h: "#06b6d4",
  wind_48h: "#f59e0b",
  tide: "#38bdf8",
  chlorophyll_trend: "#22c55e",
  sst_trend: "#f43f5e",
};

const FALLBACK_ACCENT = "#06b6d4";

/**
 * The small-craft limits, mirrored from `services/risk_rules.THRESHOLDS`.
 *
 * Duplicated on purpose rather than fetched: it is a rule line on a chart, and a chart
 * that cannot draw its limit until a second request resolves is worse than one that
 * draws it from a constant. `backend/tests/test_risk_rules.py` pins the values, and this
 * comment is the pointer for whoever changes them.
 */
const LIMIT: Record<string, { value: number; label: string }> = {
  wave_48h: { value: 2.5, label: "2.5 m no-go" },
  wind_48h: { value: 55, label: "55 km/h no-go" },
};

/** Merge the spec's series into the row shape Recharts wants, keyed by x. */
function toRows(spec: ChartSpec): Record<string, string | number | null>[] {
  const byX = new Map<string, Record<string, string | number | null>>();

  for (const series of spec.series) {
    for (const point of series.points) {
      const row = byX.get(point.x) ?? { x: point.x };
      // null stays null — Recharts renders a gap for it. Coercing to 0 would draw a
      // zero-metre wave, which reads as "flat calm" when it means "no data".
      row[series.name] = point.y;
      byX.set(point.x, row);
    }
  }

  return [...byX.values()].sort((a, b) => String(a.x).localeCompare(String(b.x)));
}

function formatHour(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", weekday: "short" });
}

/** The row nearest to now, so the "now" rule lands on an actual tick. */
function nearestNow(rows: Record<string, string | number | null>[]): string | null {
  const now = Date.now();
  let best: { x: string; gap: number } | null = null;
  for (const row of rows) {
    const at = new Date(String(row.x)).getTime();
    if (Number.isNaN(at)) continue;
    const gap = Math.abs(at - now);
    if (!best || gap < best.gap) best = { x: String(row.x), gap };
  }
  // More than three hours from any point means the series does not cover now at all —
  // drawing the rule at its edge would be a lie about where "now" is.
  return best && best.gap < 3 * 3600_000 ? best.x : null;
}

export default function ForecastChart({ spec, isDark = false, height = 156 }: Props) {
  const axis = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "#1b2942" : "#e8edf4";
  const rows = toRows(spec);
  if (rows.length === 0) return null;

  const accent = ACCENT[spec.id] ?? FALLBACK_ACCENT;
  const limit = LIMIT[spec.id];
  const nowX = nearestNow(rows);
  const gradientId = `orca-fill-${spec.id}`;

  const ChartComponent =
    spec.kind === "bar" ? BarChart : spec.kind === "area" ? AreaChart : LineChart;

  return (
    <figure className="card w-full animate-fade-in p-3">
      {/* Stacked, not inline: a title and a unit label competing for one line means the
          longer titles wrap around the unit and the caption becomes two ragged rows. */}
      <figcaption className="mb-2">
        <span className="block text-[12.5px] font-semibold leading-tight text-slate-900 dark:text-slate-100">
          {spec.title}
        </span>
        <span className="block text-[10.5px] leading-tight muted">{spec.y_label}</span>
      </figcaption>

      {/* ResponsiveContainer keeps the chart inside its column on a phone. */}
      <ResponsiveContainer width="100%" height={height}>
        {/* left: -6, not -20. Pulling the plot area further left than the Y axis is wide
            clips the tick labels — "1.4" renders as ".4", which reads as a broken chart. */}
        <ChartComponent data={rows} margin={{ top: 6, right: 10, bottom: 0, left: -6 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis
            dataKey="x"
            tickFormatter={formatHour}
            tick={{ fontSize: 10, fill: axis }}
            stroke={grid}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            tick={{ fontSize: 10, fill: axis }}
            stroke={grid}
            tickLine={false}
            width={38}
          />
          <Tooltip
            cursor={{ stroke: axis, strokeDasharray: "3 3" }}
            labelFormatter={(value) => new Date(String(value)).toLocaleString()}
            // Recharts types the tooltip value as its own ValueType union, so this takes
            // the wide type and narrows it here rather than fighting the signature.
            formatter={(value, name) => {
              const series = spec.series.find((s) => s.name === name);
              const text =
                value == null || value === "" ? "no data" : `${value} ${series?.unit ?? ""}`;
              return [text, String(name)];
            }}
            contentStyle={{
              fontSize: 11.5,
              borderRadius: 10,
              padding: "6px 10px",
              border: `1px solid ${grid}`,
              background: isDark ? "#0d1626" : "#ffffff",
              color: isDark ? "#e2e8f0" : "#0f172a",
              boxShadow: "0 8px 24px -8px rgb(15 23 42 / 0.25)",
            }}
          />

          {nowX && (
            <ReferenceLine
              x={nowX}
              stroke={axis}
              strokeDasharray="2 3"
              label={{ value: "now", fontSize: 9.5, fill: axis, position: "insideTopLeft" }}
            />
          )}

          {limit && (
            <ReferenceLine
              y={limit.value}
              stroke="#e11d48"
              strokeDasharray="4 3"
              label={{
                value: limit.label,
                fontSize: 9.5,
                fill: "#e11d48",
                position: "insideTopRight",
              }}
            />
          )}

          {spec.series.map((series, index) => {
            // Extra series (rare — most specs carry one) shift hue rather than repeating
            // the accent, so two lines never render identically.
            const color = index === 0 ? accent : ["#f59e0b", "#a78bfa"][index % 2];
            // `key` is passed explicitly rather than spread: React warns when a key
            // arrives inside a spread object, because it is consumed by the reconciler
            // and never reaches the component.
            const common = {
              dataKey: series.name,
              stroke: color,
              // Draw a gap rather than bridging across missing hours.
              connectNulls: false,
            };
            if (spec.kind === "bar")
              return <Bar key={series.name} {...common} fill={color} radius={[3, 3, 0, 0]} />;
            if (spec.kind === "area")
              return (
                <Area
                  key={series.name}
                  {...common}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  dot={false}
                />
              );
            return <Line key={series.name} {...common} dot={false} strokeWidth={2} />;
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </figure>
  );
}
