/**
 * ORCA Maritime Operations & Intelligence Console — Command Onboarding Deck.
 *
 * Professional Maritime Operations Portal with live telemetry tickers,
 * dynamic stakeholder personas, and an interactive coastal station fleet.
 */

import { useEffect, useState } from "react";

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

const COAST_TABS = [
  { id: "all", label: "All Harbours" },
  { id: "east", label: "Bay of Bengal (East)" },
  { id: "west", label: "Arabian Sea (West)" },
] as const;

// Role-specific operational telemetry preview
const ROLE_DETAILS: Record<
  Role,
  {
    title: string;
    description: string;
    agents: string[];
    sampleQuery: string;
    telemetryMetrics: { label: string; value: string }[];
  }
> = {
  fisherman: {
    title: "Fisher & Small Craft Operations",
    description:
      "Optimized for artisanal and mechanized coastal fishing vessels. Real-time Potential Fishing Zone (PFZ) demarcations, small-craft wave limits, and boundary buffer alerts.",
    agents: ["Marine Biology Agent", "Sea-State & Wave Agent", "IMBL Geofence Agent"],
    sampleQuery: "Where is the nearest Potential Fishing Zone today?",
    telemetryMetrics: [
      { label: "PFZ Satellite Model", value: "INCOIS L3 Active" },
      { label: "Small-Craft Limit", value: "Hs < 2.0 m" },
      { label: "IMBL Warning Buffer", value: "5.0 Nautical Miles" },
    ],
  },
  authority: {
    title: "Coastal Security & Hazard Monitoring",
    description:
      "Operational oversight for Coast Guard, port trusts, and marine safety directorates. Proactive IMBL boundary tracking, cyclone alerts, and maritime hazard broadcasts.",
    agents: ["Geospatial Geofence Agent", "Weather Intelligence", "Risk Synthesis Agent"],
    sampleQuery: "Am I approaching any restricted maritime boundary?",
    telemetryMetrics: [
      { label: "Border Geofence", value: "EEZ & IMBL Live" },
      { label: "Storm Radar", value: "IMD Cyclone Tracking" },
      { label: "Small Craft Bans", value: "Automated Rules" },
    ],
  },
  researcher: {
    title: "Oceanographic & Biochemical Research",
    description:
      "Deep scientific analysis of coastal ecosystems. Multi-satellite chlorophyll biomass tracking, sea-surface temperature (SST) gradients, thermal fronts, and upwelling zones.",
    agents: ["Chlorophyll & SST Agent", "Front Detection Module", "Historical Trend Analysis"],
    sampleQuery: "Why has fish productivity declined in this region?",
    telemetryMetrics: [
      { label: "SST Anomaly Grid", value: "MODIS / Sentinel-3" },
      { label: "Thermal Fronts", value: "Gradient > 0.5°C/km" },
      { label: "Chlorophyll-a", value: "Copernicus Marine L4" },
    ],
  },
  operator: {
    title: "Commercial Route Planning & Vessel Navigation",
    description:
      "Passage planning along Indian coastal corridors. Dynamic least-risk routing, swell timing, squall forecasts, and marine protected area (MPA) avoidance.",
    agents: ["Least-Risk Route Planner", "Wave Forecast Engine", "Restricted Zone Verifier"],
    sampleQuery: "What is the safest route from Kakinada to Chennai?",
    telemetryMetrics: [
      { label: "Routing Alg.", value: "A* Coastal Waypoints" },
      { label: "Swell 48h Model", value: "Open-Meteo Marine" },
      { label: "Passage Safety", value: "SOLAS Compliant" },
    ],
  },
};

