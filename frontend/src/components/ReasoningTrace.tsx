/**
 * Reasoning Trace panel — the differentiator.
 *
 * Owner: D · Phase: P2
 *
 * > This component is why the project looks agentic. Judges cannot see planning or tool
 * > selection unless we show it to them. Steps stream in live over the WebSocket as each
 * > agent completes, so the user literally watches the platform think.
 *
 * Collapsible, headed "How I decided this", **expanded by default during the demo**.
 *
 *   ✓ language_intent   Intent=safety_check, lang=te, resolved Kakinada→16.99,82.24
 *   ✓ planner           Planner → [Weather, Sea-state, Risk]
 *   ⟳ sea_state         Fetching Open-Meteo Marine…
 *   – marine_data       Skipped: not required for this intent
 *   ✗ imd_bulletins     Failed: timeout — continuing without cyclone data
 *
 * Status icons: started ⟳ · ok ✓ · skipped – · failed ✗
 *
 * Show the skipped and failed steps. A visible skip demonstrates that the system knows
 * what it doesn't know — that's the whole argument for evidence-based answers.
 */

import type { TraceStep } from "@/types/orca";

interface Props {
  steps: TraceStep[];
  streaming: boolean;
  defaultExpanded?: boolean;
}

export default function ReasoningTrace(_props: Props) {
  // TODO(P2, D): render sorted by seq with a status icon per step
  // TODO(P2, D): animate new steps in; a step that just appears is easy to miss on stage
  // TODO(P2, D): show the source next to each step that touched data
  // TODO(P2, D): summary line when collapsed — "4 agents · 2 sources · 1.2 s"
  // TODO(P3, D): monospace the agent names so the column aligns and scans cleanly
  return <div>{/* TODO(P2, D) */}</div>;
}
