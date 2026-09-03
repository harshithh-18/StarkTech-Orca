/**
 * "There's no sea here."
 *
 * Owner: D · Phase: P4
 *
 * What the Conditions view shows instead of a verdict card when the chosen point has no
 * sea within range.
 *
 * ## Why this exists at all
 *
 * Opened from Hyderabad, the dashboard used to say **Caution — conditions are marginal**,
 * with the reason "sea state data was unavailable, so conditions could not be fully
 * checked". Every word of that is technically true and the whole of it is wrong: it reads
 * as *the sea near you might be rough*, when the truth is *you are 416 km from any sea*.
 * It also offered a five-hour departure window on Thursday morning.
 *
 * The honest answer is not a cautious verdict. It is no verdict, the reason there is none,
 * and the nearest place where the question does have an answer — with one click to go
 * there, because that is what the person actually wanted.
 */

import Icon from "@/components/common/Icon";
import type { Location, NearestCoast } from "@/types/orca";

interface Props {
  locationName: string;
  coast: NearestCoast | null | undefined;
  reasons: string[];
  onGoToCoast: (location: Location) => void;
}

export default function NoCoastCard({
  locationName,
  coast,
  reasons,
  onGoToCoast,
}: Props) {
  return (
    <section
      role="status"
      className="animate-slide-up rounded-xl border border-slate-300 bg-slate-500/[0.05] p-4 dark:border-white/15 dark:bg-white/[0.04]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-500/15 text-slate-600 dark:text-slate-300"
        >
          <Icon name="harbour" size={20} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
            No sea near {locationName}
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug muted">
            {reasons[0] ??
              "This point is inland, so there are no waves, tides or sea conditions to report."}
          </p>
        </div>
      </div>

      {coast && (
        <div className="mt-3 border-t border-black/[0.06] pt-3 dark:border-white/10">
          <p className="text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200">
            The nearest coast is{" "}
            <span className="font-semibold">{coast.name}</span>, {coast.state} — about{" "}
            <span className="font-semibold">{Math.round(coast.distance_km)} km</span>{" "}
            {coast.bearing}.
          </p>

          <button
            type="button"
            onClick={() =>
              onGoToCoast({
                lat: coast.lat,
                lon: coast.lon,
                name: coast.name,
                source: "harbour",
              })
            }
            className="btn-primary mt-3 w-full py-2.5"
          >
            <Icon name="harbour" size={15} />
            Show conditions at {coast.name}
          </button>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed muted">
        The wind and visibility below are real readings for {locationName}. They are not
        checked against boating limits — those only mean something at sea.
      </p>
    </section>
  );
}
