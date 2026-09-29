/**
 * ORCA Maritime Operations & Intelligence Console — Command Onboarding Deck.
 *
 * Professional Maritime Operations Landing Page inspired by modern maritime enterprise design.
 * Features realistic oceanographic operations terminology, zero glass effects, solid high-contrast surfaces,
 * and seamless color harmony with the sunset maritime photography in both dark and light modes.
 */

import { useEffect, useState } from "react";

import Icon, { type IconName } from "@/components/common/Icon";
import Logo from "@/components/common/Logo";
import ThemeToggle from "@/components/shell/ThemeToggle";
import { useHarbours } from "@/hooks/useHarbours";
import { LANGUAGES, ROLES } from "@/hooks/useProfile";
import type { ThemeChoice } from "@/hooks/useTheme";
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
  theme?: ThemeChoice;
  onThemeCycle?: () => void;
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
  theme,
  onThemeCycle,
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

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-y-auto text-slate-900 dark:text-slate-100 bg-[#f8fafc] dark:bg-[#060d19] selection:bg-amber-500 selection:text-white">
      {/* ── Top Navigation Bar (Hydraoo inspired: Clean, Solid, High-Contrast) ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-[#060d19]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          {/* Brand Identity with clean circular logo */}
          <div className="flex items-center gap-3">
            <Logo size={34} rounded="rounded-full" className="shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white">
                  ORCA
                </span>
                <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300 tracking-wider">
                  MARITIME OPS
                </span>
              </div>
              <p className="hidden sm:block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Marine EcoSystem Reasoning with Collaborative Agents
              </p>
            </div>
          </div>

          {/* Nav Links (Realistic Maritime Operations, No SaaS fluff) */}
          <nav className="hidden md:flex items-center gap-6 text-[13px] font-semibold text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => scrollToSection("mission-roles")}
              className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              Operations
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("coastal-stations")}
              className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              Coastal Stations
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("mission-scope")}
              className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              Swarm Engine
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("indic-language")}
              className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              Indic AI
            </button>
          </nav>

          {/* Right Controls: Chronometer + Theme + Launch */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-700 dark:border-slate-800 dark:bg-[#0c1626] dark:text-slate-300">
              <span className="font-bold text-amber-600 dark:text-amber-400">UTC {time.utc}</span>
              <span className="text-slate-400">·</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">IST {time.ist}</span>
            </div>

            {theme && onThemeCycle && (
              <ThemeToggle choice={theme} onCycle={onThemeCycle} />
            )}

            <button
              type="button"
              onClick={onEnter}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-[12.5px] font-bold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              <span>Launch Console</span>
              <Icon name="arrow-right" size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section (Hydraoo-Inspired with Sunset Fisherman Backdrop) ──── */}
      <section className="relative landing-hero-backdrop border-b border-slate-200 dark:border-slate-800 py-16 sm:py-24 lg:py-28 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl lg:max-w-3xl">
            {/* Pill Tag Badge */}
            <div className="hero-tag-badge">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Operational Oceanographic Intelligence for India's Maritime Frontier</span>
            </div>

            {/* Bold Headline (Matching Hydraoo Aesthetic) */}
            <h1 className="mt-5 text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.08]">
              Built for Coastal Waters.
              <br />
              <span className="text-amber-600 dark:text-amber-400">Ready for the Ocean.</span>
            </h1>

            {/* Action Row */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onEnter}
                className="btn-hero-primary"
              >
                <span>Launch Operations Deck</span>
                <Icon name="arrow-right" size={15} />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection("mission-roles")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-[14px] font-bold text-slate-800 shadow-sm transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span>Configure Station & Role</span>
                <Icon name="chevron" size={14} />
              </button>

              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-[#0c1626] dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
                <span>14 Base Harbours Online</span>
              </div>
            </div>

            {/* Subtext Paragraph */}
            <p className="mt-6 text-[14px] sm:text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
              Synthesizing real-time oceanographic models, INCOIS Potential Fishing Zones (PFZ),
              and maritime boundary compliance across India's 7,516 km coastline.
            </p>

            {/* Operational Telemetry KPIs */}
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-[#0a1322]">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  Coastline
                </span>
                <span className="mt-0.5 block text-lg font-black text-slate-900 dark:text-white">
                  7,516 km
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-[#0a1322]">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  Fleet Stations
                </span>
                <span className="mt-0.5 block text-lg font-black text-amber-600 dark:text-amber-400">
                  14 Harbours
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-[#0a1322]">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  Swarm Specialists
                </span>
                <span className="mt-0.5 block text-lg font-black text-emerald-600 dark:text-emerald-400">
                  5 Agents
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-[#0a1322]">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  Indic Dialects
                </span>
                <span className="mt-0.5 block text-lg font-black text-slate-900 dark:text-white">
                  10 Languages
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Operational Configuration Deck (Zero Glass / Solid Surfaces) ────── */}
      <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        {/* Section 01: Operational Roles & Swarm Scope */}
        <div id="mission-roles" className="solid-panel space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 dark:border-slate-800 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-500/10 font-mono text-[11px] font-bold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                  01
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Select Operational Role
                </h2>
              </div>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                Calibrates agent models, risk thresholds, and acoustic alerts to your vessel mission
              </p>
            </div>
            <span className="self-start sm:self-auto rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[11px] font-bold text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-300">
              Active Persona: {role.toUpperCase()}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((option) => {
              const selected = role === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onRoleChange(option.id)}
                  aria-pressed={selected}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-150 ${
                    selected
                      ? "border-amber-500 bg-amber-500/[0.08] ring-2 ring-amber-500/25 shadow-sm dark:border-amber-400 dark:bg-amber-400/10 dark:ring-amber-400/30"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-[#0c1626] dark:hover:border-slate-700 dark:hover:bg-[#101e34]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-lg ${
                          selected
                            ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                            : "bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        <Icon name={option.icon as IconName} size={18} />
                      </span>
                      {selected && (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-950">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <span className="mt-3 block text-[14px] font-bold text-slate-900 dark:text-white">
                      {option.label}
                    </span>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400">
                      {option.blurb}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Dynamic Mission Scope Display */}
          <div id="mission-scope" className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-[#0c1626]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-200 pb-3 dark:border-slate-800">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Operational Telemetry Profile: {activeRoleDetail.title}
              </span>
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                Multi-Agent Synthesis Engine
              </span>
            </div>

            <p className="mt-3 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
              {activeRoleDetail.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {activeRoleDetail.agents.map((agent) => (
                <span
                  key={agent}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 font-mono text-[11px] font-semibold text-slate-800 dark:border-slate-700 dark:bg-[#101e34] dark:text-slate-200"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {agent}
                </span>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              {activeRoleDetail.telemetryMetrics.map((metric) => (
                <div key={metric.label} className="rounded-lg bg-white p-2.5 dark:bg-[#101e34] border border-slate-200 dark:border-slate-700/60">
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

        {/* Section 02: Coastal Base Station Mooring (14 Harbours) */}
        <div id="coastal-stations" className="solid-panel space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 dark:border-slate-800 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-500/10 font-mono text-[11px] font-bold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                  02
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Anchor Coastal Base Station
                </h2>
              </div>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                Mooring port and coastal sector for localized wave, SST, and boundary alerts
              </p>
            </div>

            <div className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-800 dark:border-slate-800 dark:bg-[#0c1626] dark:text-slate-200 sm:self-auto">
              <Icon name="anchor" size={13} className="text-amber-600 dark:text-amber-400" />
              <span>
                Anchor: <strong className="text-amber-600 dark:text-amber-400">{location.name}</strong> ({location.lat.toFixed(2)}°N, {location.lon.toFixed(2)}°E)
              </span>
            </div>
          </div>

          {/* Sector Filter Tabs & Search */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {COAST_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCoastFilter(tab.id)}
                  className={`rounded-lg px-3.5 py-1.5 text-[12px] font-bold transition-all border ${
                    coastFilter === tab.id
                      ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#0c1626] dark:text-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-900 dark:border-slate-800 dark:bg-[#0c1626] dark:text-slate-100 min-w-[280px]">
              <Icon name="search" size={15} className="text-slate-400" />
              <input
                value={harbourQuery}
                onChange={(event) => setHarbourQuery(event.target.value)}
                placeholder="Search harbours or states…"
                aria-label="Search harbours"
                className="w-full bg-transparent placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Harbours Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[380px] overflow-y-auto pr-1">
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
                  className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                    selected
                      ? "border-amber-500 bg-amber-500/[0.08] ring-2 ring-amber-500/25 dark:border-amber-400 dark:bg-amber-400/10 dark:ring-amber-400/30"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-[#0c1626] dark:hover:border-slate-700 dark:hover:bg-[#101e34]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block truncate text-[13.5px] font-bold text-slate-900 dark:text-white">
                        {harbour.name}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {harbour.state}
                      </span>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold border ${
                        telemetry.status === "Safe"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                          : telemetry.status === "Caution"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                            : "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300"
                      }`}
                    >
                      {telemetry.status} · {telemetry.wave}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-[10.5px] font-mono dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">
                      {harbour.lat.toFixed(2)}°N {harbour.lon.toFixed(2)}°E
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {harbour.coast === "east" ? "Bay of Bengal" : "Arabian Sea"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 03: Indic Reply Language */}
        <div id="indic-language" className="solid-panel space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3 dark:border-slate-800 gap-1">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-500/10 font-mono text-[11px] font-bold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                03
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Output Reply Language (Indic AI)
              </h2>
            </div>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
              Bhashini Multilingual Bridge
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onLanguageChange(null)}
              aria-pressed={autoLanguage}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12px] font-bold transition-all ${
                autoLanguage
                  ? "border-amber-500 bg-amber-500 text-slate-950 shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-[#0c1626] dark:text-slate-300"
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
                      ? "border-amber-500 bg-amber-500 text-slate-950 font-bold shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-[#0c1626] dark:text-slate-300"
                  }`}
                >
                  <span>{option.label}</span>
                  <span className={`ml-1 text-[10.5px] ${selected ? "text-slate-950 opacity-80" : "opacity-50"}`}>
                    ({option.english})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Command Bridge Ready Bar (Bottom Deck) */}
        <div className="solid-deck flex flex-col sm:flex-row items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Command Bridge Ready
              </h3>
            </div>
            <p className="mt-1 text-[12.5px] text-slate-600 dark:text-slate-400">
              Configured: <strong className="text-slate-900 dark:text-white capitalize">{role}</strong> at{" "}
              <strong className="text-slate-900 dark:text-white">{location.name} Station</strong> · (
              {autoLanguage ? "Auto-Detect Language" : language.toUpperCase()})
            </p>
          </div>

          <button
            type="button"
            onClick={onEnter}
            className="btn-hero-amber w-full sm:w-auto px-8 py-3.5 text-[15px]"
          >
            <span>Launch Maritime Console</span>
            <Icon name="arrow-right" size={16} />
          </button>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 text-center pb-8">
          Statutory operational advisory: ORCA provides explainable AI decision support based on INCOIS, Copernicus Marine,
          and IMD meteorological data feeds. Navigational commands must always verify official Solas notices to mariners.
        </p>
      </main>
    </div>
  );
}
