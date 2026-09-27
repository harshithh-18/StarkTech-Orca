/**
 * First run — Welcome & Maritime Console Onboarding.
 */

import { useState } from "react";

import Icon, { type IconName } from "@/components/common/Icon";
import Logo from "@/components/common/Logo";
import { useHarbours } from "@/hooks/useHarbours";
import { LANGUAGES, ROLES } from "@/hooks/useProfile";
import type { Language, Location, Role } from "@/types/orca";

interface Props {
  role: Role;
  language: Language;
  autoLanguage: boolean;
  location: Location;
  onRoleChange: (role: Role) => void;
  onLanguageChange: (language: Language | null) => void;
  onLocationChange: (location: Location) => void;
  onEnter: () => void;
}

const HOW_IT_WORKS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "chat",
    title: "Multilingual Voice & Text",
    body: "Ask in Tamil, Telugu, Malayalam, Bengali, Hindi or English. ORCA automatically detects coastal dialects and answers in the same tongue.",
  },
  {
    icon: "agent",
    title: "Collaborative Agent Swarm",
    body: "Supervisor and specialist agents dispatch in parallel across marine satellites, weather models, geofencing, and risk estimators.",
  },
  {
    icon: "shield",
    title: "Verdicts with Full Evidence",
    body: "Instant Go / Caution / No-Go safety verdicts backed by raw sensor readings, exact timestamps, and verified Copernicus/Open-Meteo sources.",
  },
];

const COAST_TABS = [
  { id: "all", label: "All Harbours" },
  { id: "east", label: "Bay of Bengal (East)" },
  { id: "west", label: "Arabian Sea (West)" },
] as const;

