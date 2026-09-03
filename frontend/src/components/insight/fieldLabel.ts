/**
 * Evidence field names, written for a person.
 *
 * Owner: D · Phase: P4
 *
 * `Evidence.field` is a machine identifier — `wind_gusts_10m`, `cape`,
 * `distance_to_imbl` — and de-underscoring it is not enough. "Cape 2080 J/kg" reads as a
 * headland, and "Distance to imbl" reads as a typo. Anything the user might actually see
 * gets a written name here; everything else falls back to a tidied version of the
 * identifier, which is still better than the raw string.
 *
 * Shared by the chat bubble's evidence disclosure and the Sources view so the same value
 * is never called two different things in two places.
 */

const NAMES: Record<string, string> = {
  // Sea state
  wave_height: "Wave height",
  wave_period: "Wave period",
  wave_direction: "Wave direction",
  swell_wave_height: "Swell height",
  swell_wave_period: "Swell period",
  sea_surface_temperature: "Sea-surface temperature",
  ocean_current_velocity: "Current speed",
  ocean_current_direction: "Current direction",
  sea_level_height_msl: "Sea level (tide)",
  next_high_tide: "Next high water",
  next_low_tide: "Next low water",
  tidal_range: "Tidal range",

  // Weather
  wind_speed_10m: "Wind speed",
  wind_gusts_10m: "Wind gusts",
  wind_direction_10m: "Wind direction",
  precipitation: "Rainfall",
  precipitation_probability: "Chance of rain",
  weather_code: "Weather type",
  cape: "Storm energy (CAPE)",
  visibility: "Visibility",

  // Cyclone proxy
  cyclone_bulletin_active: "Tropical system present",
  cyclone_system_class: "System classification",
  cyclone_sustained_wind: "System sustained wind",
  cyclone_centre_pressure: "System centre pressure",
  cyclone_distance: "Distance to system",
  cyclone_check_failed: "Cyclone check failed",

  // Fishing zones and productivity
  chlorophyll: "Chlorophyll-a",
  chlorophyll_mg_m3: "Chlorophyll-a",
  chlorophyll_change_pct: "Chlorophyll change",
  sst_gradient: "Temperature gradient",
  nearest_zone_distance: "Distance to nearest zone",
  nearest_zone_bearing: "Bearing to nearest zone",
  zone_corroboration: "Independently corroborated",

  // Fronts
  nearest_front_distance: "Distance to nearest front",
  nearest_front_bearing: "Bearing to nearest front",
  front_strength: "Front strength",
  front_kind: "Feature type",

  // Boundaries — plain language, never the acronym. See `agents/geospatial`
  // BOUNDARY_LABELS for the same vocabulary on the backend.
  inside_eez: "Inside India's own waters",
  inside_mpa: "Inside a protected marine area",
  distance_to_eez: "Distance to the edge of India's waters",
  distance_to_imbl: "Distance to the sea border with another country",
  distance_to_mpa: "Distance to a protected marine area",
};

export function fieldLabel(field: string): string {
  const known = NAMES[field];
  if (known) return known;

  return field
    .replace(/_10m$/, "")
    .replace(/_pct$/, " %")
    .replace(/_km$/, " (km)")
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}
