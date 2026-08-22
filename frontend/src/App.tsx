/**
 * ORCA application shell.
 *
 * Owner: D · Phase: P1
 *
 * Layout (report §7): chat left, map right, reasoning trace along the bottom.
 *
 *   ┌──────────────┬────────────────────────────────┐
 *   │ AlertBanner (full width, only when alerts)    │
 *   ├──────────────┼────────────────────────────────┤
 *   │              │  MapView            [Layers]   │
 *   │  ChatPanel   │                                │
 *   │              ├────────────────────────────────┤
 *   │              │  VerdictCard + ForecastChart   │
 *   ├──────────────┴────────────────────────────────┤
 *   │ ReasoningTrace (collapsible, streams live)    │
 *   ├───────────────────────────────────────────────┤
 *   │ SourceCitations · attribution footer          │
 *   └───────────────────────────────────────────────┘
 *
 * On mobile this stacks: verdict first, then map, then chat, trace collapsed. The real
 * user is a fisherman on a phone — the verdict must be readable without scrolling.
 */

export default function App() {
  // TODO(P1, D): useOrcaQuery + useReasoningTrace; wire the panels together
  // TODO(P2, D): keep the map centred on the latest response location
  // TODO(P3, D): responsive stack for mobile; verdict above the fold
  return (
    <div className="min-h-screen bg-ocean-light">
      {/* TODO(P1, D): AlertBanner / ChatPanel / MapView / VerdictCard / ReasoningTrace */}
      <p className="p-8 text-ocean-deep">ORCA — scaffold. Nothing wired yet.</p>
    </div>
  );
}
