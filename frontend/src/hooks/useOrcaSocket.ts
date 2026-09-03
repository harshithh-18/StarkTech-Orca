/**
 * One WebSocket, many listeners.
 *
 * Owner: D · Phase: P4
 *
 * `WS /ws/trace/{session_id}` carries three kinds of frame — reasoning steps, the final
 * answer, and proactive watch alerts — and two different panels care about different ones.
 * The backend deliberately multiplexes them onto a single connection (see
 * `api/ws_trace.emit_watch_alert`), so the client needs exactly one socket with a
 * subscriber list rather than one socket per consumer.
 *
 * That is not just tidiness: the server keys `_connections` by session id, so a second
 * socket on the same session *replaces* the first. Two hooks each opening their own
 * connection would silently fight, and whichever mounted last would be the only one that
 * ever received a frame.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { connectTraceSocket, type TraceSocket } from "@/api/socket";
import type { TraceEvent } from "@/types/orca";

export type TraceListener = (event: TraceEvent) => void;

export interface UseOrcaSocket {
  connected: boolean;
  /** Register a listener. Returns an unsubscribe function — call it on unmount. */
  subscribe(listener: TraceListener): () => void;
}

export function useOrcaSocket(sessionId: string): UseOrcaSocket {
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Set<TraceListener>());
  const socketRef = useRef<TraceSocket | null>(null);

  const subscribe = useCallback((listener: TraceListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const dispatch = (event: TraceEvent) => {
      // Copied before iterating: a listener that unsubscribes itself in response to a
      // frame would otherwise mutate the set mid-loop.
      for (const listener of [...listeners.current]) {
        try {
          listener(event);
        } catch {
          // One panel throwing must not stop the others from seeing the frame.
        }
      }
    };

    const socket = connectTraceSocket(sessionId, dispatch, setConnected);
    socketRef.current = socket;

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [sessionId]);

  return { connected, subscribe };
}
