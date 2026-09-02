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

import { useCallback, useMemo, useState } from "react";

import AlertBanner from "@/components/AlertBanner";
import ChatPanel from "@/components/ChatPanel";
import ForecastChart from "@/components/ForecastChart";
import LayerToggles from "@/components/LayerToggles";
import MapView from "@/components/MapView";
import ReasoningTrace from "@/components/ReasoningTrace";
import SourceCitations from "@/components/SourceCitations";
import VerdictCard from "@/components/VerdictCard";
import { useOrcaQuery } from "@/hooks/useOrcaQuery";
import { useReasoningTrace } from "@/hooks/useReasoningTrace";
import type { MapLayer, OrcaResponse } from "@/types/orca";

/** The small-craft wave limit, mirrored from services/risk_rules.THRESHOLDS. */
const WAVE_THRESHOLD_M = 2.5;

export default function App() {
  const [manualLayers, setManualLayers] = useState<MapLayer[]>([]);

  // The trace hook needs the session id, and the query hook owns it — so the trace hook
  // is created first against a stable id and the query hook reports into it.
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `orca-${Date.now().toString(36)}`,
  );

  const trace = useReasoningTrace(sessionId);

  const handleResponse = useCallback(
    (response: OrcaResponse) => {
      // Swap the live steps for the authoritative trace from the POST body.
      trace.settle(response);
      // A new answer picks its own layers; drop the user's manual additions so the map
      // reflects the current question rather than accumulating every past one.
      setManualLayers([]);
    },
    [trace],
  );

  const { messages, latest, loading, error, coords, ask, retry } = useOrcaQuery({
    // Same id the trace socket is subscribed to, so the live steps actually arrive.
    sessionId,
    onResponse: handleResponse,
    onAskStart: trace.begin,
  });

  const activeLayers = useMemo(() => {
    const fromAnswer = latest?.map_layers ?? ["user_pin" as MapLayer];
    return [...new Set([...fromAnswer, ...manualLayers])];
  }, [latest, manualLayers]);

  const toggleLayer = useCallback((layer: MapLayer) => {
    setManualLayers((current) =>
      current.includes(layer)
        ? current.filter((item) => item !== layer)
        : [...current, layer],
    );
  }, []);

  const userLocation = coords
    ? { lat: coords.lat, lon: coords.lon, source: "gps" }
    : null;

  const verdictReasons = useMemo(() => {
    // The verdict card lists the fired rules; the answer text is the prose version of
    // the same thing, so showing both verbatim would just repeat itself.
    if (!latest?.verdict || latest.verdict === "NOT_APPLICABLE") return [];
    return latest.answer
      .split(/(?<=[.;])\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 3);
  }, [latest]);

  return (
    <div className="flex h-screen flex-col bg-ocean-light">
      <header className="flex items-center gap-2 bg-ocean-deep px-4 py-2 text-white">
        <span aria-hidden="true" className="text-lg">
          🐋
        </span>
        <h1 className="text-sm font-bold tracking-wide">ORCA</h1>
        <span className="hidden text-xs text-blue-200 sm:inline">
          Marine EcOsystem Reasoning with Collaborative Agents
        </span>
        {latest?.location && (
          <span className="ml-auto text-xs text-blue-200">
            {latest.location.name ?? "location"} ·{" "}
            {latest.location.lat.toFixed(2)}, {latest.location.lon.toFixed(2)}
          </span>
        )}
      </header>

      <AlertBanner alerts={latest?.alerts ?? []} />

      {error && (
        <div className="bg-red-50 px-4 py-1.5 text-xs text-red-800" role="alert">
          {error}
        </div>
      )}

      {/* Stacks on mobile (verdict above the fold), side-by-side from `md` up. */}
      <main className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        <section className="flex min-h-0 w-full flex-col border-slate-200 md:w-[380px] md:border-r">
          <ChatPanel
            messages={messages}
            loading={loading}
            onAsk={ask}
            onRetry={retry}
          />
        </section>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-[240px] flex-1">
            <MapView
              center={latest?.location ?? null}
              activeLayers={activeLayers}
              userLocation={userLocation}
            />
            <LayerToggles active={activeLayers} onToggle={toggleLayer} />
          </div>

          {(latest?.verdict || latest?.charts.length) && (
            <div className="max-h-[45%] space-y-3 overflow-y-auto border-t border-slate-200 bg-white p-3">
              <VerdictCard
                verdict={latest?.verdict ?? null}
                reasons={verdictReasons}
                evidence={latest?.evidence ?? []}
                usedMockData={latest?.used_mock_data}
              />
              {latest?.charts.map((chart) => (
                <ForecastChart
                  key={chart.id}
                  spec={chart}
                  thresholdY={chart.id === "wave_48h" ? WAVE_THRESHOLD_M : null}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <ReasoningTrace
        steps={trace.steps}
        streaming={trace.streaming}
        connected={trace.connected}
      />

      <SourceCitations
        evidence={latest?.evidence ?? []}
        attribution={latest?.attribution ?? []}
        usedMockData={latest?.used_mock_data}
      />
    </div>
  );
}
