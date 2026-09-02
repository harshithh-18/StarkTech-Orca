/**
 * Conversation state hook.
 *
 * Owner: D · Phase: P1
 *
 * Owns the message list, the session id, and the in-flight request. One session id lives
 * for the whole conversation — that's what makes "…and is it safe there?" resolve against
 * the previous turn.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { newSessionId, OrcaApiError, postQuery } from "@/api/client";
import type { ChatMessage, OrcaResponse } from "@/types/orca";

export interface UseOrcaQuery {
  messages: ChatMessage[];
  latest: OrcaResponse | null;
  sessionId: string;
  loading: boolean;
  error: string | null;
  coords: { lat: number; lon: number } | null;
  ask(query: string): Promise<void>;
  retry(messageId: string): Promise<void>;
  reset(): void;
}

export interface UseOrcaQueryOptions {
  /** Session id to use. Must be the SAME id the trace socket subscribed to, or the live
   *  trace panel silently listens to a session nobody is publishing to. */
  sessionId?: string;
  onResponse?: (response: OrcaResponse) => void;
  onAskStart?: () => void;
}

export function useOrcaQuery(options: UseOrcaQueryOptions = {}): UseOrcaQuery {
  const { sessionId: providedSessionId, onResponse, onAskStart } = options;
  const [sessionId, setSessionId] = useState(() => providedSessionId ?? newSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latest, setLatest] = useState<OrcaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Kept in a ref so `ask` doesn't need to be rebuilt when the position arrives.
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        coordsRef.current = next;
        setCoords(next);
      },
      // Denied or unavailable is fine — the backend falls back to geocoding the query.
      () => undefined,
      { timeout: 5000, maximumAge: 300_000 },
    );
  }, []);

  const run = useCallback(
    async (text: string, pendingId: string) => {
      setLoading(true);
      setError(null);
      onAskStart?.();

      try {
        const response = await postQuery({
          query: text,
          session_id: sessionId,
          lat: coordsRef.current?.lat ?? null,
          lon: coordsRef.current?.lon ?? null,
        });

        setLatest(response);
        onResponse?.(response);
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? { ...message, text: response.answer, response, pending: false }
              : message,
          ),
        );
      } catch (exception) {
        const text =
          exception instanceof OrcaApiError
            ? exception.displayText
            : "Could not reach ORCA. Is the backend running?";
        setError(text);
        // Keep the failed turn in the list with its error, so the user can retry it
        // rather than losing what they typed.
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? { ...message, text, pending: false, failed: true }
              : message,
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [sessionId, onResponse, onAskStart],
  );

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userId = `u-${Date.now()}`;
      const pendingId = `o-${Date.now()}`;

      // Optimistic append: the graph takes a few seconds, and a frozen screen reads as
      // a crash.
      setMessages((current) => [
        ...current,
        { id: userId, role: "user", text: trimmed },
        { id: pendingId, role: "orca", text: "", pending: true, query: trimmed },
      ]);

      await run(trimmed, pendingId);
    },
    [loading, run],
  );

  const retry = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (!message?.query || loading) return;

      setMessages((current) =>
        current.map((m) =>
          m.id === messageId ? { ...m, pending: true, failed: false, text: "" } : m,
        ),
      );
      await run(message.query, messageId);
    },
    [messages, loading, run],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setLatest(null);
    setError(null);
    // A new session id starts a fresh conversation memory on the backend too.
    setSessionId(newSessionId());
  }, []);

  return { messages, latest, sessionId, loading, error, coords, ask, retry, reset };
}
