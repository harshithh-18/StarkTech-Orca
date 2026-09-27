/**
 * Tide & Marine Sea-Level Gauge.
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
  if (minutes < 60) return { clock, delta: `in ${minutes}m` };

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return { clock, delta: `in ${hours}h ${rest ? `${rest}m` : ""}` };
}

export default function TideCard({ tide }: Props) {
  const high = clockAndDelta(tide.next_high_time);
  const low = clockAndDelta(tide.next_low_time);
  if (!high && !low) return null;

  const rising = tide.state === "rising";

  return (
    <section className="card p-3.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-ocean-500/15 text-ocean-700 dark:text-cyan-300">
          <Icon name="tide" size={14} />
        </span>
        <h3 className="panel-title text-[13.5px]">Tidal State & Sea Level</h3>
        {tide.state !== "unknown" && (
          <span
            className={`chip ml-auto text-[10.5px] font-bold ${
              rising
                ? "bg-ocean-500/15 text-ocean-700 dark:text-cyan-300 border border-ocean-500/25"
                : "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/20"
            }`}
          >
            <Icon name="chevron" size={11} className={rising ? "-rotate-90" : "rotate-90"} />
            {rising ? "Flooding (Rising)" : "Ebbing (Falling)"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Next High Water", data: high, height: tide.next_high_m, icon: "wave" },
          { label: "Next Low Water", data: low, height: tide.next_low_m, icon: "current" },
        ].map(({ label, data, height }) =>
          data ? (
            <div key={label} className="rounded-xl bg-sky-50/60 p-2.5 dark:bg-abyss-950/60 border border-sky-100/80 dark:border-white/5">
              <p className="text-[10px] font-semibold text-ocean-700 dark:text-cyan-300">{label}</p>
              <p className="mt-1 font-mono text-[16px] font-black leading-none text-slate-900 dark:text-slate-100">
                {data.clock}
              </p>
              <p className="mt-1 font-mono text-[10.5px] muted">
                {data.delta}
                {height != null && ` · ${height.toFixed(2)} m`}
              </p>
            </div>
          ) : null,
        )}
      </div>

      {tide.range_m != null && (
        <div className="flex items-center justify-between text-[11px] font-medium muted px-0.5">
          <span>Tidal Amplitude Range:</span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
            {tide.range_m.toFixed(2)} m
          </span>
        </div>
      )}

      <p className="border-t border-sky-100 pt-2 text-[10px] leading-snug muted dark:border-white/10">
        Modelled Copernicus hydrodynamic sea-surface height. Confirm with official port tide tables for bar crossings.
      </p>
    </section>
  );
}
