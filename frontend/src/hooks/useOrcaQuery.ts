/**
 * Conversation state hook.
 *
 * Owner: D · Phase: P1
 *
 * Owns the message list, the session id, and the in-flight request. One session id lives
 * for the whole conversation — that's what makes "…and is it safe there?" resolve against
 * the previous turn.
 */

import type { ChatMessage, OrcaResponse } from "@/types/orca";

export interface UseOrcaQuery {
  messages: ChatMessage[];
  latest: OrcaResponse | null;
  sessionId: string;
  loading: boolean;
  error: string | null;
  ask(query: string): Promise<void>;
  reset(): void;
}

/**
 * TODO(P1, D): messages state, session id on mount, postQuery on ask()
 * TODO(P1, D): push an optimistic user message and a pending ORCA message immediately —
 *              the graph takes a few seconds and a frozen screen reads as a crash
 * TODO(P2, D): pass device geolocation when the user has granted it
 * TODO(P3, D): keep failed turns in the list with a retry, don't drop them
 */
export function useOrcaQuery(): UseOrcaQuery {
  throw new Error("TODO(P1, D): not implemented");
}
