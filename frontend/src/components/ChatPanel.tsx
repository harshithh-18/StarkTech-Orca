/**
 * Conversational chat panel.
 *
 * Owner: D · Phase: P1
 *
 * Multi-turn, streaming, language auto-detected from what the user types. The input must
 * accept regional scripts — no Latin-only validation anywhere near this box.
 */

import type { ChatMessage } from "@/types/orca";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  onAsk: (query: string) => void;
}

export default function ChatPanel(_props: Props) {
  // TODO(P1, D): message list + input; Enter to send, Shift+Enter for newline
  // TODO(P1, D): auto-scroll to the newest message
  // TODO(P2, D): suggested-query chips for the four golden queries — they make the demo
  //              flow smoothly and show a first-time user what ORCA can do
  // TODO(P3, F): mic button wired to the voice pipeline (stretch)
  return <div className="flex flex-col h-full">{/* TODO(P1, D) */}</div>;
}