export default function WelcomeScreen({
  role,
  language,
  autoLanguage,
  location,
  onRoleChange,
  onLanguageChange,
  onLocationChange,
  onEnter,
}: Props) {
  const [harbourQuery, setHarbourQuery] = useState("");
  const [coastFilter, setCoastFilter] = useState<"all" | "east" | "west">("all");
  const allHarbours = useHarbours();

  const harbours = allHarbours.filter((harbour) => {
    const matchesCoast = coastFilter === "all" || harbour.coast === coastFilter;
    const matchesQuery =
      !harbourQuery.trim() ||
      harbour.name!.toLowerCase().includes(harbourQuery.trim().toLowerCase()) ||
      harbour.state.toLowerCase().includes(harbourQuery.trim().toLowerCase());
    return matchesCoast && matchesQuery;
  });

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-sky-50/40 dark:from-abyss-950 dark:via-abyss-900 dark:to-abyss-950">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* ── Masthead Hero ───────────────────────────────────────────── */}
        <header className="animate-slide-up relative overflow-hidden rounded-3xl border border-ocean-500/20 bg-gradient-to-br from-abyss-950 via-ocean-950 to-marine-950 p-6 sm:p-10 text-white shadow-2xl">
          {/* Subtle ocean decorative glow */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Logo size={52} rounded="rounded-2xl" className="shadow-lg ring-2 ring-cyan-400/30" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-black tracking-tight text-white">ORCA</h1>
                  <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-cyan-300 border border-cyan-400/30">
                    GOV OF INDIA · SIH
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] font-medium text-cyan-100/80">
                  Marine EcOsystem Reasoning with Collaborative Agents
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 backdrop-blur border border-white/10 self-start sm:self-auto">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11.5px] font-medium text-emerald-200">
                Satellite & Weather Telemetry Online
              </span>
            </div>
          </div>

          <p className="relative z-10 mt-6 max-w-2xl text-[14.5px] leading-relaxed text-slate-200 sm:text-[15.5px]">
            Designed for India's coastal stakeholders—fisherfolk, harbour masters, coastal
            authorities, and marine scientists. Ask about potential fishing zones, sailing safety,
            cyclone hazards, and maritime borders in your native language, with explainable AI reasoning
            powered by live oceanographic models.
          </p>
        </header>

        {/* ── Key Capabilities ────────────────────────────────────────── */}
        <section
          className="mt-6 grid gap-3 sm:grid-cols-3"
          style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
        >
          {HOW_IT_WORKS.map((step, index) => (
            <div
              key={step.title}
              className="card-ocean animate-slide-up p-4 transition-all hover:scale-[1.01]"
              style={{
                animationDelay: `${80 + index * 60}ms`,
                animationFillMode: "backwards",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-ocean-500/20 to-marine-500/20 text-ocean-700 dark:text-cyan-300">
                  <Icon name={step.icon} size={17} />
                </span>
                <span className="font-mono text-[11px] font-black text-slate-300 dark:text-slate-600">
                  0{index + 1}
                </span>
              </div>
              <h2 className="mt-3 text-[13.5px] font-bold text-slate-900 dark:text-slate-100">
                {step.title}
              </h2>
              <p className="mt-1 text-[11.5px] leading-relaxed muted">{step.body}</p>
            </div>
          ))}
        </section>

        {/* ── Setup Console ───────────────────────────────────────────── */}
        <section
          className="mt-8 animate-slide-up space-y-6"
          style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
        >
          <div className="border-b border-sky-100 pb-3 dark:border-white/10">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Configure Your Console Session
            </h2>
            <p className="text-[12px] muted">
              Personalize your maritime role, default sailing harbour, and preferred reply tongue.
            </p>
          </div>

          {/* 1. Role Selection */}
          <div>
            <p className="eyebrow mb-2">1 · Select Your Maritime Role</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {ROLES.map((option) => {
                const selected = role === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onRoleChange(option.id)}
                    aria-pressed={selected}
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                      selected
                        ? "border-ocean-500 bg-ocean-500/10 ring-2 ring-ocean-500/30 dark:border-cyan-400 dark:bg-cyan-500/10"
                        : "border-sky-100/90 bg-white hover:border-ocean-300 hover:bg-sky-50/40 dark:border-white/10 dark:bg-abyss-850 dark:hover:border-white/20"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${
                        selected
                          ? "bg-gradient-to-tr from-ocean-600 to-marine-500 text-white shadow-sm"
                          : "bg-sky-100/80 text-ocean-700 dark:bg-white/[0.06] dark:text-slate-300"
                      }`}
                    >
                      <Icon name={option.icon as IconName} size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-bold text-slate-900 dark:text-slate-100">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug muted">
                        {option.blurb}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Base Harbour Selection */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="eyebrow">2 · Base Harbour & Coastal Zone</p>
              <span className="text-[11px] font-semibold text-ocean-700 dark:text-cyan-300">
                Active: <span className="font-bold underline">{location.name}</span>
              </span>
            </div>

            <div className="card p-3 space-y-2.5">
              {/* Coast Filter Tabs */}
              <div className="flex gap-1.5 border-b border-sky-100 pb-2 dark:border-white/10">
                {COAST_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCoastFilter(tab.id)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                      coastFilter === tab.id
                        ? "bg-gradient-to-r from-ocean-600 to-teal-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-sky-100/70 dark:text-slate-300 dark:hover:bg-white/5"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/40 px-3 py-2 dark:border-white/10 dark:bg-abyss-950/60">
                <Icon name="search" size={15} className="text-ocean-600 dark:text-ocean-400" />
                <input
                  value={harbourQuery}
                  onChange={(event) => setHarbourQuery(event.target.value)}
                  placeholder="Search by harbour name or Indian coastal state…"
                  aria-label="Search harbours"
                  className="w-full bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                />
              </div>

              {/* Harbours List */}
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pt-1">
                {harbours.map((harbour) => {
                  const selected = harbour.name === location.name;
                  return (
                    <button
                      key={harbour.name}
                      type="button"
                      onClick={() =>
                        onLocationChange({
                          lat: harbour.lat,
                          lon: harbour.lon,
                          name: harbour.name,
                          source: "harbour",
                        })
                      }
                      aria-pressed={selected}
                      className={`rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-all ${
                        selected
                          ? "border-ocean-500 bg-ocean-600 text-white shadow-sm shadow-ocean-500/30"
                          : "border-sky-200/70 bg-white text-slate-700 hover:border-ocean-400 hover:bg-sky-50 dark:border-white/10 dark:bg-abyss-850 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      {harbour.name}
                      <span
                        className={`ml-1.5 text-[10px] font-normal ${
                          selected ? "text-cyan-100" : "muted"
                        }`}
                      >
                        {harbour.state}
                      </span>
                    </button>
                  );
                })}
                {harbours.length === 0 && (
                  <p className="px-1 py-3 text-[12px] muted">
                    No harbours matching “{harbourQuery}”. You can also drop a pin directly on the chart map later.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 3. Language Selection */}
          <div>
            <p className="eyebrow mb-2">3 · Output Reply Language</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onLanguageChange(null)}
                aria-pressed={autoLanguage}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-bold transition-all ${
                  autoLanguage
                    ? "border-marine-500 bg-marine-600 text-white shadow-sm"
                    : "border-sky-200/80 bg-white text-slate-700 hover:bg-sky-50 dark:border-white/10 dark:bg-abyss-850 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                }`}
              >
                <Icon name="sparkles" size={14} />
                Auto-Detect (Match Query)
              </button>

              {LANGUAGES.map((option) => {
                const selected = !autoLanguage && option.code === language;
                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => onLanguageChange(option.code)}
                    aria-pressed={selected}
                    className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-all ${
                      selected
                        ? "border-ocean-500 bg-ocean-600 text-white shadow-sm"
                        : "border-sky-200/80 bg-white text-slate-700 hover:bg-sky-50 dark:border-white/10 dark:bg-abyss-850 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    {option.label}
                    <span className={`ml-1 text-[10.5px] font-normal ${selected ? "text-cyan-100" : "opacity-60"}`}>
                      ({option.english})
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] muted">
              Auto-detect automatically identifies Tamil, Telugu, Hindi, Malayalam, Bengali, etc., and responds in the same language.
            </p>
          </div>

          {/* ── Launch Action ─────────────────────────────────────────── */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
            <button
              type="button"
              onClick={onEnter}
              className="btn-primary w-full sm:w-auto px-7 py-3 text-[14.5px] font-bold shadow-lg shadow-cyan-500/20"
            >
              Launch Maritime Console
              <Icon name="arrow-right" size={16} />
            </button>
            <p className="text-[11px] leading-relaxed muted text-center sm:text-left">
              Decision-support prototype for maritime safety. For official statutory bulletins, follow INCOIS and IMD.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
