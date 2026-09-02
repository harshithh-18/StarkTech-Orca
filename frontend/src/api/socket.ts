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

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 400;

/**
 * Connect to WS /ws/trace/{sessionId}.
 *
 * Degrades silently by design: if the socket never connects, the POST response still
 * carries the full trace, and the panel renders it all at once. The trace panel must
 * never be the reason a demo looks broken.
 */
export function connectTraceSocket(
  sessionId: string,
  onEvent: (event: TraceEvent) => void,
  onStatusChange?: (connected: boolean) => void,
): TraceSocket {
  let socket: WebSocket | null = null;
  let retries = 0;
  let closedByCaller = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const setConnected = (value: boolean) => onStatusChange?.(value);

  const open = () => {
    if (closedByCaller) return;

    // Same-origin, so this works behind the Vite proxy in dev and unchanged in prod.
    const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${scheme}//${window.location.host}/ws/trace/${encodeURIComponent(sessionId)}`;

    try {
      socket = new WebSocket(url);
    } catch {
      scheduleRetry();
      return;
    }

    socket.onopen = () => {
      retries = 0;
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        onEvent(JSON.parse(event.data) as TraceEvent);
      } catch {
        // A malformed frame is not worth breaking the panel over.
      }
    };

    socket.onclose = () => {
      setConnected(false);
      scheduleRetry();
    };

    // onclose always follows onerror, so retrying is handled in one place.
    socket.onerror = () => setConnected(false);
  };

  const scheduleRetry = () => {
    if (closedByCaller || retries >= MAX_RETRIES) return;
    // Exponential backoff: a dropped socket must not blank the panel, but nor should it
    // hammer a backend that is down.
    const delay = BASE_DELAY_MS * 2 ** retries;
    retries += 1;
    retryTimer = setTimeout(open, delay);
  };

  open();

  return {
    close() {
      closedByCaller = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
      setConnected(false);
    },
    get connected() {
      return socket?.readyState === WebSocket.OPEN;
    },
  };
}
