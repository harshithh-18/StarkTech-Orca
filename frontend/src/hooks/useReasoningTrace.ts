/**
 * Live reasoning-trace hook.
 *
 * Owner: D · Phase: P2 · Rewired P4 onto the shared socket
 *
 * Accumulates trace steps for the panel. Steps arrive out of order when specialists run in
 * parallel — sort by `seq`, never by arrival.
 *
 * The socket itself is owned by `useOrcaSocket`; this hook only subscribes. See that
 * file for why there can be only one connection per session.
 */

import { useCallback, useEffect, useState } from "react";

import type { TraceListener } from "@/hooks/useOrcaSocket";
import type { OrcaResponse, TraceStep } from "@/types/orca";

export interface UseReasoningTrace {
  steps: TraceStep[];
  streaming: boolean;
  clear(): void;
  /** Replace the live steps with the authoritative trace from the POST response. */
  settle(response: OrcaResponse): void;
  begin(): void;
}

export function useReasoningTrace(
  subscribe: (listener: TraceListener) => () => void,
): UseReasoningTrace {
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [streaming, setStreaming] = useState(false);

  useEffect(
    () =>
      subscribe((event) => {
        if (event.type !== "trace") return;

        setSteps((current) => {
          const step = event.payload;
          // A node emits `started` then `ok` for the same work. Replace an exact seq
          // match rather than duplicating it on a reconnect.
          const next = current.filter((s) => s.seq !== step.seq);
          next.push(step);
          return next.sort((a, b) => a.seq - b.seq);
        });
      }),
    [subscribe],
  );

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

  return { steps, streaming, clear, settle, begin };
}
