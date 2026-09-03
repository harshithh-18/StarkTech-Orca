/**
 * ORCA application shell.
 *
 * Owner: D · Phase: P1 · Rebuilt P4
 *
 * ## Layout
 *
 * Desktop (≥1280px):
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │ TopBar — brand · working location · language · live · theme       │
 *   ├──┬────────────────────┬───────────────────────┬───────────────────┤
 *   │  │                    │                       │                   │
 *   │N │  Primary panel     │   Map                 │  Insight rail     │
 *   │a │  (the current      │   (always visible —   │  (only when there │
 *   │v │   nav view)        │    it is the point)   │   is an answer)   │
 *   │  │                    │                       │                   │
 *   ├──┴────────────────────┴───────────────────────┴───────────────────┤
 *   │ Reasoning trace — collapsible, streams live                       │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * Below 1280px the insight rail becomes a sheet over the map. Below 768px the nav rail
 * becomes a bottom tab bar, the map is its own destination, and only one panel is on
 * screen at a time — because stacking four panels into a phone viewport buries the
 * verdict under three scrolls, and the verdict is what the user came for.
 *
 * ## What lives here and what does not
 *
 * This file owns exactly three things: the session id, which view is showing, and which
 * map layers are on. Everything else is a hook or a panel. The session id in particular
 * has to be owned in one place — it keys the graph checkpointer (multi-turn memory), the
 * trace socket and the watch, and three components minting their own would silently
 * disconnect all three from each other.
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
import type { ChatMessage, Language, MapLayer, OrcaResponse } from "@/types/orca";

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

  // One id for the whole conversation: it keys the backend's multi-turn memory, the trace
  // socket and any watch. `New` mints a fresh one, which is what starts a clean memory.
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

  // The language of the last answer — what dictation and speech should use next, since a
  // Telugu speaker's follow-up will also be in Telugu.
  const [spokenLanguage, setSpokenLanguage] = useState<Language>(profile.language);
  const voice = useVoice((transcript) => ask(transcript));
  // Pulled out because `voice` is a fresh object each render while `speak` is a stable
  // callback — depending on the object would rebuild every consumer on every render.
  const { speak } = voice;

  const handleResponse = useCallback(
    (response: OrcaResponse) => {
      trace.settle(response);
      setSpokenLanguage(response.language);
      setRailOpen(true);

      // Speak safety verdicts without being asked. Someone on a boat at 4 a.m. may not be
      // looking at the screen, and the answer leads with the verdict — so the first thing
      // heard is "do not go to sea", not a preamble.
      if (response.verdict && response.verdict !== "NOT_APPLICABLE") {
        speak(response.answer, response.language);
      }

      // A new answer picks its own layers; drop manual additions so the map reflects the
      // current question rather than accumulating every past one.
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

  // Alerts shown as a banner: whichever surface is more current. A live answer's alerts
  // are a response to something just asked, so all of them show; the dashboard's were not
  // asked for, so only the consequential ones break through. See AlertBanner.
  const answerAlerts = latest?.alerts ?? [];
  const bannerAlerts = answerAlerts.length ? answerAlerts : conditions.data?.alerts ?? [];
  const bannerThreshold = answerAlerts.length ? undefined : CONSEQUENTIAL;

  const usedMockData = Boolean(latest?.used_mock_data || conditions.data?.used_mock_data);

  // Opening the Alerts view is what marks them read. Depends on `markRead` (a stable
  // callback) rather than on `watch`, which is a fresh object every render.
  const { markRead } = watch;
  useEffect(() => {
    if (view === "alerts") markRead();
  }, [view, markRead]);

  // ⌘K focuses the composer from anywhere in the app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView("ask");
        setMobileMap(false);
        // Deferred: the input may not be mounted yet if the view just changed.
        requestAnimationFrame(() => document.getElementById("orca-input")?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── First run ──────────────────────────────────────────────────────────
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
      />
    );
  }

  // Shared by the desktop rail and the mobile bar — the same navigation in two positions.
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
      className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-ocean-400 dark:border-white/10 dark:bg-abyss-850 dark:hover:border-ocean-500/60"
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
          watch.status?.watch.active
            ? "bg-emerald-500/15 band-go"
            : "bg-ocean-500/10 text-ocean-600 dark:bg-ocean-400/10 dark:text-ocean-300"
        }`}
      >
        <Icon name={watch.status?.watch.active ? "shield" : "bell"} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">
          {watch.status?.watch.active ? "Watch is running" : "Get warned without asking"}
        </span>
        <span className="block text-[11px] leading-snug muted">
          {watch.status?.watch.active
            ? `${watch.alerts.length} alert${watch.alerts.length === 1 ? "" : "s"} raised so far`
            : "ORCA re-checks this spot and tells you when conditions turn."}
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
          locationName={profile.location.name ?? "the selected point"}
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
        />
      )}

      {view === "layers" && (
        <LayersPanel
          fromAnswer={answerLayers}
          manual={manualLayers}
          onToggle={toggleLayer}
          basemap={basemap}
          onBasemapChange={setBasemap}
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
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-abyss-950">
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
      />

      <AlertBanner alerts={bannerAlerts} minimumSeverity={bannerThreshold} />

      {error && (
        <div
          role="alert"
          className="flex shrink-0 animate-slide-up items-center gap-2 border-b border-rose-500/25 bg-rose-500/[0.07] px-4 py-2 text-[12px] band-no_go"
        >
          <Icon name="alert" size={14} />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={dismissError}
            aria-label="Dismiss"
            className="rounded p-1 opacity-70 hover:bg-rose-500/10 hover:opacity-100"
          >
            <Icon name="close" size={13} />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <NavRail variant="rail" {...navProps} />

        {/* ── Primary panel ─────────────────────────────────────────── */}
        <section
          className={`min-h-0 flex-col border-slate-200 bg-white md:flex md:w-[360px] md:shrink-0 md:border-r xl:w-[392px] dark:border-white/10 dark:bg-abyss-900 ${
            mobileMap ? "hidden" : "flex flex-1"
          }`}
        >
          {panel}
        </section>

        {/* ── Map ───────────────────────────────────────────────────── */}
        <section
          className={`relative min-h-0 flex-1 ${mobileMap ? "block" : "hidden md:block"}`}
        >
          {/* The map is the most failure-prone thing on the page — third-party code
              drawing third-party tiles — and the least essential to an answer being
              readable. Its failures cost the map, not the application. */}
          <ErrorBoundary label="The map">
            <MapView
              center={latest?.location ?? profile.location}
              activeLayers={activeLayers}
              userLocation={profile.location}
              isDark={theme.isDark}
              basemap={basemap}
              sessionId={sessionId}
              onPickPoint={setLocation}
            />
          </ErrorBoundary>
          <MapLegend layers={activeLayers} />

          {/* The insight rail overlays the map below 1280px, where there is no third
              column to give it. */}
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
              className="absolute right-2 top-12 z-[400] rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-700 shadow-sm backdrop-blur hover:bg-white xl:hidden dark:border-white/10 dark:bg-abyss-900/90 dark:text-slate-200"
            >
              Show answer
            </button>
          )}
        </section>

        {/* ── Insight rail, as a real column on wide screens ─────────── */}
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

      {/* On a phone the map is a toggle rather than a tab: it belongs beside whatever
          panel is open, not instead of the navigation. Floated clear of the tab bar and
          the trace drawer so it never covers the map's own attribution. */}
      <button
        type="button"
        onClick={() => setMobileMap((value) => !value)}
        className="fixed bottom-[104px] right-3 z-[600] flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-700 shadow-lg md:hidden dark:border-white/10 dark:bg-abyss-850 dark:text-slate-100"
      >
        <Icon name={mobileMap ? "chat" : "map"} size={15} />
        {mobileMap ? "Panel" : "Map"}
      </button>

      <ReasoningTrace
        steps={trace.steps}
        streaming={trace.streaming}
        connected={socket.connected}
      />

      {/* The mobile tab bar is the last element on the page, below the trace drawer —
          a thumb-reachable bar that something else can scroll over is not one. */}
      <NavRail variant="bar" {...navProps} />
    </div>
  );
}
