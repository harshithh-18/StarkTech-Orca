/**
 * REST client.
 *
 * Owner: D · Phase: P1
 *
 * Origin-relative URLs — Vite proxies /api to localhost:8000 in dev, and the deployed
 * build needs no environment-specific configuration.
 */

import type { ErrorDetail, MapLayer, OrcaResponse, QueryRequest } from "@/types/orca";

/** An API error carrying the backend's structured detail, including the actionable hint. */
export class OrcaApiError extends Error {
  readonly code: string;
  readonly hint?: string | null;
  readonly status: number;

  constructor(detail: ErrorDetail, status: number) {
    super(detail.message);
    this.name = "OrcaApiError";
    this.code = detail.code;
    this.hint = detail.hint;
    this.status = status;
  }

  /** What to actually show the user: the message plus the hint that tells them what to do. */
  get displayText(): string {
    return this.hint ? `${this.message} ${this.hint}` : this.message;
  }
}

async function parseError(response: Response): Promise<OrcaApiError> {
  // Every route returns { error: {code, message, hint} }. Fall back gracefully if
  // something upstream (a proxy, a crash) returns a different shape.
  try {
    const body = await response.json();
    if (body?.error?.message) {
      return new OrcaApiError(body.error as ErrorDetail, response.status);
    }
    if (typeof body?.detail === "string") {
      return new OrcaApiError(
        { code: `HTTP_${response.status}`, message: body.detail },
        response.status,
      );
    }
  } catch {
    // Body wasn't JSON — fall through to the generic message.
  }
  return new OrcaApiError(
    {
      code: `HTTP_${response.status}`,
      message: `The server returned ${response.status}.`,
      hint: "Check that the ORCA backend is running on port 8000.",
    },
    response.status,
  );
}

/** POST /api/query — run one turn through the agent graph. */
export async function postQuery(request: QueryRequest): Promise<OrcaResponse> {
  const response = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) throw await parseError(response);
  return (await response.json()) as OrcaResponse;
}

/** GET /api/layers/{layer} — GeoJSON for one map layer. */
export async function getLayer(
  layer: MapLayer,
  opts?: { lat?: number; lon?: number; radiusKm?: number },
): Promise<GeoJSON.FeatureCollection> {
  const params = new URLSearchParams();
  if (opts?.lat !== undefined) params.set("lat", String(opts.lat));
  if (opts?.lon !== undefined) params.set("lon", String(opts.lon));
  if (opts?.radiusKm !== undefined) params.set("radius_km", String(opts.radiusKm));

  const query = params.toString();
  const response = await fetch(`/api/layers/${layer}${query ? `?${query}` : ""}`);

  if (!response.ok) throw await parseError(response);
  return (await response.json()) as GeoJSON.FeatureCollection;
}

/** Boundaries don't change between queries, so keep them in memory for the session. */
const layerCache = new Map<string, GeoJSON.FeatureCollection>();

export async function getLayerCached(
  layer: MapLayer,
  opts?: { lat?: number; lon?: number; radiusKm?: number },
): Promise<GeoJSON.FeatureCollection> {
  // Round the key so tiny map pans don't miss the cache on every frame.
  const key = [
    layer,
    opts?.lat?.toFixed(1) ?? "-",
    opts?.lon?.toFixed(1) ?? "-",
    opts?.radiusKm ?? "-",
  ].join(":");

  const hit = layerCache.get(key);
  if (hit) return hit;

  const collection = await getLayer(layer, opts);
  layerCache.set(key, collection);
  return collection;
}

/** GET /health */
export async function getHealth(): Promise<{ status: string; version: string }> {
  const response = await fetch("/health");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as { status: string; version: string };
}

/** New session id, generated client-side. Keys both memory and the trace socket. */
export function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Older Safari and any non-secure origin lack randomUUID; the id only needs to be
  // unique per browser session, not cryptographically strong.
  return `orca-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
