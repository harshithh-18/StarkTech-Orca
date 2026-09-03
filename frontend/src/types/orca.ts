/**
 * ORCA wire contracts — TypeScript mirror.
 *
 * Owner: D
 *
 * MUST stay in sync with the backend, which is the source of truth:
 *   - `backend/app/schemas/response.py`   — the conversational turn (🔒 frozen)
 *   - `backend/app/schemas/conditions.py` — the dashboard and watch contracts
 *
 * `backend/tests/test_schemas.py::test_enums_match_frontend_types` parses the unions in
 * this file and fails the build if either side drifts, so this is enforced, not a
 * convention. Changing an enum means editing three files in one commit: the Python enum,
 * this file, and docs/API_CONTRACT.md.
 *
 * Import types from here — never redeclare a response shape inside a component.
 */

export type Intent =
  | "pfz_lookup"
  | "safety_check"
  | "geofence_check"
  | "diagnostic"
  | "route_planning"
  | "general";

export type Verdict = "GO" | "CAUTION" | "NO_GO" | "NOT_APPLICABLE";

export type AlertType =
  | "CYCLONE"
  | "HIGH_WAVE"
  | "HIGH_WIND"
  | "LIGHTNING"
  | "GEOFENCE_BREACH"
  | "GEOFENCE_PROXIMITY"
  | "MARINE_HEAT_WAVE"
  | "TSUNAMI";

export type MapLayer =
  | "user_pin"
  | "pfz_zones"
  | "eez_boundary"
  | "imbl_line"
  | "mpa_zones"
  | "wave_heatmap"
  | "sst_heatmap"
  | "chlorophyll_heatmap"
  | "hazard_overlay"
  | "route_line"
  | "ocean_fronts";

/** ISO 639-1. Coastal languages first — ta/te/ml/bn are the demo targets. */
export type Language =
  | "ta" | "te" | "ml" | "bn" | "hi"
  | "kn" | "mr" | "gu" | "or" | "en";

export type TraceStatus = "started" | "ok" | "failed" | "skipped";

export type ChartKind = "line" | "bar" | "area";

export interface Location {
  lat: number;
  lon: number;
  name?: string | null;
  /** "gps" | "geocoded" | "session_context" | "picked" | … */
  source?: string | null;
}

/** One observed value that influenced the answer. Rendered as a citation. */
export interface Evidence {
  field: string;
  value: number | string | boolean;
  unit?: string | null;
  /** Human-readable, names the model: "Open-Meteo Marine (ICON-Wave)" */
  source: string;
  /** Validity time of the value — NOT when we fetched it. */
  time?: string | null;
  location?: Location | null;
}

/** One line in the Reasoning Trace panel. Always English — it's a technical trace. */
export interface TraceStep {
  seq: number;
  agent: string;
  status: TraceStatus;
  message: string;
  source?: string | null;
  duration_ms?: number | null;
}

export interface ChartPoint {
  /** ISO 8601 datetime string. */
  x: string;
  /** null renders as a gap, not a zero. */
  y: number | null;
}

export interface ChartSeries {
  name: string;
  unit?: string | null;
  points: ChartPoint[];
}

export interface ChartSpec {
  id: string;
  title: string;
  kind: ChartKind;
  x_label: string;
  y_label: string;
  series: ChartSeries[];
}

export interface OrcaResponse {
  query: string;
  session_id: string;
  language: Language;
  intent: Intent;
  location?: Location | null;

  answer: string;
  verdict?: Verdict | null;

  /** Never null — map over these without a guard. */
  evidence: Evidence[];
  reasoning_trace: TraceStep[];

  map_layers: MapLayer[];
  alerts: AlertType[];
  charts: ChartSpec[];

  generated_at: string;
  /** True when served from data/mock/. Show a badge — we degrade honestly. */
  used_mock_data: boolean;
  attribution: string[];
}

export interface QueryRequest {
  query: string;
  session_id: string;
  lat?: number | null;
  lon?: number | null;
  language?: Language | null;
  reply_with_audio?: boolean;
}

export interface ErrorDetail {
  code: string;
  message: string;
  hint?: string | null;
}

// ── Conditions dashboard ──────────────────────────────────────────────────

/**
 * `"none"` means the field has no safety threshold at all (tide, sea temperature).
 * It is NOT the same as `"go"` — painting the tide green would claim it had been
 * checked against a limit that does not exist. Render `none` neutrally.
 */
export type ConditionBand = "none" | "go" | "caution" | "no_go";

