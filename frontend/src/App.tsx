/**
 * ORCA application shell.
 *
 * Owner: D · Phase: P1 · Polished P3
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
 * On mobile this becomes tabs — Answer / Map / Chat — because stacking four panels in a
 * phone viewport buries the verdict below three scrolls. The verdict is what the user
 * came for and it must be readable without scrolling.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AlertBanner from "@/components/AlertBanner";
import ChatPanel from "@/components/ChatPanel";
import ForecastChart from "@/components/ForecastChart";
import LayerToggles from "@/components/LayerToggles";
import LocationPicker, { HARBOURS, type PickedLocation } from "@/components/LocationPicker";
import MapView from "@/components/MapView";
import ReasoningTrace from "@/components/ReasoningTrace";
import SourceCitations from "@/components/SourceCitations";
import ThemeToggle from "@/components/ThemeToggle";
import VerdictCard from "@/components/VerdictCard";
import { useOrcaQuery } from "@/hooks/useOrcaQuery";
import { useReasoningTrace } from "@/hooks/useReasoningTrace";
import { useTheme } from "@/hooks/useTheme";
import { useVoice } from "@/hooks/useVoice";
import type { ChatMessage, Language, MapLayer, OrcaResponse } from "@/types/orca";

/** The small-craft wave limit, mirrored from services/risk_rules.THRESHOLDS. */
const WAVE_THRESHOLD_M = 2.5;

type MobileTab = "answer" | "map" | "chat";

