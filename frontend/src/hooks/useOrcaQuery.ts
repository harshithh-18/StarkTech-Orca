/**
 * Conversation state.
 *
 * Owner: D · Phase: P1 · Rewired P4
 *
 * Owns the message list and the in-flight request. The session id is **passed in**, not
 * created here: it keys the LangGraph checkpointer (so "…and is it safe there?" resolves
 * against the previous turn) *and* addresses the trace socket, so exactly one owner —
 * `App` — has to decide when it changes. A hook that minted its own would leave the
 * socket subscribed to a session nobody publishes to.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { OrcaApiError, postQuery } from "@/api/client";
import type { ChatMessage, Language, Location, OrcaResponse } from "@/types/orca";

export interface UseOrcaQuery {
  messages: ChatMessage[];
  latest: OrcaResponse | null;
  loading: boolean;
  error: string | null;
  /** The device's own position, once granted. Null when refused or unavailable. */
  gps: Location | null;
  ask(query: string): Promise<void>;
  retry(messageId: string): Promise<void>;
  reset(): void;
  dismissError(): void;
}

export interface UseOrcaQueryOptions {
  /** MUST be the same id the trace socket subscribed to. */
  sessionId: string;
  /**
   * The point every query is about. Explicit rather than implicit device GPS: anyone
   * testing indoors is inland, where there is no marine forecast and every query
   * correctly returns nothing — which looks like a broken app.
   */
  location: Location | null;
  /** Forces the reply language. Null (the default) ⇒ detect it from the query. */
  language?: Language | null;
  onResponse?: (response: OrcaResponse) => void;
  onAskStart?: () => void;
}

export function useOrcaQuery(options: UseOrcaQueryOptions): UseOrcaQuery {
  const { sessionId, location, language, onResponse, onAskStart } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latest, setLatest] = useState<OrcaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gps, setGps] = useState<Location | null>(null);

  // Held in refs so `ask` keeps a stable identity as the location or language changes —
  // otherwise every consumer that depends on it rebuilds on each pan of the map.
  const locationRef = useRef<Location | null>(null);
  const languageRef = useRef<Language | null>(null);
  locationRef.current = location;
  languageRef.current = language ?? null;

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setGps({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          name: "My location",
          source: "gps",
        }),
      // Denied or unavailable is fine — the harbour picker is the primary path.
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
          lat: locationRef.current?.lat ?? null,
          lon: locationRef.current?.lon ?? null,
          language: languageRef.current,
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
        const message =
          exception instanceof OrcaApiError
            ? exception.displayText
            : "Could not reach ORCA. Is the backend running on port 8000?";
        setError(message);
        // Keep the failed turn in the list with its error, so it can be retried rather
        // than the user losing what they typed.
        setMessages((current) =>
          current.map((entry) =>
            entry.id === pendingId
              ? { ...entry, text: message, pending: false, failed: true }
              : entry,
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

      const stamp = Date.now();
      const pendingId = `o-${stamp}`;

      // Optimistic append: the graph takes a few seconds, and a frozen screen reads as a
      // crash.
      setMessages((current) => [
        ...current,
        { id: `u-${stamp}`, role: "user", text: trimmed },
        { id: pendingId, role: "orca", text: "", pending: true, query: trimmed },
      ]);

      await run(trimmed, pendingId);
    },
    [loading, run],
  );

  const retry = useCallback(
    async (messageId: string) => {
      const message = messages.find((entry) => entry.id === messageId);
      if (!message?.query || loading) return;

      setMessages((current) =>
        current.map((entry) =>
          entry.id === messageId
            ? { ...entry, pending: true, failed: false, text: "" }
            : entry,
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
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return { messages, latest, loading, error, gps, ask, retry, reset, dismissError };
}
