/**
 * Safety verdict card.
 *
 * Owner: D · Phase: P2
 *
 * The single most important element on the screen. A big GO / CAUTION / NO-GO badge, the
 * top two or three reasons, and the validity window.
 *
 * Design rule: **one glanceable verdict beats a wall of numbers.** The user may be reading
 * this at 4 a.m. on a phone before leaving harbour. Colour carries the meaning before the
 * words do — green, amber, red, and never rely on colour alone (add the word and an icon).
 */

import type { Evidence, Verdict } from "@/types/orca";

interface Props {
  verdict: Verdict | null;
  reasons: string[];
  evidence: Evidence[];
  validUntil?: string | null;
}

export default function VerdictCard(_props: Props) {
  // TODO(P2, D): large badge using theme colours verdict.go / .caution / .nogo
  // TODO(P2, D): top 2–3 reasons, each naming its value and threshold
  // TODO(P2, D): validity window — a verdict without a time is untrustworthy
  // TODO(P2, D): render nothing for NOT_APPLICABLE rather than an empty card
  // TODO(P3, D): show the `used_mock_data` badge here if set — honest degradation
  return <div>{/* TODO(P2, D) */}</div>;
}