// Simulated coastal sea state for the harbour cards (creates an immediate, live operational feel)
const HARBOUR_CONDITIONS: Record<string, { status: "Safe" | "Caution" | "Hazard"; wave: string }> = {
  Kakinada: { status: "Safe", wave: "0.8m" },
  Visakhapatnam: { status: "Safe", wave: "1.1m" },
  Chennai: { status: "Safe", wave: "1.0m" },
  Nagapattinam: { status: "Caution", wave: "1.7m" },
  Rameswaram: { status: "Safe", wave: "0.6m" },
  Paradip: { status: "Caution", wave: "1.8m" },
  Digha: { status: "Safe", wave: "0.9m" },
  "Port Blair": { status: "Safe", wave: "1.2m" },
  Kochi: { status: "Caution", wave: "2.1m" },
  Kozhikode: { status: "Caution", wave: "1.9m" },
  Mangaluru: { status: "Safe", wave: "1.3m" },
  Ratnagiri: { status: "Safe", wave: "1.0m" },
  Mumbai: { status: "Safe", wave: "1.1m" },
  Veraval: { status: "Safe", wave: "1.4m" },
};

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

  // Real-time maritime chronometer
  const [time, setTime] = useState({
    utc: new Date().toUTCString().slice(17, 25),
    ist: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }),
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime({
        utc: now.toUTCString().slice(17, 25),
        ist: now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const harbours = allHarbours.filter((harbour) => {
    const matchesCoast = coastFilter === "all" || harbour.coast === coastFilter;
    const matchesQuery =
      !harbourQuery.trim() ||
      harbour.name!.toLowerCase().includes(harbourQuery.trim().toLowerCase()) ||
      harbour.state.toLowerCase().includes(harbourQuery.trim().toLowerCase());
    return matchesCoast && matchesQuery;
  });

  const activeRoleDetail = ROLE_DETAILS[role];

  return (
    <div className="relative min-h-full w-full overflow-y-auto bg-slate-50 text-slate-900 dark:bg-[#060c18] dark:text-slate-100 nautical-radar-grid">
      {/* ── Top Tactical Status Bar ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-4 py-2 backdrop-blur-md dark:border-white/10 dark:bg-[#080e1c]/95 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-bold tracking-wider text-ocean-700 dark:text-ocean-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              SATELLITE & SENSOR TELEMETRY NOMINAL
            </span>
            <span className="hidden text-slate-300 dark:text-slate-700 sm:inline">|</span>
            <span className="hidden font-mono text-slate-600 dark:text-slate-400 md:inline">
              INCOIS OCEANSAT · COPERNICUS L3 · IMD RADAR
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
              <span className="font-bold text-ocean-600 dark:text-ocean-400">UTC</span>
              <span>{time.utc}</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">IST</span>
              <span>{time.ist}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main Command Bridge Canvas ──────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Masthead Hero Section ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-ocean-50/50 p-6 shadow-xl dark:border-ocean-500/25 dark:bg-command-deck sm:p-8">
          {/* Subtle radar sweep & decorative ambient glow */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-ocean-500/10 blur-3xl dark:bg-ocean-600/15" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-hydro-500/10 blur-3xl dark:bg-hydro-600/15" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4 sm:items-center sm:gap-5">
              <Logo
                size={64}
                rounded="rounded-2xl"
                className="shadow-xl ring-2 ring-ocean-500/40 shrink-0"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                    ORCA
                  </h1>
                  <span className="rounded-md border border-ocean-500/30 bg-ocean-500/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-ocean-700 dark:text-ocean-300">
                    MARITIME COMMAND
                  </span>
                  <span className="rounded-md border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    GOV OF INDIA · SIH
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ocean-700 dark:text-hydro-300 sm:text-[15px]">
                  Marine EcoSystem Reasoning with Collaborative Agents
                </p>
                <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 sm:text-sm">
                  Autonomous oceanographic decision system for India's 7,516 km coastline. Interrogate live
                  ocean models, calculate potential fishing zones, verify maritime boundaries (EEZ/IMBL),
                  and synthesize Go / No-Go passage safety with explainable multi-agent telemetry.
                </p>
              </div>
            </div>

            {/* Tactical stats strip */}
            <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-[#0c1527]/80 backdrop-blur shrink-0 sm:grid-cols-4 lg:grid-cols-2">
              <div className="p-1.5">
                <span className="block font-mono text-[9.5px] uppercase tracking-wider text-slate-400">
                  Coastline
                </span>
                <span className="font-mono text-base font-black text-slate-900 dark:text-white">
                  7,516 km
                </span>
              </div>
              <div className="p-1.5">
                <span className="block font-mono text-[9.5px] uppercase tracking-wider text-slate-400">
                  Maritime States
                </span>
                <span className="font-mono text-base font-black text-ocean-600 dark:text-ocean-400">
                  9 States + 2 UT
                </span>
              </div>
              <div className="p-1.5">
                <span className="block font-mono text-[9.5px] uppercase tracking-wider text-slate-400">
                  Fleet Ports
                </span>
                <span className="font-mono text-base font-black text-slate-900 dark:text-white">
                  14 Stations
                </span>
              </div>
              <div className="p-1.5">
                <span className="block font-mono text-[9.5px] uppercase tracking-wider text-slate-400">
                  Swarm Engine
                </span>
                <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                  5 Specialists
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Two-Column Operational Configuration Deck ─────────────────────── */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:items-start">
          {/* ═══════════════════════════════════════════════════════════════════
              LEFT COLUMN: Role Persona Hub & Indic Language Control
             ═══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-6 lg:col-span-5">
            {/* Step 1: Maritime Role Selection */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    01
                  </span>
                  <h2 className="text-[14.5px] font-bold text-slate-900 dark:text-white">
                    Select Your Operational Role
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  Configures Swarm Behavior
                </span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                {ROLES.map((option) => {
                  const selected = role === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onRoleChange(option.id)}
                      aria-pressed={selected}
                      className={`group flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-150 ${
                        selected
                          ? "border-emerald-500/90 bg-emerald-500/10 ring-2 ring-emerald-500/25 dark:border-emerald-400/90 dark:bg-emerald-500/15 dark:ring-emerald-500/30 shadow-sm shadow-emerald-500/15"
                          : "border-slate-200 bg-white hover:border-emerald-400/50 hover:bg-emerald-500/[0.03] dark:border-white/10 dark:bg-[#0a1224] dark:hover:border-emerald-400/30 dark:hover:bg-emerald-500/[0.04]"
                      }`}
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${
                          selected
                            ? "border border-emerald-400/50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30"
                            : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
                        }`}
                      >
                        <Icon name={option.icon as IconName} size={18} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="block text-[13.5px] font-bold text-slate-900 dark:text-white">
                            {option.label}
                          </span>
                          {selected && (
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="mt-0.5 block text-[11.5px] leading-snug muted">
                          {option.blurb}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Role Intelligence Deck (Interactive Scope) */}
              <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/30 p-4 shadow-sm dark:border-emerald-400/30 dark:bg-gradient-to-br dark:from-[#091a18] dark:via-[#0c1827] dark:to-[#081220]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Active Mission Scope
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Live Telemetry Profile
                  </span>
                </div>

                <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200 font-normal">
                  {activeRoleDetail.description}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {activeRoleDetail.agents.map((agent) => (
                    <span
                      key={agent}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-300 shadow-sm"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                      {agent}
                    </span>
                  ))}
                </div>

                <div className="mt-3.5 grid grid-cols-3 gap-2.5 border-t border-slate-200/80 pt-3 dark:border-white/10">
                  {activeRoleDetail.telemetryMetrics.map((metric) => (
                    <div key={metric.label}>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                        {metric.label}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[12px] font-bold text-slate-900 dark:text-white">
                        {metric.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2: Indic Language & Dialect Configuration */}
            <div className="card p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    02
                  </span>
                  <h2 className="text-[14.5px] font-bold text-slate-900 dark:text-white">
                    Output Reply Language
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Bhashini / Indic AI
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onLanguageChange(null)}
                  aria-pressed={autoLanguage}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-bold transition-all ${
                    autoLanguage
                      ? "border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-500/25"
                      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400/50 hover:bg-emerald-500/10 dark:border-white/10 dark:bg-[#0a1224] dark:text-slate-200 dark:hover:border-emerald-400/40 dark:hover:bg-emerald-500/15"
                  }`}
                >
                  <Icon name="sparkles" size={14} />
                  Auto-Detect (Match Query Tongue)
                </button>

                {LANGUAGES.map((option) => {
                  const selected = !autoLanguage && option.code === language;
                  return (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => onLanguageChange(option.code)}
                      aria-pressed={selected}
                      className={`rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all ${
                        selected
                          ? "border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-500/25"
                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400/50 hover:bg-emerald-500/10 dark:border-white/10 dark:bg-[#0a1224] dark:text-slate-200 dark:hover:border-emerald-400/40 dark:hover:bg-emerald-500/15"
                      }`}
                    >
                      <span>{option.label}</span>
                      <span
                        className={`ml-1 text-[10.5px] font-normal ${
                          selected ? "text-emerald-100" : "opacity-60"
                        }`}
                      >
                        ({option.english})
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] leading-relaxed muted">
                ORCA seamlessly listens and responds in Tamil, Telugu, Malayalam, Bengali, Hindi, and English.
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              RIGHT COLUMN: Interactive Coastal Station Fleet & Harbour Grid
             ═══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-6 lg:col-span-7">
            <div className="card p-5 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    03
                  </span>
                  <div>
                    <h2 className="text-[14.5px] font-bold text-slate-900 dark:text-white">
                      Anchor Your Coastal Station
                    </h2>
                    <p className="text-[11px] muted">
                      Choose your default harbour or active vessel mooring zone
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-start rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300 sm:self-auto">
                  <Icon name="gps" size={13} />
                  <span>
                    Current Anchor: <strong className="underline">{location.name}</strong>
                  </span>
                </div>
              </div>

              {/* Coastal Sector Filter Tabs */}
              <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-3 dark:border-white/10">
                {COAST_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCoastFilter(tab.id)}
                    className={`rounded-lg px-3.5 py-1.5 text-[11.5px] font-bold transition-all ${
                      coastFilter === tab.id
                        ? "border border-emerald-500/60 bg-emerald-600 text-white shadow-md shadow-emerald-500/25"
                        : "border border-transparent text-slate-600 hover:border-emerald-400/30 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-slate-300 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Harbour Search Bar */}
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 dark:border-white/10 dark:bg-[#080e1c] focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 dark:focus-within:border-emerald-400">
                <Icon name="search" size={16} className="text-emerald-600 dark:text-emerald-400" />
                <input
                  value={harbourQuery}
                  onChange={(event) => setHarbourQuery(event.target.value)}
                  placeholder="Search 14 Indian harbours or states (e.g. Kakinada, Kochi, Tamil Nadu)…"
                  aria-label="Search harbours"
                  className="w-full bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                />
              </div>

              {/* Interactive Harbour Cards Grid (2 Columns on medium+ screens) */}
              <div className="grid gap-2.5 sm:grid-cols-2 max-h-[380px] overflow-y-auto pr-1">
                {harbours.map((harbour) => {
                  const selected = harbour.name === location.name;
                  const telemetry = HARBOUR_CONDITIONS[harbour.name] ?? { status: "Safe", wave: "1.0m" };

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
                      className={`group relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all duration-150 ${
                        selected
                          ? "border-emerald-500/90 bg-emerald-500/10 ring-2 ring-emerald-500/25 dark:border-emerald-400/90 dark:bg-emerald-500/15 dark:ring-emerald-500/30 shadow-sm shadow-emerald-500/15"
                          : "border-slate-200 bg-white hover:border-emerald-400/50 hover:bg-emerald-500/[0.03] dark:border-white/10 dark:bg-[#0a1224] dark:hover:border-emerald-400/30 dark:hover:bg-emerald-500/[0.04]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="block truncate text-[13px] font-bold text-slate-900 dark:text-white">
                            {harbour.name}
                          </span>
                          <span className="block truncate text-[11px] muted">
                            {harbour.state}
                          </span>
                        </div>

                        {/* Sea State Telemetry Badge */}
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                            telemetry.status === "Safe"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : telemetry.status === "Caution"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {telemetry.status} · {telemetry.wave}
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] font-mono dark:border-white/5">
                        <span className="text-slate-500 dark:text-slate-400">
                          {harbour.lat.toFixed(2)}°N {harbour.lon.toFixed(2)}°E
                        </span>
                        <span className="uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">
                          {harbour.coast === "east" ? "Bay of Bengal" : "Arabian Sea"}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {harbours.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-sm muted">
                    No harbours matching “{harbourQuery}”. You can also pinpoint any coastal coordinate on
                    the chart map.
                  </div>
                )}
              </div>

              {/* Active Selected Port HUD */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/[0.08] p-3 dark:border-emerald-400/30 dark:bg-emerald-500/[0.08]">
                <div className="flex items-center gap-2.5 text-[12px]">
                  <span className="grid h-7 w-7 place-items-center rounded-lg border border-emerald-400/50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm">
                    <Icon name="anchor" size={14} />
                  </span>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {location.name} Naval Base
                    </span>
                    <span className="ml-2 font-mono text-[11px] text-emerald-700 dark:text-emerald-300 font-bold">
                      {location.lat.toFixed(2)}°N, {location.lon.toFixed(2)}°E
                    </span>
                  </div>
                </div>

                <span className="font-mono text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                  ● Telemetry Link Online
                </span>
              </div>
            </div>

            {/* ── Operational Launch Action Card ────────────────────────────── */}
            <div className="card p-5 border border-emerald-500/40 bg-gradient-to-r from-emerald-50/50 via-white to-emerald-50/50 dark:border-emerald-400/30 dark:bg-gradient-to-r dark:from-[#0a1c1d] dark:via-[#0c172e] dark:to-[#081322]">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Ready to Command
                  </h3>
                  <p className="text-[12px] muted">
                    Session configured: <strong className="text-slate-800 dark:text-slate-200">{role}</strong> at{" "}
                    <strong className="text-slate-800 dark:text-slate-200">{location.name}</strong> (
                    {autoLanguage ? "Auto-Detect Language" : language.toUpperCase()})
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onEnter}
                  className="btn-primary w-full sm:w-auto px-7 py-3 text-[14.5px] font-black tracking-wide shadow-lg shadow-emerald-500/30 active:scale-95 border border-emerald-400/60"
                >
                  <span>Launch Maritime Console</span>
                  <Icon name="arrow-right" size={16} />
                </button>
              </div>

              <p className="mt-3 text-[10.5px] leading-relaxed muted text-center sm:text-left border-t border-slate-200/80 pt-2.5 dark:border-white/10">
                Official statutory notice: ORCA is an AI decision-support platform designed for coastal
                resilience. For statutory severe-weather notices, consult Indian Meteorological Department (IMD)
                and INCOIS.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
