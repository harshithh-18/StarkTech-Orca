/**
 * Application header — Maritime Operations Command Bar.
 *
 * Identity, coastal station telemetry, live sea safety beacon, and operational controls.
 */

import Icon from "@/components/common/Icon";
import Logo from "@/components/common/Logo";
import LanguageSelect from "@/components/shell/LanguageSelect";
import LocationCommand from "@/components/shell/LocationCommand";
import ThemeToggle from "@/components/shell/ThemeToggle";
import type { Language, Location, Verdict } from "@/types/orca";
import type { ThemeChoice } from "@/hooks/useTheme";

interface Props {
  location: Location;
  onLocationChange: (location: Location) => void;
  gps: Location | null;

  language: Language;
  /** True when replies follow query's own language. */
  autoLanguage: boolean;
  /** `null` restores automatic detection. */
  onLanguageChange: (language: Language | null) => void;

  theme: ThemeChoice;
  onThemeCycle: () => void;

  /** Live socket + backend status. */
  connected: boolean;
  usingMockData: boolean;

  speaking: boolean;
  onStopSpeaking: () => void;

  hasConversation: boolean;
  onReset: () => void;
  /** Back to the welcome / setup screen. */
  onOpenSetup: () => void;

  /** Current sea condition verdict to display in the header beacon. */
  conditionVerdict?: Verdict | null;
  /** Whether proactive safety watch is active. */
  watchActive?: boolean;
  /** Direct jumps to connected pages. */
  onOpenConditions?: () => void;
  onOpenAlerts?: () => void;
}

const BEACON_CONFIG: Record<
  Verdict,
  { label: string; bg: string; text: string; dot: string; glow: string }
> = {
  GO: {
    label: "Safe to Sail",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    glow: "shadow-emerald-500/20",
  },
  CAUTION: {
    label: "Caution Advisory",
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    glow: "shadow-amber-500/20",
  },
  NO_GO: {
    label: "Do Not Sail",
    bg: "bg-rose-500/10 border-rose-500/30",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    glow: "shadow-rose-500/20",
  },
  NOT_APPLICABLE: {
    label: "Port Monitoring",
    bg: "bg-slate-500/10 border-slate-500/20",
    text: "text-slate-600 dark:text-slate-300",
    dot: "bg-slate-400",
    glow: "",
  },
};

export default function TopBar({
  location,
  onLocationChange,
  gps,
  language,
  autoLanguage,
  onLanguageChange,
  theme,
  onThemeCycle,
  connected,
  usingMockData,
  speaking,
  onStopSpeaking,
  hasConversation,
  onReset,
  onOpenSetup,
  conditionVerdict,
  watchActive,
  onOpenConditions,
  onOpenAlerts,
}: Props) {
  const beacon = conditionVerdict ? BEACON_CONFIG[conditionVerdict] : null;

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2.5 sm:gap-3 border-b border-sky-200/80 bg-white/95 px-3 sm:px-4 backdrop-blur-md dark:border-cyan-500/15 dark:bg-abyss-900/95 shadow-sm">
      {/* ── Brand Identity ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <Logo size={34} rounded="rounded-xl" className="shadow-sm ring-1 ring-cyan-500/20" />
        <div className="hidden min-w-0 sm:block">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-black leading-none tracking-tight text-slate-900 dark:text-white bg-gradient-to-r from-ocean-600 via-teal-500 to-marine-500 bg-clip-text text-transparent">
              ORCA
            </span>
            <span className="rounded-full bg-ocean-500/15 px-1.5 py-0.2 text-[9px] font-bold text-ocean-700 dark:text-ocean-300 tracking-wider">
              OPS
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Marine Intelligence Console
          </p>
        </div>
      </div>

      <div aria-hidden="true" className="hidden h-6 w-px bg-sky-200 sm:block dark:bg-white/10" />

      {/* ── Coastal Station / Location ─────────────────────────────────── */}
      <LocationCommand value={location} onChange={onLocationChange} gps={gps} />

      {/* ── Live Sea Safety Beacon (Interactive Bridge to Conditions) ──── */}
      {beacon && onOpenConditions && (
        <button
          type="button"
          onClick={onOpenConditions}
          title="Click to view complete sea state, wind, and tidal readings"
          className={`hidden md:inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all hover:scale-[1.02] shadow-sm ${beacon.bg} ${beacon.text} ${beacon.glow}`}
        >
          <span className={`h-2 w-2 rounded-full animate-pulse ${beacon.dot}`} />
          <span>{beacon.label}</span>
          <Icon name="chevron" size={11} className="opacity-60" />
        </button>
      )}

      {/* ── Active Watch Telemetry Pill (Interactive Bridge to Alerts) ─── */}
      {watchActive && onOpenAlerts && (
        <button
          type="button"
          onClick={onOpenAlerts}
          title="Proactive radar safety watch is running on this location"
          className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 transition-all hover:scale-[1.02]"
        >
          <Icon name="radar" size={13} className="text-emerald-600 dark:text-emerald-400 animate-spin-slow" />
          <span>Watch Active</span>
        </button>
      )}

      {/* ── Session Controls & Telemetry Indicators ───────────────────── */}
      <div className="ml-auto flex items-center gap-1.5">
        {usingMockData ? (
          <span
            title="Some values came from the offline demo cache, not a live model."
            className="chip hidden bg-amber-500/10 text-amber-700 sm:inline-flex dark:text-amber-300 border border-amber-500/25"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Demo data
          </span>
        ) : (
          <span
            title={
              connected
                ? "Live: connected to the collaborative agent reasoning stream."
                : "The reasoning stream is operating in batch mode."
            }
            className={`chip hidden sm:inline-flex border ${
              connected
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                : "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? "animate-pulse bg-emerald-500" : "bg-slate-400"
              }`}
            />
            {connected ? "Telemetry Live" : "Offline"}
          </span>
        )}

        {speaking && (
          <button
            type="button"
            onClick={onStopSpeaking}
            className="btn-ghost px-2.5 py-1.5 text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/10"
            title="Stop audio broadcast"
          >
            <Icon name="volume" size={15} />
            <span className="hidden sm:inline">Mute</span>
          </button>
        )}

        <LanguageSelect value={language} auto={autoLanguage} onChange={onLanguageChange} />

        {hasConversation && (
          <button
            type="button"
            onClick={onReset}
            className="btn-ghost px-2.5 py-1.5"
            title="Clear the conversation and start a new mission query"
          >
            <Icon name="plus" size={15} />
            <span className="hidden md:inline">New</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSetup}
          className="btn-ghost px-2.5 py-1.5"
          title="Configure maritime role, base harbour and language"
        >
          <Icon name="anchor" size={15} />
          <span className="hidden md:inline">Setup</span>
        </button>

        <ThemeToggle choice={theme} onCycle={onThemeCycle} />
      </div>
    </header>
  );
}
