/**
 * Sources — provenance, and what ORCA does not know.
 *
 * Owner: C + D · Phase: P3 · Rebuilt P4 as a view
 *
 * Every number ORCA shows is traceable to an `Evidence` entry with a value, a source and a
 * validity time, and this view is where they are all readable at once. Two things here are
 * doing real work:
 *
 *   1. **Declared proxies.** Several values are computed by ORCA rather than issued by an
 *      agency — the PFZ zones, the lightning risk, the cyclone classification, the tide.
 *      Each is labelled as a proxy in its own source string, and this panel repeats that
 *      in plain language. Overclaiming in front of someone who knows the difference costs
 *      far more than saying it out loud.
 *
 *   2. **The limits.** A section that states what the platform is not. A system that only
 *      advertises its strengths has told you nothing about when to distrust it.
 */

import Icon from "@/components/common/Icon";
import { fieldLabel } from "@/components/insight/fieldLabel";
import type { Evidence } from "@/types/orca";

interface Props {
  evidence: Evidence[];
  attribution: string[];
  usedMockData?: boolean;
}

const PROXIES: { title: string; body: string }[] = [
  {
    title: "Fishing zones are computed, not issued",
    body: "INCOIS publishes no machine-readable PFZ endpoint — every documented URL returns 404. ORCA computes zones from Copernicus chlorophyll and sea-surface-temperature gradient, and says so in the evidence source. An official INCOIS advisory, when one is reachable, is used instead and takes precedence.",
  },
  {
    title: "Lightning risk is modelled",
    body: "The lightning signal is CAPE — convective available potential energy — from Open-Meteo. It says the atmosphere is capable of storms. It is not an observed lightning strike, and it is not an IMD advisory.",
  },
  {
    title: "Cyclone detection is a classification, not a warning",
    body: "IMD publishes no machine-readable bulletin feed either, so ORCA classifies modelled pressure and sustained wind against IMD's own wind bands. When IMD has a bulletin out, IMD's bulletin is the authority.",
  },
  {
    title: "Tides are modelled sea level",
    body: "Taken from the marine model's sea-surface height, not from a port tide table. Good enough for “high water is around dawn”; not a substitute for an official table when crossing a bar.",
  },
  {
    title: "Thresholds assume a small mechanised boat",
    body: "A trawler and a catamaran do not share a wave limit. Every verdict here assumes small craft, and the thresholds are aligned with small-craft advisory practice rather than sourced to one published table.",
  },
];

export default function SourcesPanel({ evidence, attribution, usedMockData }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <h2 className="text-[15px] font-bold leading-tight text-slate-900 dark:text-white">
          Sources & limits
        </h2>
        <p className="text-[11px] muted">Where every number came from — and what it isn't.</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {usedMockData && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2">
            <p className="text-[11.5px] leading-snug band-caution">
              Some values on screen came from the offline demo cache rather than a live
              model. ORCA degrades honestly: it never presents cached data as live.
            </p>
          </div>
        )}

        {/* ── Evidence behind the current answer ──────────────────────── */}
        <div>
          <p className="eyebrow mb-1.5">
            Evidence {evidence.length > 0 && `· ${evidence.length} value${evidence.length === 1 ? "" : "s"}`}
          </p>

          {evidence.length === 0 ? (
            <div className="card grid place-items-center gap-2 px-4 py-8 text-center">
              <Icon name="info" size={20} className="text-slate-300 dark:text-slate-600" />
              <p className="text-[12.5px] muted">
                Ask a question, and every value behind the answer is listed here.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {evidence.map((item, index) => (
                <li
                  key={`${item.field}-${index}`}
                  className="card px-2.5 py-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-[12px] font-medium text-slate-800 dark:text-slate-100">
                      {fieldLabel(item.field)}
                    </span>
                    <span className="font-mono text-[12px] font-semibold text-ocean-700 dark:text-ocean-300">
                      {String(item.value)}
                      {item.unit ? ` ${item.unit}` : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-snug muted">{item.source}</p>
                  {(item.time || item.location) && (
                    <p className="mt-0.5 font-mono text-[10px] muted opacity-80">
                      {item.time && new Date(item.time).toLocaleString()}
                      {item.location &&
                        ` · ${item.location.lat.toFixed(2)}°N ${item.location.lon.toFixed(2)}°E`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Declared proxies ────────────────────────────────────────── */}
        <div>
          <p className="eyebrow mb-1.5">What is computed rather than issued</p>
          <ul className="space-y-1.5">
            {PROXIES.map((proxy) => (
              <li key={proxy.title} className="card p-3">
                <p className="flex items-start gap-2 text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">
                  <Icon
                    name="info"
                    size={14}
                    className="mt-0.5 text-ocean-600 dark:text-ocean-300"
                  />
                  {proxy.title}
                </p>
                <p className="mt-1 pl-[22px] text-[11.5px] leading-relaxed muted">
                  {proxy.body}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Attribution ─────────────────────────────────────────────── */}
        <div>
          <p className="eyebrow mb-1.5">Attribution</p>
          <ul className="space-y-1 text-[11px] leading-relaxed muted">
            {(attribution.length
              ? attribution
              : [
                  "Weather data by Open-Meteo.com (CC BY 4.0)",
                  "Generated using E.U. Copernicus Marine Service Information",
                  "Maritime boundaries © Flanders Marine Institute (Marine Regions)",
                  "Protected areas © Protected Planet (WDPA)",
                  "Base map tiles © OpenStreetMap contributors and Esri",
                ]
            ).map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-40" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="rounded-lg bg-slate-100 px-3 py-2.5 text-[11px] leading-relaxed muted dark:bg-white/[0.04]">
          ORCA is a decision-support prototype, not an official advisory service. For a
          binding forecast or warning, follow INCOIS and the India Meteorological
          Department.
        </p>
      </div>
    </div>
  );
}
