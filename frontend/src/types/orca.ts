/**
 * ORCA response contract — TypeScript mirror.
 *
 * Owner: D · Status: 🔒 FROZEN after Day 3
 *
 * MUST stay in sync with `backend/app/schemas/response.py`, which is the source of truth.
 * Changing either one means changing both plus docs/API_CONTRACT.md in the same PR.
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
  | "route_line";

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
  /** "gps" | "geocoded" | "session_context" */
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

/** A frame on WS /ws/trace/{session_id}. */
export type TraceEvent =
  | { type: "trace"; session_id: string; payload: TraceStep }
  | { type: "answer"; session_id: string; payload: OrcaResponse }
  | { type: "error"; session_id: string; payload: ErrorDetail };

/** A turn in the chat panel. Frontend-only — not part of the wire contract. */
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