export interface ConditionTile {
  field: string;
  label: string;
  /** Icon key — see `components/common/Icon.tsx`. */
  icon: string;
  value: number;
  unit?: string | null;
  band: ConditionBand;
  source: string;
  time?: string | null;
  /** Worst reading in the next 24 h — the number that changes a decision. */
  peak_value?: number | null;
  peak_time?: string | null;
  /**
   * Band of `peak_value`, separate from `band` on purpose: a reading can be inside the
   * limits now and past them by evening, and one colour cannot say both.
   */
  peak_band: ConditionBand;
  /** The caution limit, so a bar can be drawn against it. */
  threshold?: number | null;
}

export interface TideSummary {
  next_high_time?: string | null;
  next_high_m?: number | null;
  next_low_time?: string | null;
  next_low_m?: number | null;
  range_m?: number | null;
  state: "rising" | "falling" | "unknown";
  source: string;
}

/**
 * Where the sea actually is, for a point that has none.
 *
 * Not an error payload — an answer. See `components/conditions/NoCoastCard.tsx`.
 */
export interface NearestCoast {
  name: string;
  state: string;
  lat: number;
  lon: number;
  distance_km: number;
  /** Spoken compass direction, e.g. "south-east". */
  bearing: string;
}

export interface SafeWindow {
  start: string;
  end: string;
  hours: number;
  /** "clear" = every hour inside the limits; "workable" = some caution hours. */
  quality: "clear" | "workable";
}

export interface ConditionsSnapshot {
  location: Location;
  observed_at: string;

  tiles: ConditionTile[];
  verdict: Verdict;
  reasons: string[];
  alerts: AlertType[];
  tide?: TideSummary | null;

  next_window?: SafeWindow | null;
  windows: SafeWindow[];
  blocked_by: string[];

  charts: ChartSpec[];
  evidence: Evidence[];

  /**
   * False when this point has no sea within range. Then there is no sea state, no tide
   * and no safety verdict to give — not a degraded one, none.
   */
  coastal: boolean;
  /** Populated whenever `coastal` is false — where to go instead. */
  nearest_coast?: NearestCoast | null;

  /** Which upstream models were unavailable, and why. */
  degraded: string[];
  used_mock_data: boolean;
  attribution: string[];
}

/** One entry in the harbour list served by `GET /api/harbours`. */
export interface Harbour {
  name: string;
  lat: number;
  lon: number;
  state: string;
  coast: "east" | "west";
}

// ── Proactive watches ─────────────────────────────────────────────────────

export interface WatchRequest {
  session_id: string;
  lat: number;
  lon: number;
  name?: string | null;
  language?: Language;
  interval_seconds?: number;
}

export interface WatchAlert {
  type: AlertType;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  raised_at: string;
  location?: Location | null;
  evidence: Evidence[];
  /** Present on socket frames; absent when read back from the REST history. */
  watch_id?: string;
}

export interface Watch {
  id: string;
  session_id: string;
  location: Location;
  language: Language;
  interval_seconds: number;
  created_at: string;
  last_checked_at?: string | null;
  active: boolean;
}

export interface WatchStatus {
  watch: Watch;
  verdict: Verdict;
  alerts: WatchAlert[];
  checks: number;
}

// ── Socket ────────────────────────────────────────────────────────────────

/** A frame on WS /ws/trace/{session_id}. */
export type TraceEvent =
  | { type: "trace"; session_id: string; payload: TraceStep }
  | { type: "answer"; session_id: string; payload: OrcaResponse }
  | { type: "alert"; session_id: string; payload: WatchAlert }
  | { type: "error"; session_id: string; payload: ErrorDetail };

// ── Frontend-only ─────────────────────────────────────────────────────────

/** A turn in the chat panel. Not part of the wire contract. */
export interface ChatMessage {
  id: string;
  role: "user" | "orca";
  text: string;
  response?: OrcaResponse;
  pending?: boolean;
  /** The turn failed; `text` holds the error. Kept in the list so it can be retried. */
  failed?: boolean;
  /** The original query, so a failed turn can be re-sent without retyping it. */
  query?: string;
}

/**
 * Who is asking. The problem statement names four stakeholder groups with genuinely
 * different questions, and a fisherman should not have to scroll past "chlorophyll
 * anomaly analysis" to find "is it safe today".
 */
export type Role = "fisherman" | "researcher" | "authority" | "operator";

/** Persisted between visits, so the console opens where the user left it. */
export interface Profile {
  role: Role;
  /**
   * The reply language. Only sent to the backend when `autoLanguage` is false — the
   * normal path is detection from what the user actually typed, which is what the
   * problem statement asks for. This is the override.
   */
  language: Language;
  /** True (the default) ⇒ detect the language from the query and reply in it. */
  autoLanguage: boolean;
  location: Location;
  /** False until the welcome screen has been completed or skipped. */
  onboarded: boolean;
}
