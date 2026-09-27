/**
 * Forecast and trend charts — Recharts with Maritime Ocean Styling.
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

const ACCENT: Record<string, string> = {
  wave_48h: "#0284c7",
  wind_48h: "#f59e0b",
  tide: "#0d9488",
  chlorophyll_trend: "#10b981",
  sst_trend: "#f43f5e",
};

const FALLBACK_ACCENT = "#0ea5e9";

const LIMIT: Record<string, { value: number; label: string }> = {
  wave_48h: { value: 2.5, label: "2.5 m no-go" },
  wind_48h: { value: 55, label: "55 km/h no-go" },
};

function toRows(spec: ChartSpec): Record<string, string | number | null>[] {
  const byX = new Map<string, Record<string, string | number | null>>();

  for (const series of spec.series) {
    for (const point of series.points) {
      const row = byX.get(point.x) ?? { x: point.x };
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

function nearestNow(rows: Record<string, string | number | null>[]): string | null {
  const now = Date.now();
  let best: { x: string; gap: number } | null = null;
  for (const row of rows) {
    const at = new Date(String(row.x)).getTime();
    if (Number.isNaN(at)) continue;
    const gap = Math.abs(at - now);
    if (!best || gap < best.gap) best = { x: String(row.x), gap };
  }
  return best && best.gap < 3 * 3600_000 ? best.x : null;
}

export default function ForecastChart({ spec, isDark = false, height = 156 }: Props) {
  const axisColor = isDark ? "#7dd3fc" : "#0369a1";
  const gridColor = isDark ? "#10233b" : "#e0f2fe";
  const rows = toRows(spec);
  if (rows.length === 0) return null;

  const accent = ACCENT[spec.id] ?? FALLBACK_ACCENT;
  const limit = LIMIT[spec.id];
  const nowX = nearestNow(rows);
  const gradientId = `orca-fill-${spec.id}`;

  const ChartComponent =
    spec.kind === "bar" ? BarChart : spec.kind === "area" ? AreaChart : LineChart;

  return (
    <figure className="card w-full animate-fade-in p-3.5">
      <figcaption className="mb-2 flex items-baseline justify-between">
        <span className="text-[12.5px] font-bold text-slate-900 dark:text-slate-100">
          {spec.title}
        </span>
        <span className="font-mono text-[10px] font-semibold text-ocean-700 dark:text-cyan-300">
          {spec.y_label}
        </span>
      </figcaption>

      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={rows} margin={{ top: 6, right: 10, bottom: 0, left: -6 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.4} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="x"
            tickFormatter={formatHour}
            tick={{ fontSize: 9.5, fill: axisColor, opacity: 0.8 }}
            stroke={gridColor}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={{ fontSize: 9.5, fill: axisColor, opacity: 0.8 }}
            stroke={gridColor}
            tickLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: accent, strokeDasharray: "3 3", opacity: 0.5 }}
            labelFormatter={(value) => new Date(String(value)).toLocaleString()}
            formatter={(value, name) => {
              const series = spec.series.find((s) => s.name === name);
              const text =
                value == null || value === "" ? "no data" : `${value} ${series?.unit ?? ""}`;
              return [text, String(name)];
            }}
            contentStyle={{
              fontSize: 11.5,
              borderRadius: 12,
              padding: "6px 12px",
              border: `1px solid ${isDark ? "rgba(56, 189, 248, 0.25)" : "rgb(186 230 253)"}`,
              background: isDark ? "#061325" : "#ffffff",
              color: isDark ? "#f0f9ff" : "#0369a1",
              boxShadow: "0 10px 25px -5px rgba(2, 132, 199, 0.25)",
            }}
          />

          {nowX && (
            <ReferenceLine
              x={nowX}
              stroke="#0ea5e9"
              strokeDasharray="2 3"
              label={{ value: "NOW", fontSize: 9, fill: "#0ea5e9", position: "insideTopLeft" }}
            />
          )}

          {limit && (
            <ReferenceLine
              y={limit.value}
              stroke="#f43f5e"
              strokeDasharray="4 3"
              label={{
                value: limit.label,
                fontSize: 9,
                fill: "#f43f5e",
                position: "insideTopRight",
              }}
            />
          )}

          {spec.series.map((series, index) => {
            const color = index === 0 ? accent : ["#f59e0b", "#14b8a6"][index % 2];
            const common = {
              dataKey: series.name,
              stroke: color,
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
            return <Line key={series.name} {...common} dot={false} strokeWidth={2.2} />;
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </figure>
  );
}
