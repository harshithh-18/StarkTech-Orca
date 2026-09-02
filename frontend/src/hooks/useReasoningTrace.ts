/**
 * Live reasoning-trace hook.
 *
 * Owner: D · Phase: P2
 *
 * Subscribes to the trace WebSocket and accumulates steps for the panel. Steps arrive out
 * of order when specialists run in parallel — sort by `seq`, never by arrival.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { connectTraceSocket, type TraceSocket } from "@/api/socket";
import type { OrcaResponse, TraceEvent, TraceStep } from "@/types/orca";

export interface UseReasoningTrace {
  steps: TraceStep[];
  streaming: boolean;
  connected: boolean;
  clear(): void;
  /** Replace the live steps with the authoritative trace from the POST response. */
  settle(response: OrcaResponse): void;
  begin(): void;
}

export function useReasoningTrace(sessionId: string): UseReasoningTrace {
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const socketRef = useRef<TraceSocket | null>(null);

  const handleEvent = useCallback((event: TraceEvent) => {
    if (event.type !== "trace") return;

    setSteps((current) => {
      const step = event.payload;
      // A node emits `started` then `ok` for the same work. Key by agent+seq so both are
      // kept, but replace an exact seq match rather than duplicating on a reconnect.
      const next = current.filter((s) => s.seq !== step.seq);
      next.push(step);
      return next.sort((a, b) => a.seq - b.seq);
    });
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const socket = connectTraceSocket(sessionId, handleEvent, setConnected);
    socketRef.current = socket;

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [sessionId, handleEvent]);

  const clear = useCallback(() => setSteps([]), []);

  const begin = useCallback(() => {
    // Clear on a new query so turns don't bleed together.
    setSteps([]);
    setStreaming(true);
  }, []);

  const settle = useCallback((response: OrcaResponse) => {
    // The POST body is authoritative. Swapping to it resolves any `started` step whose
    // `ok` never arrived (a socket that dropped mid-run), so the panel can't be left
    // showing a spinner forever.
    setStreaming(false);
    if (response.reasoning_trace?.length) {
      setSteps([...response.reasoning_trace].sort((a, b) => a.seq - b.seq));
    }
  }, []);

  return { steps, streaming, connected, clear, settle, begin };
}