export default function App() {
  const [manualLayers, setManualLayers] = useState<MapLayer[]>([]);

  // Defaults to a harbour, not the device. ORCA answers about the sea, and anyone
  // demonstrating this is indoors and inland — where there is genuinely no marine
  // forecast, so every query correctly returns nothing and it looks broken.
  const [picked, setPicked] = useState<PickedLocation | null>(() => {
    const kakinada = HARBOURS[0];
    return { lat: kakinada.lat, lon: kakinada.lon, name: kakinada.name, source: "harbour" };
  });
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const theme = useTheme();

  // The trace hook needs the session id, and the query hook owns it — so the id is
  // created here and handed to both, or the socket listens to a session nobody publishes.
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `orca-${Date.now().toString(36)}`,
  );

  const trace = useReasoningTrace(sessionId);

  // The language of the last answer — what dictation and speech should use next, since a
  // Telugu speaker's follow-up will also be in Telugu.
  const [voiceLanguage, setVoiceLanguage] = useState<Language>("en");
  const askRef = useRef<((query: string) => void) | null>(null);

  // A finished transcript is submitted immediately: making the user press send after
  // speaking defeats the point of asking by voice.
  const voice = useVoice((transcript) => askRef.current?.(transcript));
  // Pulled out because `voice` is a fresh object each render while `speak` is a stable
  // callback — depending on the object would rebuild every consumer on every render.
  const { speak } = voice;

  const handleResponse = useCallback(
    (response: OrcaResponse) => {
      trace.settle(response);
      setVoiceLanguage(response.language);

      // Speak safety verdicts without being asked. Someone on a boat at 4 a.m. may not be
      // looking at the screen, and the answer already leads with the verdict — so the
      // first thing heard is "do not go to sea", not a preamble.
      if (response.verdict && response.verdict !== "NOT_APPLICABLE") {
        speak(response.answer, response.language);
      }
      // A new answer picks its own layers; drop manual additions so the map reflects the
      // current question rather than accumulating every past one.
      setManualLayers([]);
      // On a phone, jump to the answer — that is what was asked for.
      setMobileTab(response.verdict || response.charts.length ? "answer" : "chat");
    },
    [trace, speak],
  );

  const { messages, latest, loading, error, coords, ask, retry, reset } = useOrcaQuery({
    // Same id the trace socket is subscribed to, so the live steps actually arrive.
    sessionId,
    // The chosen harbour, not the device — see the note on `picked` above.
    location: picked,
    onResponse: handleResponse,
    onAskStart: trace.begin,
  });

  const activeLayers = useMemo(() => {
    const fromAnswer = latest?.map_layers ?? (["user_pin"] as MapLayer[]);
    return [...new Set([...fromAnswer, ...manualLayers])];
  }, [latest, manualLayers]);

  const toggleLayer = useCallback((layer: MapLayer) => {
    setManualLayers((current) =>
      current.includes(layer)
        ? current.filter((item) => item !== layer)
        : [...current, layer],
    );
  }, []);

  // Pin what we are actually asking about, not where the browser happens to be.
  const userLocation = picked
    ? { lat: picked.lat, lon: picked.lon, name: picked.name, source: picked.source }
    : coords
      ? { lat: coords.lat, lon: coords.lon, source: "gps" }
      : null;

  askRef.current = ask;

  const speakMessage = useCallback(
    (message: ChatMessage) => {
      if (voice.speaking) {
        voice.stopSpeaking();
        return;
      }
      voice.speak(message.text, message.response?.language ?? voiceLanguage);
    },
    [voice, voiceLanguage],
  );

  const useGps = useCallback(() => {
    if (coords) setPicked({ ...coords, name: "My location", source: "gps" });
  }, [coords]);

  const verdictReasons = useMemo(() => {
    if (!latest?.verdict || latest.verdict === "NOT_APPLICABLE") return [];
    return latest.answer
      .split(/(?<=[.;])\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 3);
  }, [latest]);

  const hasAnswerPanel = Boolean(latest?.verdict || latest?.charts.length);

  // Ctrl/Cmd+K focuses the input — small, but it makes a live demo feel deliberate.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("orca-input")?.focus();
        setMobileTab("chat");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-abyss-950">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="relative z-20 flex shrink-0 items-center gap-3 bg-ocean-gradient px-4 py-2.5 text-white shadow-lg dark:bg-abyss-gradient">
        {/* Slow-drifting gradient wash: alive, but never distracting. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 animate-gradient-drift bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]"
        />

        <span aria-hidden="true" className="relative text-2xl drop-shadow">
          🐋
        </span>
        <div className="relative min-w-0">
          <h1 className="text-base font-extrabold leading-none tracking-tight">
            ORCA
          </h1>
          <p className="hidden truncate text-[10px] text-ocean-100/90 sm:block">
            Marine EcOsystem Reasoning with Collaborative Agents
          </p>
        </div>

        <div className="relative ml-auto flex items-center gap-1.5">
          <div className="hidden sm:block">
            <LocationPicker
              value={picked}
              onChange={setPicked}
              gpsAvailable={coords !== null}
              onUseGps={useGps}
            />
          </div>
          {voice.speaking && (
            <button
              type="button"
              onClick={voice.stopSpeaking}
              title="Stop reading aloud"
              className="flex h-8 items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2 text-xs font-medium transition-all hover:bg-white/20"
            >
              <span aria-hidden="true">🔊</span> Stop
            </button>
          )}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              title="Start a new conversation"
              className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium transition-all hover:scale-105 hover:bg-white/20 active:scale-95"
            >
              New
            </button>
          )}
          <ThemeToggle choice={theme.choice} onCycle={theme.cycle} />
        </div>
      </header>

      <AlertBanner alerts={latest?.alerts ?? []} />

      {error && (
        <div
          role="alert"
          className="animate-slide-up border-b border-coral-500/30 bg-coral-500/10 px-4 py-2 text-xs font-medium text-coral-600 dark:text-coral-300"
        >
          {error}
        </div>
      )}

      {/* ── Mobile tabs ───────────────────────────────────────────────── */}
      <nav className="flex shrink-0 border-b border-slate-200 bg-white md:hidden dark:border-white/10 dark:bg-abyss-900">
        {(
          [
            ["answer", hasAnswerPanel ? "Answer" : "Answer", hasAnswerPanel],
            ["map", "Map", true],
            ["chat", "Ask", true],
          ] as [MobileTab, string, boolean][]
        ).map(([tab, label, enabled]) => (
          <button
            key={tab}
            type="button"
            disabled={!enabled}
            onClick={() => setMobileTab(tab)}
            className={[
              "relative flex-1 px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-35",
              mobileTab === tab
                ? "text-ocean-600 dark:text-ocean-300"
                : "text-slate-500 dark:text-slate-400",
            ].join(" ")}
          >
            {label}
            {mobileTab === tab && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-ocean-500 dark:bg-ocean-400" />
            )}
          </button>
        ))}
      </nav>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="flex min-h-0 flex-1 md:flex-row">
        {/* Chat */}
        <section
          className={[
            "min-h-0 w-full flex-col border-slate-200 md:flex md:w-[380px] md:border-r dark:border-white/10",
            mobileTab === "chat" ? "flex" : "hidden",
          ].join(" ")}
        >
          <ChatPanel
            messages={messages}
            loading={loading}
            onAsk={ask}
            onRetry={retry}
            onSpeak={speakMessage}
            voice={{
              supported: voice.supported,
              listening: voice.listening,
              listen: () => voice.listen(voiceLanguage),
              stopListening: voice.stopListening,
            }}
          />
        </section>

        {/* Map + answer */}
        <section className="min-h-0 flex-1 flex-col md:flex">
          <div
            className={[
              "relative min-h-0 flex-1",
              mobileTab === "map" ? "block" : "hidden md:block",
            ].join(" ")}
          >
            <MapView
              center={latest?.location ?? null}
              activeLayers={activeLayers}
              userLocation={userLocation}
              isDark={theme.isDark}
              sessionId={sessionId}
            />
            <LayerToggles active={activeLayers} onToggle={toggleLayer} />
          </div>

          {hasAnswerPanel && (
            <div
              className={[
                "min-h-0 space-y-3 overflow-y-auto border-slate-200 bg-white p-3 md:max-h-[46%] md:border-t dark:border-white/10 dark:bg-abyss-900",
                mobileTab === "answer" ? "block flex-1" : "hidden md:block",
              ].join(" ")}
            >
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
                  isDark={theme.isDark}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Trace + citations ─────────────────────────────────────────── */}
      <div className="shrink-0">
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
    </div>
  );
}
