/**
 * Sources — Data Provenance, Sensor Verification, and Declared Proxies.
 */

import Icon from "@/components/common/Icon";
import { fieldLabel } from "@/components/insight/fieldLabel";
import type { Evidence } from "@/types/orca";

interface Props {
  evidence: Evidence[];
  attribution: string[];
  usedMockData?: boolean;
}

const PROXIES: { title: string; body: string; agency: string }[] = [
  {
    title: "Potential Fishing Zones (PFZ) are computed, not issued",
    body: "INCOIS publishes no open machine-readable PFZ REST endpoint. ORCA computes prospective zones by analyzing Copernicus chlorophyll-a concentrations and thermal SST gradients in real time. Official INCOIS advisories take precedence when reachable.",
    agency: "Copernicus Marine / INCOIS Proxy",
  },
  {
    title: "Convective Lightning Risk is a physical model proxy",
    body: "The lightning warning metric is CAPE (Convective Available Potential Energy) derived from Open-Meteo atmospheric soundings. It indicates atmospheric instability capable of squalls; it is not a ground strike radar observation.",
    agency: "Open-Meteo CAPE Proxy",
  },
  {
    title: "Cyclone Advisory is a threshold classification",
    body: "Because IMD does not provide an automated JSON bulletin feed, ORCA continuously classifies modelled central atmospheric pressure and sustained 10m wind speeds against IMD's official nautical wind scale.",
    agency: "IMD Scale Classification",
  },
  {
    title: "Tidal Heights are hydrodynamic modelled sea-level",
    body: "Extracted from marine ocean circulation models (sea-surface height above geoid), not from port tide tables. Useful for general flood/ebb planning; use port tide tables for bar crossings.",
    agency: "Copernicus Hydrodynamic",
  },
  {
    title: "Thresholds reflect small mechanised craft limits",
    body: "Trawlers, motorized catamarans, and bulk carriers possess vastly distinct seaworthiness limits. Every safety verdict here assumes small coastal mechanised craft under 15 metres.",
    agency: "Small-Craft Standard",
  },
];

const VERIFIED_PROVIDERS = [
  { name: "Copernicus Marine Service", tag: "SST & Chlorophyll-a Satellites", icon: "front" },
  { name: "Open-Meteo Marine (ICON-Wave / GFS)", tag: "Wave, Wind & Swell Models", icon: "wave" },
  { name: "Flanders Marine Institute (Marine Regions)", tag: "EEZ & Boundary Geofencing", icon: "boundary" },
  { name: "Protected Planet (WDPA)", tag: "Marine Protected Areas (MPA)", icon: "shield" },
  { name: "India Meteorological Department (IMD)", tag: "Cyclone Classification Standards", icon: "storm" },
];

export default function SourcesPanel({ evidence, attribution, usedMockData }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white/50 dark:bg-abyss-900/50 backdrop-blur-sm">
      {/* Header */}
      <div className="shrink-0 border-b border-sky-100 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-1.5">
          <Icon name="info" size={16} className="text-ocean-600 dark:text-cyan-300" />
          <h2 className="text-[14.5px] font-bold leading-tight text-slate-900 dark:text-white">
            Data Provenance & Agency Verification
          </h2>
        </div>
        <p className="text-[11px] muted">
          Sensor telemetry provenance, declared computational proxies, and operational limits.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3.5">
        {usedMockData && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-3 shadow-sm">
            <p className="text-[11.5px] leading-snug band-caution font-medium">
              Demo Notice: Some sensor values were served from the offline cache rather than live models. ORCA degrades transparently without falsifying live status.
            </p>
          </div>
        )}

        {/* ── Verified Agency Feeds ────────────────────────────────────── */}
        <div>
          <p className="eyebrow mb-2">Verified Satellite & Agency Providers</p>
          <div className="space-y-1.5">
            {VERIFIED_PROVIDERS.map((provider) => (
              <div
                key={provider.name}
                className="card flex items-center justify-between p-2.5 transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-ocean-500/15 text-ocean-700 dark:text-cyan-300">
                    <Icon name={provider.icon as any} size={13} />
                  </span>
                  <div>
                    <p className="text-[12px] font-bold text-slate-900 dark:text-slate-100 leading-tight">
                      {provider.name}
                    </p>
                    <p className="text-[10px] muted">{provider.tag}</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  VERIFIED
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Evidence Values for Current Answer ──────────────────────── */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">
              Answer Evidence Citations {evidence.length > 0 && `(${evidence.length})`}
            </p>
            {evidence.length > 0 && (
              <span className="font-mono text-[10px] text-ocean-700 dark:text-cyan-300 font-semibold">
                Live Parameters
              </span>
            )}
          </div>

          {evidence.length === 0 ? (
            <div className="card grid place-items-center gap-2 p-8 text-center">
              <Icon name="info" size={20} className="text-slate-300 dark:text-slate-600" />
              <p className="text-[12px] muted">
                Execute a maritime query in the console to inspect sensor readings and evidence citations.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {evidence.map((item, index) => (
                <li key={`${item.field}-${index}`} className="card p-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">
                      {fieldLabel(item.field)}
                    </span>
                    <span className="font-mono text-[12px] font-black text-ocean-700 dark:text-cyan-300">
                      {String(item.value)}
                      {item.unit ? ` ${item.unit}` : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-snug muted font-mono">{item.source}</p>
                  {(item.time || item.location) && (
                    <p className="mt-0.5 font-mono text-[9.5px] muted opacity-80">
                      {item.time && new Date(item.time).toLocaleString()}
                      {item.location &&
                        ` · ${item.location.lat.toFixed(2)}°N, ${item.location.lon.toFixed(2)}°E`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Declared Computational Proxies ──────────────────────────── */}
        <div>
          <p className="eyebrow mb-2">Declared Computational Proxies & Disclaimers</p>
          <ul className="space-y-2">
            {PROXIES.map((proxy) => (
              <li key={proxy.title} className="card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Icon name="info" size={13} className="text-ocean-600 dark:text-cyan-300 shrink-0" />
                    <span>{proxy.title}</span>
                  </p>
                </div>
                <p className="pl-4 text-[11px] leading-relaxed muted">{proxy.body}</p>
                <div className="pl-4 pt-1">
                  <span className="rounded bg-sky-100 dark:bg-white/5 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-ocean-800 dark:text-cyan-300">
                    {proxy.agency}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Attribution Footer ──────────────────────────────────────── */}
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3 dark:border-white/5 dark:bg-abyss-950/60">
          <p className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300 mb-1">
            Data Attribution & Licensing
          </p>
          <ul className="space-y-0.5 text-[10px] leading-relaxed muted font-mono">
            {(attribution.length
              ? attribution
              : [
                  "Weather & wave data by Open-Meteo.com (CC BY 4.0)",
                  "Generated using E.U. Copernicus Marine Service Information",
                  "Maritime boundaries © Flanders Marine Institute (Marine Regions)",
                  "Protected areas © Protected Planet (WDPA)",
                  "Cartographic base tiles © OpenStreetMap contributors & Esri",
                ]
            ).map((line) => (
              <li key={line} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-ocean-500" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
