/**
 * Tide summary.
 *
 * Owner: D · Phase: P4
 *
 * Next high water, next low water, the range, and which way it is running. That is the
 * whole of what a boat crossing a harbour bar needs, and it answers the tide half of the
 * problem statement's *"what are the tide, weather and sea conditions near my location?"*.
 *
 * The source line is not decoration: this is a **modelled** sea level, not a port tide
 * table, and anyone who has actually used one will want to know the difference before
 * they plan a bar crossing around it.
 */

import Icon from "@/components/common/Icon";
import type { TideSummary } from "@/types/orca";

interface Props {
  tide: TideSummary;
}

function clockAndDelta(iso?: string | null): { clock: string; delta: string } | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;

  const minutes = Math.round((when.getTime() - Date.now()) / 60000);
  const clock = when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  if (minutes < 0) return { clock, delta: "past" };
  if (minutes < 60) return { clock, delta: `in ${minutes} min` };

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return { clock, delta: `in ${hours} h${rest ? ` ${rest} min` : ""}` };
}

export default function TideCard({ tide }: Props) {
  const high = clockAndDelta(tide.next_high_time);
  const low = clockAndDelta(tide.next_low_time);
  if (!high && !low) return null;

  const rising = tide.state === "rising";

  return (
    <section className="card p-3">
      <div className="flex items-center gap-2">
        <Icon name="tide" size={15} className="text-ocean-600 dark:text-ocean-300" />
        <h3 className="panel-title">Tide</h3>
        {tide.state !== "unknown" && (
          <span
            className={`chip ml-auto ${
              rising
                ? "bg-ocean-500/10 text-ocean-700 dark:text-ocean-300"
                : "bg-slate-500/10 text-slate-600 dark:text-slate-300"
            }`}
          >
            <Icon name="chevron" size={11} className={rising ? "-rotate-90" : "rotate-90"} />
            {rising ? "Rising" : "Falling"}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          { label: "High water", data: high, height: tide.next_high_m },
          { label: "Low water", data: low, height: tide.next_low_m },
        ].map(({ label, data, height }) =>
          data ? (
            <div key={label} className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-white/[0.04]">
              <p className="text-[10.5px] font-medium muted">{label}</p>
              <p className="mt-0.5 text-[15px] font-bold leading-none text-slate-900 dark:text-slate-100">
                {data.clock}
              </p>
              <p className="mt-1 text-[10.5px] muted">
                {data.delta}
                {height != null && ` · ${height.toFixed(2)} m`}
              </p>
            </div>
          ) : null,
        )}
      </div>

      {tide.range_m != null && (
        <p className="mt-2 text-[11px] muted">
          Range over the forecast: {tide.range_m.toFixed(2)} m
        </p>
      )}

      <p className="mt-2 border-t border-slate-200 pt-2 text-[10.5px] leading-snug muted dark:border-white/10">
        Modelled sea level, not a port tide table — use an official table for bar crossings.
      </p>
    </section>
  );
}
