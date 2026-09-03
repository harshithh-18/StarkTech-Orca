/**
 * Application header.
 *
 * Owner: D · Phase: P4
 *
 * Identity on the left, the working location in the middle, session controls on the
 * right. The location sits in the header rather than in a panel because every answer in
 * the app is *about* it — a user who cannot see which point they are asking about cannot
 * trust the answer they get.
 */

import Icon from "@/components/common/Icon";
import Logo from "@/components/common/Logo";
import LanguageSelect from "@/components/shell/LanguageSelect";
import LocationCommand from "@/components/shell/LocationCommand";
import ThemeToggle from "@/components/shell/ThemeToggle";
import type { Language, Location } from "@/types/orca";
import type { ThemeChoice } from "@/hooks/useTheme";

interface Props {
  location: Location;
  onLocationChange: (location: Location) => void;
  gps: Location | null;

  language: Language;
  /** True when replies follow the query's own language. */
  autoLanguage: boolean;
  /** `null` restores automatic detection. */
  onLanguageChange: (language: Language | null) => void;

  theme: ThemeChoice;
  onThemeCycle: () => void;

  /** Live socket + backend status, shown as one honest indicator. */
  connected: boolean;
  usingMockData: boolean;

  speaking: boolean;
  onStopSpeaking: () => void;

  hasConversation: boolean;
  onReset: () => void;
  /** Back to the welcome / setup screen. */
  onOpenSetup: () => void;
}

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
}: Props) {
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-4 dark:border-white/10 dark:bg-abyss-900">
      {/* ── Identity ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <Logo size={32} className="shadow-sm" />
        <div className="hidden min-w-0 sm:block">
          <p className="text-[15px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
            ORCA
          </p>
          <p className="mt-0.5 truncate text-[10.5px] leading-none muted">
            Marine intelligence console
          </p>
        </div>
      </div>

      <div aria-hidden="true" className="hidden h-6 w-px bg-slate-200 sm:block dark:bg-white/10" />

      {/* ── Working location ──────────────────────────────────────────── */}
      <LocationCommand value={location} onChange={onLocationChange} gps={gps} />

      {/* ── Session controls ──────────────────────────────────────────── */}
      <div className="ml-auto flex items-center gap-1.5">
        {usingMockData ? (
          <span
            title="Some values came from the offline demo cache, not a live model."
            className="chip hidden bg-amber-500/10 text-amber-700 sm:inline-flex dark:text-amber-300"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Demo data
          </span>
        ) : (
          <span
            title={
              connected
                ? "Live: connected to the reasoning stream."
                : "The reasoning stream is not connected — answers still arrive, but the trace fills in only when each one completes."
            }
            className={`chip hidden sm:inline-flex ${
              connected
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-500/10 text-slate-600 dark:text-slate-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? "animate-pulse bg-emerald-500" : "bg-slate-400"
              }`}
            />
            {connected ? "Live" : "Offline stream"}
          </span>
        )}

        {speaking && (
          <button
            type="button"
            onClick={onStopSpeaking}
            className="btn-ghost px-2.5 py-1.5"
            title="Stop reading the answer aloud"
          >
            <Icon name="volume" size={15} />
            <span className="hidden sm:inline">Stop</span>
          </button>
        )}

        <LanguageSelect value={language} auto={autoLanguage} onChange={onLanguageChange} />

        {hasConversation && (
          <button
            type="button"
            onClick={onReset}
            className="btn-ghost px-2.5 py-1.5"
            title="Clear the conversation and start again"
          >
            <Icon name="plus" size={15} />
            <span className="hidden md:inline">New</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSetup}
          className="btn-ghost px-2.5 py-1.5"
          title="Change your role, harbour and language"
        >
          <Icon name="agent" size={15} />
          <span className="hidden md:inline">Setup</span>
        </button>

        <ThemeToggle choice={theme} onCycle={onThemeCycle} />
      </div>
    </header>
  );
}
