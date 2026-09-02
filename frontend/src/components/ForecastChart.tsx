/**
 * Forecast and trend charts.
 *
 * Owner: D · Phase: P2
 *
 * Renders a ChartSpec from the response — 48-hour wave and wind, tide curve, chlorophyll
 * trend for the "why has productivity declined?" answer. Recharts.
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
  /** Draw a horizontal rule at the small-craft threshold, e.g. 2.5 m. */
  thresholdY?: number | null;
  isDark?: boolean;
}

const SERIES_COLORS = ["#06b6d4", "#f59e0b", "#22c55e"];

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

export default function ForecastChart({ spec, thresholdY, isDark = false }: Props) {
  // Recharts renders SVG, which does not inherit Tailwind's dark variants — axis and
  // grid colours have to be passed explicitly or they stay near-black on a dark panel.
  const axis = isDark ? "#64748b" : "#94a3b8";
  const grid = isDark ? "#1e293b" : "#e2e8f0";
  const rows = toRows(spec);
  if (rows.length === 0) return null;

  const ChartComponent =
    spec.kind === "bar" ? BarChart : spec.kind === "area" ? AreaChart : LineChart;

  return (
    <figure className="w-full animate-fade-in">
      <figcaption className="mb-1 text-xs font-bold text-ocean-800 dark:text-ocean-200">
        {spec.title}
      </figcaption>
      {/* ResponsiveContainer keeps the chart inside its column on a phone. */}
      <ResponsiveContainer width="100%" height={150}>
        <ChartComponent data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis
            dataKey="x"
            tickFormatter={formatHour}
            tick={{ fontSize: 10, fill: axis }}
            stroke={axis}
            minTickGap={28}
          />
          <YAxis tick={{ fontSize: 10, fill: axis }} stroke={axis} width={40} />
          <Tooltip
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
              fontSize: 11,
              borderRadius: 10,
              border: `1px solid ${grid}`,
              background: isDark ? "#0d1626" : "#ffffff",
              color: isDark ? "#e2e8f0" : "#0c2340",
            }}
          />

          {thresholdY != null && (
            // Seeing the forecast cross the small-craft limit explains the verdict
            // faster than any sentence can.
            <ReferenceLine
              y={thresholdY}
              stroke="#b91c1c"
              strokeDasharray="4 3"
              label={{ value: `limit ${thresholdY}`, fontSize: 9, fill: "#b91c1c" }}
            />
          )}

          {spec.series.map((series, index) => {
            const color = SERIES_COLORS[index % SERIES_COLORS.length];
            const common = {
              key: series.name,
              dataKey: series.name,
              stroke: color,
              // Draw a gap rather than bridging across missing hours.
              connectNulls: false,
            };
            if (spec.kind === "bar") return <Bar {...common} fill={color} />;
            if (spec.kind === "area")
              return <Area {...common} fill={color} fillOpacity={0.2} />;
            return <Line {...common} dot={false} strokeWidth={2} />;
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </figure>
  );
}
