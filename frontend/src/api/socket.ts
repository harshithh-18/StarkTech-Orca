/**
 * WebSocket client for the live reasoning trace.
 *
 * Owner: D · Phase: P2
 *
 * Open this BEFORE posting the query — trace steps emitted before the socket connects are
 * lost, and the first step (language + intent) is the one that sets up the whole story.
 */

import type { TraceEvent } from "@/types/orca";

export interface TraceSocket {
  close(): void;
  readonly connected: boolean;
}

/**
 * Connect to WS /ws/trace/{sessionId}.
 *
 * TODO(P2, D): open the socket, parse frames, dispatch by `type`
 * TODO(P2, D): reconnect with backoff — a dropped socket must not blank the panel
 * TODO(P3, D): degrade silently. If the socket never connects, the POST response still
 *              carries the full trace: render it all at once rather than showing nothing.
 *              The panel should never be the reason a demo looks broken.
 */
export function connectTraceSocket(
  _sessionId: string,
  _onEvent: (event: TraceEvent) => void,
): TraceSocket {
  throw new Error("TODO(P2, D): not implemented");
}
