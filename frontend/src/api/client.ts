/**
 * REST client.
 *
 * Owner: D · Phase: P1
 *
 * Origin-relative URLs — Vite proxies /api to localhost:8000 in dev, and the deployed
 * build needs no environment-specific configuration.
 */

import type { MapLayer, OrcaResponse, QueryRequest } from "@/types/orca";

/** POST /api/query — run one turn through the agent graph. */
export async function postQuery(_request: QueryRequest): Promise<OrcaResponse> {
  // TODO(P1, D): fetch("/api/query", { method: "POST", ... })
  // TODO(P3, D): parse the ErrorResponse body on non-2xx and surface `hint` to the user —
  //              "share your location or name a port" is actionable; "500" is not.
  throw new Error("TODO(P1, D): not implemented");
}

/** GET /api/layers/{layer} — GeoJSON for one map layer. */
export async function getLayer(
  _layer: MapLayer,
  _opts?: { lat?: number; lon?: number; radiusKm?: number },
): Promise<GeoJSON.FeatureCollection> {
  // TODO(P1, D): fetch and return the FeatureCollection
  // TODO(P3, D): cache per layer in memory — boundaries don't change between queries
  throw new Error("TODO(P1, D): not implemented");
}

/** GET /health */
export async function getHealth(): Promise<{ status: string; version: string }> {
  // TODO(P1, D)
  throw new Error("TODO(P1, D): not implemented");
}

/** New session id, generated client-side. Keys both memory and the trace socket. */
export function newSessionId(): string {
  // TODO(P1, D): crypto.randomUUID()
  throw new Error("TODO(P1, D): not implemented");
}
