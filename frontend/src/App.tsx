/**
 * ORCA application shell — Maritime Operations & Intelligence Console.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { newSessionId } from "@/api/client";
import AlertBanner, { CONSEQUENTIAL } from "@/components/alerts/AlertBanner";
import AlertsPanel from "@/components/alerts/AlertsPanel";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import Icon from "@/components/common/Icon";
import ConditionsPanel from "@/components/conditions/ConditionsPanel";
import ConversationPanel from "@/components/conversation/ConversationPanel";
import InsightRail from "@/components/insight/InsightRail";
import ReasoningTrace from "@/components/insight/ReasoningTrace";
import SourcesPanel from "@/components/insight/SourcesPanel";
import LayersPanel from "@/components/map/LayersPanel";
import MapLegend from "@/components/map/MapLegend";
import MapView from "@/components/map/MapView";
import type { BasemapId } from "@/components/map/mapConfig";
import NavRail, { type View } from "@/components/shell/NavRail";
import TopBar from "@/components/shell/TopBar";
import WelcomeScreen from "@/components/welcome/WelcomeScreen";
import { useConditions } from "@/hooks/useConditions";
import { useOrcaQuery } from "@/hooks/useOrcaQuery";
import { useOrcaSocket } from "@/hooks/useOrcaSocket";
import { useProfile } from "@/hooks/useProfile";
import { useReasoningTrace } from "@/hooks/useReasoningTrace";
import { useTheme } from "@/hooks/useTheme";
import { useVoice } from "@/hooks/useVoice";
import { useWatch } from "@/hooks/useWatch";
import type { ChatMessage, Language, MapLayer, OrcaResponse, WatchAlert } from "@/types/orca";

export default function App() {
  const theme = useTheme();
  const {
    profile,
    setRole,
    setLanguage,
    setLocation,
    complete,
    reopenSetup,
  } = useProfile();

  const [sessionId, setSessionId] = useState(newSessionId);
  const [view, setView] = useState<View>("ask");
  const [manualLayers, setManualLayers] = useState<MapLayer[]>([]);
  const [basemap, setBasemap] = useState<BasemapId>("ocean");
  const [railOpen, setRailOpen] = useState(true);
  const [mobileMap, setMobileMap] = useState(false);

  const socket = useOrcaSocket(sessionId);
  const trace = useReasoningTrace(socket.subscribe);
  const watch = useWatch(sessionId, socket.subscribe);
  const conditions = useConditions(profile.location);

  const [spokenLanguage, setSpokenLanguage] = useState<Language>(profile.language);
  const voice = useVoice((transcript) => ask(transcript));
  const { speak } = voice;

  const handleResponse = useCallback(
    (response: OrcaResponse) => {
      trace.settle(response);
      setSpokenLanguage(response.language);
      setRailOpen(true);

      if (response.verdict && response.verdict !== "NOT_APPLICABLE") {
        speak(response.answer, response.language);
      }

      setManualLayers([]);
    },
    [trace, speak],
  );

  const { messages, latest, loading, error, gps, ask, retry, reset, dismissError } =
    useOrcaQuery({
      sessionId,
      location: profile.location,
      language: profile.autoLanguage ? null : profile.language,
      onResponse: handleResponse,
      onAskStart: trace.begin,
    });

  const handleAskPrompt = useCallback(
    (prompt: string) => {
      setView("ask");
      setMobileMap(false);
      ask(prompt);
    },
    [ask],
  );

  const answerLayers = useMemo<MapLayer[]>(
    () => latest?.map_layers ?? ["user_pin"],
    [latest],
  );

  const activeLayers = useMemo(
    () => [...new Set([...answerLayers, ...manualLayers])],
    [answerLayers, manualLayers],
  );

  const toggleLayer = useCallback((layer: MapLayer) => {
    setManualLayers((current) =>
      current.includes(layer)
        ? current.filter((entry) => entry !== layer)
        : [...current, layer],
    );
  }, []);

  const startNewConversation = useCallback(() => {
    reset();
    trace.clear();
    setManualLayers([]);
    setSessionId(newSessionId());
    setView("ask");
  }, [reset, trace]);

  const speakMessage = useCallback(
    (message: ChatMessage) => {
      if (voice.speaking) {
        voice.stopSpeaking();
        return;
      }
      voice.speak(message.text, message.response?.language ?? spokenLanguage);
    },
    [voice, spokenLanguage],
  );

  const answerAlerts = latest?.alerts ?? [];
  const bannerAlerts = answerAlerts.length ? answerAlerts : conditions.data?.alerts ?? [];
  const bannerThreshold = answerAlerts.length ? undefined : CONSEQUENTIAL;

  const usedMockData = Boolean(latest?.used_mock_data || conditions.data?.used_mock_data);

  const { markRead } = watch;
  useEffect(() => {
    if (view === "alerts") markRead();
  }, [view, markRead]);

  // ⌘K focuses composer
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView("ask");
        setMobileMap(false);
        requestAnimationFrame(() => document.getElementById("orca-input")?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── First Run Onboarding ──────────────────────────────────────────────
  if (!profile.onboarded) {
    return (
      <WelcomeScreen
        role={profile.role}
        language={profile.language}
        autoLanguage={profile.autoLanguage}
        location={profile.location}
        onRoleChange={setRole}
        onLanguageChange={setLanguage}
        onLocationChange={setLocation}
        onEnter={complete}
        theme={theme.choice}
        onThemeCycle={theme.cycle}
      />
    );
  }

  const navProps = {
    view,
    onChange: (next: View) => {
      setView(next);
      setMobileMap(false);
    },
    alertCount: watch.unread,
    conditionBand: conditions.data
      ? (({ GO: "go", CAUTION: "caution", NO_GO: "no_go", NOT_APPLICABLE: "none" } as const)[
          conditions.data.verdict
        ])
      : undefined,
  };

  const watchToggle = (
    <button
      type="button"
      onClick={() => setView("alerts")}
      className="flex w-full items-center gap-3 rounded-2xl border border-sky-100 bg-white/95 p-3 text-left transition-all hover:border-ocean-400 hover:shadow-md dark:border-white/10 dark:bg-abyss-850 dark:hover:border-cyan-400/40"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-bold ${
          watch.status?.watch.active
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-sm"
            : "bg-ocean-500/10 text-ocean-700 dark:bg-ocean-400/10 dark:text-cyan-300"
        }`}
      >
        <Icon name={watch.status?.watch.active ? "shield" : "radar"} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-slate-900 dark:text-slate-100">
          {watch.status?.watch.active ? "Safety Watch Active" : "Arm Automated Watch"}
        </span>
        <span className="block text-[11px] leading-snug muted">
          {watch.status?.watch.active
            ? `${watch.alerts.length} event${watch.alerts.length === 1 ? "" : "s"} logged for this station`
            : "ORCA runs periodic background sweeps and notifies you of hazard changes."}
        </span>
      </span>
      <Icon name="arrow-right" size={14} className="text-slate-300 dark:text-slate-600" />
    </button>
  );

  const panel = (
    <>
      {view === "ask" && (
        <ConversationPanel
          messages={messages}
          loading={loading}
          role={profile.role}
          locationName={profile.location.name ?? "the selected coordinates"}
          onAsk={ask}
          conditions={conditions.data}
          conditionsLoading={conditions.loading}
          onOpenConditions={() => setView("conditions")}
          onRetry={retry}
          onSpeak={speakMessage}
          speaking={voice.speaking}
          voice={{
            supported: voice.supported,
            listening: voice.listening,
            listen: () => voice.listen(spokenLanguage),
            stopListening: voice.stopListening,
          }}
        />
      )}

      {view === "conditions" && (
        <ConditionsPanel
          location={profile.location}
          data={conditions.data}
          loading={conditions.loading}
          error={conditions.error}
          updatedAt={conditions.updatedAt}
          onRefresh={conditions.refresh}
          isDark={theme.isDark}
          watchSlot={watchToggle}
          onGoToCoast={setLocation}
          onAskPrompt={handleAskPrompt}
        />
      )}

      {view === "alerts" && (
        <AlertsPanel
          location={profile.location}
          status={watch.status}
          alerts={watch.alerts}
          starting={watch.starting}
          error={watch.error}
          onStart={() => watch.start(profile.location, profile.language)}
          onStop={watch.stop}
          onShowOnMap={(coords) => {
            if (coords) setLocation(coords);
            setMobileMap(true);
          }}
          onAskAdvice={(alert: WatchAlert) => {
            handleAskPrompt(
              `What operational precautions should my boat take regarding this coastal alert: "${alert.title}" (${alert.detail})?`,
            );
          }}
        />
      )}

      {view === "layers" && (
        <LayersPanel
          fromAnswer={answerLayers}
          manual={manualLayers}
          onToggle={toggleLayer}
          basemap={basemap}
          onBasemapChange={setBasemap}
          onQueryLayer={handleAskPrompt}
        />
      )}

      {view === "sources" && (
        <SourcesPanel
          evidence={latest?.evidence ?? conditions.data?.evidence ?? []}
          attribution={latest?.attribution ?? conditions.data?.attribution ?? []}
          usedMockData={usedMockData}
        />
      )}
    </>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden maritime-cinema-canvas">
      <TopBar
        location={profile.location}
        onLocationChange={setLocation}
        gps={gps}
        language={profile.language}
        autoLanguage={profile.autoLanguage}
        onLanguageChange={setLanguage}
        theme={theme.choice}
        onThemeCycle={theme.cycle}
        connected={socket.connected}
        usingMockData={usedMockData}
        speaking={voice.speaking}
        onStopSpeaking={voice.stopSpeaking}
        hasConversation={messages.length > 0}
        onReset={startNewConversation}
        onOpenSetup={reopenSetup}
        conditionVerdict={conditions.data?.verdict}
        watchActive={Boolean(watch.status?.watch.active)}
        onOpenConditions={() => {
          setView("conditions");
          setMobileMap(false);
        }}
        onOpenAlerts={() => {
          setView("alerts");
          setMobileMap(false);
        }}
      />

      <AlertBanner alerts={bannerAlerts} minimumSeverity={bannerThreshold} />

      {error && (
        <div
          role="alert"
          className="flex shrink-0 animate-slide-up items-center gap-2 border-b border-rose-500/25 bg-rose-500/[0.08] px-4 py-2 text-[12px] band-no_go"
        >
          <Icon name="alert" size={14} />
          <span className="flex-1 font-medium">{error}</span>
          <button
            type="button"
            onClick={dismissError}
            aria-label="Dismiss error notification"
            className="rounded p-1 opacity-70 hover:bg-rose-500/10 hover:opacity-100"
          >
            <Icon name="close" size={13} />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <NavRail variant="rail" {...navProps} />

        {/* ── Primary Panel ─────────────────────────────────────────── */}
        <section
          className={`min-h-0 flex-col border-r border-slate-200 bg-white md:flex md:w-[380px] md:shrink-0 xl:w-[410px] dark:border-slate-800 dark:bg-[#0a1424] shadow-xl ${
            mobileMap ? "hidden" : "flex flex-1"
          }`}
        >
          {panel}
        </section>

        {/* ── Map Chart Room ────────────────────────────────────────── */}
        <section
          className={`relative min-h-0 flex-1 ${mobileMap ? "block" : "hidden md:block"}`}
        >
          <ErrorBoundary label="The Maritime Chart Engine">
            <MapView
              center={latest?.location ?? profile.location}
              activeLayers={activeLayers}
              userLocation={profile.location}
              isDark={theme.isDark}
              basemap={basemap}
              sessionId={sessionId}
              onPickPoint={setLocation}
              onAskPrompt={handleAskPrompt}
              onOpenConditions={() => {
                setView("conditions");
                setMobileMap(false);
              }}
            />
          </ErrorBoundary>
          <MapLegend layers={activeLayers} />

          {/* Insight Rail as Sheet on smaller screens */}
          {latest && railOpen && (
            <div className="absolute inset-y-0 right-0 z-[500] w-full max-w-[380px] shadow-2xl xl:hidden">
              <InsightRail
                response={latest}
                isDark={theme.isDark}
                onClose={() => setRailOpen(false)}
                onOpenSources={() => setView("sources")}
              />
            </div>
          )}

          {latest && !railOpen && (
            <button
              type="button"
              onClick={() => setRailOpen(true)}
              className="absolute right-3 top-14 z-[400] rounded-xl border border-sky-200/80 bg-white/95 px-3 py-1.5 text-[11.5px] font-bold text-ocean-700 shadow-md backdrop-blur hover:bg-white xl:hidden dark:border-cyan-500/20 dark:bg-abyss-900/95 dark:text-cyan-300"
            >
              Show Answer Intelligence
            </button>
          )}
        </section>

        {/* ── Insight Rail (Fixed Column on Wide Screens) ────────────── */}
        {latest && railOpen && (
          <div className="hidden xl:block">
            <InsightRail
              response={latest}
              isDark={theme.isDark}
              onClose={() => setRailOpen(false)}
              onOpenSources={() => setView("sources")}
            />
          </div>
        )}
      </div>

      {/* Floating Mobile Toggle Button */}
      <button
        type="button"
        onClick={() => setMobileMap((value) => !value)}
        className="fixed bottom-[104px] right-3.5 z-[600] flex items-center gap-2 rounded-full border border-emerald-400/50 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-xl shadow-emerald-600/30 md:hidden active:scale-95"
      >
        <Icon name={mobileMap ? "chat" : "map"} size={16} />
        {mobileMap ? "Operations Panel" : "Ocean Chart"}
      </button>

      <ReasoningTrace
        steps={trace.steps}
        streaming={trace.streaming}
        connected={socket.connected}
      />

      <NavRail variant="bar" {...navProps} />
    </div>
  );
}
