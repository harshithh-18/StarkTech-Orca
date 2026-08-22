/**
 * Live reasoning-trace hook.
 *
 * Owner: D · Phase: P2
 *
 * Subscribes to the trace WebSocket and accumulates steps for the panel. Steps arrive out
 * of order when specialists run in parallel — sort by `seq`, never by arrival.
 */

import type { TraceStep } from "@/types/orca";

export interface UseReasoningTrace {
  steps: TraceStep[];
  streaming: boolean;
  connected: boolean;
  clear(): void;
}

/**
 * TODO(P2, D): connect via api/socket.ts, accumulate on "trace" frames
 * TODO(P2, D): sort by seq — parallel specialists finish out of order
 * TODO(P2, D): clear on a new query so turns don't bleed together
 * TODO(P3, D): fall back to rendering response.reasoning_trace all at once if the socket
 *              never connected — the panel must always show something
 */
export function useReasoningTrace(_sessionId: string): UseReasoningTrace {
  throw new Error("TODO(P2, D): not implemented");
}
