/**
 * One chat message.
 *
 * Owner: D · Phase: P1
 *
 * An ORCA message is not just text: it carries the verdict badge, the top reasons and a
 * link into its own evidence. Keep it glanceable — the detail belongs in the trace panel.
 */

import type { ChatMessage } from "@/types/orca";

interface Props {
  message: ChatMessage;
}

export default function MessageBubble(_props: Props) {
  // TODO(P1, D): user right / ORCA left; pending state shows a typing indicator
  // TODO(P2, D): inline verdict badge on safety answers
  // TODO(P2, D): "why?" affordance that expands this turn's evidence
  // TODO(P3, D): set dir/lang on the element so Indic scripts shape and wrap correctly
  return <div>{/* TODO(P1, D) */}</div>;
}
