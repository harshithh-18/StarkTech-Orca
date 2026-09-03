/**
 * First run.
 *
 * Owner: D · Phase: P4
 *
 * ORCA opened straight into a chat box with a map next to it. That is fine once you know
 * what it is; on first contact it is a blank prompt and no indication of what may be asked
 * or what will come back. This screen answers three questions before the console opens —
 * *what is this, who is it for, and where am I asking about* — and collects the three
 * settings that make the first answer a good one.
 *
 * It is shown once. `Profile.onboarded` persists, and the Sources view has a link back
 * for anyone who wants to change their answers.
 *
 * Deliberately not a marketing page: no scroll, no feature grid, no testimonials. Three
 * choices and a button, on one screen, in under twenty seconds.
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
    title: "Ask in your own language",
    body: "Type or speak in Tamil, Telugu, Malayalam, Bengali, Hindi or English. ORCA detects the language and answers in it.",
  },
  {
    icon: "agent",
    title: "Specialist agents go to work",
    body: "A planner picks which agents to run — weather, sea state, fishing zones, boundaries, risk — and they run in parallel. You watch them work.",
  },
  {
    icon: "shield",
    title: "You get a verdict and the evidence",
    body: "Go, caution or no-go, with the reading that decided it, the source it came from and the hour it applies to. Never a number without a provenance.",
  },
];

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
  const allHarbours = useHarbours();

  const harbours = allHarbours.filter(
    (harbour) =>
      !harbourQuery.trim() ||
      harbour.name!.toLowerCase().includes(harbourQuery.trim().toLowerCase()) ||
      harbour.state.toLowerCase().includes(harbourQuery.trim().toLowerCase()),
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-abyss-950">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
        {/* ── Masthead ────────────────────────────────────────────────── */}
        <header className="animate-slide-up">
          <div className="flex items-center gap-3">
            <Logo size={48} rounded="rounded-xl" className="shadow-md" />
            <div>
              <h1 className="text-2xl font-bold leading-none tracking-tight text-slate-900 dark:text-white">
                ORCA
              </h1>
              <p className="mt-1 text-[12.5px] muted">
                Marine EcOsystem Reasoning with Collaborative Agents
              </p>
            </div>
          </div>

          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
            Ask about the sea in your own language and get an answer you can check —
            where the fish are, whether it is safe to sail, which boundary you are
            near — built from live satellite, ocean and weather data by a team of
            specialist AI agents that show their working.
          </p>
        </header>

        {/* ── How it works ────────────────────────────────────────────── */}
        <section
          className="mt-8 grid gap-3 sm:grid-cols-3"
          style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
        >
          {HOW_IT_WORKS.map((step, index) => (
            <div
              key={step.title}
              className="card animate-slide-up p-4"
              style={{
                animationDelay: `${80 + index * 60}ms`,
                animationFillMode: "backwards",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-ocean-500/10 text-ocean-600 dark:bg-ocean-400/10 dark:text-ocean-300">
                  <Icon name={step.icon} size={15} />
                </span>
                <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h2 className="mt-2.5 text-[13.5px] font-semibold text-slate-900 dark:text-slate-100">
                {step.title}
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed muted">{step.body}</p>
            </div>
          ))}
        </section>

        {/* ── Setup ───────────────────────────────────────────────────── */}
        <section
          className="mt-8 animate-slide-up"
          style={{ animationDelay: "260ms", animationFillMode: "backwards" }}
        >
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
            Set up your console
          </h2>
          <p className="mt-0.5 text-[12px] muted">
            All three are changeable at any time from the header.
          </p>

          {/* Role */}
          <div className="mt-4">
            <p className="eyebrow mb-1.5">1 · What do you do?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLES.map((option) => {
                const selected = role === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onRoleChange(option.id)}
                    aria-pressed={selected}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      selected
                        ? "border-ocean-500 bg-ocean-500/[0.07] ring-1 ring-ocean-500/30"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-abyss-900 dark:hover:border-white/20"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        selected
                          ? "bg-ocean-500 text-white"
                          : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"
                      }`}
                    >
                      <Icon name={option.icon as IconName} size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100">
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

          {/* Harbour */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-baseline gap-2">
              <p className="eyebrow">2 · Where do you sail from?</p>
              <span className="text-[11px] muted">
                Selected: <span className="font-medium">{location.name}</span>
              </span>
            </div>

            <div className="card p-2.5">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 dark:border-white/10">
                <Icon name="search" size={14} className="text-slate-400" />
                <input
                  value={harbourQuery}
                  onChange={(event) => setHarbourQuery(event.target.value)}
                  placeholder="Search a harbour or state…"
                  aria-label="Search harbours"
                  className="w-full bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
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
                      className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                        selected
                          ? "border-ocean-500 bg-ocean-500 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-abyss-850 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      {harbour.name}
                      <span
                        className={`ml-1.5 text-[10px] ${
                          selected ? "text-white/70" : "muted"
                        }`}
                      >
                        {harbour.state}
                      </span>
                    </button>
                  );
                })}
                {harbours.length === 0 && (
                  <p className="px-1 py-2 text-[12px] muted">
                    No harbour matches “{harbourQuery}”. You can also drop a pin anywhere
                    on the map once you are inside.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Language */}
          <div className="mt-5">
            <p className="eyebrow mb-1.5">3 · Which language should answers come back in?</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onLanguageChange(null)}
                aria-pressed={autoLanguage}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  autoLanguage
                    ? "border-ocean-500 bg-ocean-500 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-abyss-850 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                }`}
              >
                <Icon name="sparkles" size={13} />
                Same as my question
              </button>

              {LANGUAGES.map((option) => {
                const selected = !autoLanguage && option.code === language;
                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => onLanguageChange(option.code)}
                    aria-pressed={selected}
                    className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                      selected
                        ? "border-ocean-500 bg-ocean-500 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-abyss-850 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] muted">
              “Same as my question” is the normal path — ask in Tamil, get Tamil back.
            </p>
          </div>

          {/* ── Enter ─────────────────────────────────────────────────── */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onEnter} className="btn-primary px-5 py-2.5 text-sm">
              Open the console
              <Icon name="arrow-right" size={15} />
            </button>
            <p className="text-[11.5px] muted">
              ORCA is a decision-support prototype. For binding forecasts and warnings,
              follow INCOIS and the IMD.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
