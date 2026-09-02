/**
 * Location picker.
 *
 * Owner: D · Phase: P3
 *
 * ORCA answers about the sea, so the query point has to be *on* the sea. A real fisherman
 * is at the coast and GPS is exactly right for him — but anyone demonstrating or testing
 * is indoors and inland, where there is no marine forecast at all and every query
 * correctly returns nothing.
 *
 * So the default is a harbour, not the device. GPS is opt-in, one click away, and the
 * control says plainly which one is in use.
 */

interface Harbour {
  name: string;
  lat: number;
  lon: number;
  coast: string;
}

/** Major fishing harbours, mirroring the backend's alias table. */
export const HARBOURS: Harbour[] = [
  { name: "Kakinada", lat: 16.9604, lon: 82.2381, coast: "Andhra Pradesh" },
  { name: "Visakhapatnam", lat: 17.6868, lon: 83.2185, coast: "Andhra Pradesh" },
  { name: "Chennai", lat: 13.0827, lon: 80.2707, coast: "Tamil Nadu" },
  { name: "Nagapattinam", lat: 10.766, lon: 79.842, coast: "Tamil Nadu" },
  { name: "Rameswaram", lat: 9.2876, lon: 79.3129, coast: "Palk Strait" },
  { name: "Kochi", lat: 9.9312, lon: 76.2673, coast: "Kerala" },
  { name: "Mumbai", lat: 18.9388, lon: 72.8354, coast: "Maharashtra" },
  { name: "Paradip", lat: 20.3161, lon: 86.6114, coast: "Odisha" },
  { name: "Digha", lat: 21.627, lon: 87.5079, coast: "West Bengal" },
  { name: "Veraval", lat: 20.907, lon: 70.367, coast: "Gujarat" },
];

export interface PickedLocation {
  lat: number;
  lon: number;
  name: string;
  /** "harbour" when chosen here, "gps" when taken from the device. */
  source: "harbour" | "gps";
}

interface Props {
  value: PickedLocation | null;
  onChange: (next: PickedLocation | null) => void;
  gpsAvailable: boolean;
  onUseGps: () => void;
}

export default function LocationPicker({
  value,
  onChange,
  gpsAvailable,
  onUseGps,
}: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor="orca-harbour">
        Query location
      </label>

      <div className="relative">
        <select
          id="orca-harbour"
          value={value?.source === "harbour" ? value.name : ""}
          onChange={(event) => {
            const harbour = HARBOURS.find((h) => h.name === event.target.value);
            onChange(
              harbour
                ? { lat: harbour.lat, lon: harbour.lon, name: harbour.name, source: "harbour" }
                : null,
            );
          }}
          className="cursor-pointer appearance-none rounded-lg border border-white/15 bg-white/10 py-1 pl-6 pr-6 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          <option value="" className="text-slate-900">
            No fixed location
          </option>
          {HARBOURS.map((harbour) => (
            <option key={harbour.name} value={harbour.name} className="text-slate-900">
              {harbour.name} — {harbour.coast}
            </option>
          ))}
        </select>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[11px]"
        >
          ⚓
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] opacity-70"
        >
          ▼
        </span>
      </div>

      {gpsAvailable && (
        <button
          type="button"
          onClick={onUseGps}
          title={
            value?.source === "gps"
              ? "Using your device location"
              : "Use my device location instead (only useful if you are at the coast)"
          }
          aria-pressed={value?.source === "gps"}
          className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg border text-[11px] transition-all hover:scale-105 active:scale-95 ${
            value?.source === "gps"
              ? "border-ocean-300 bg-ocean-400/30 text-white"
              : "border-white/15 bg-white/10 text-white/80 hover:bg-white/20"
          }`}
        >
          <span aria-hidden="true">◎</span>
        </button>
      )}
    </div>
  );
}
