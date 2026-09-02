/**
 * Alert banner.
 *
 * Owner: D · Phase: P3
 *
 * Cyclone, high wave, lightning, geofence — colour-coded, dismissible, full width above
 * everything else.
 *
 * GEOFENCE_PROXIMITY deserves special weight: crossing the IMBL is what gets boats
 * detained, and a warning that arrives after the crossing is worthless.
 */

import { useState } from "react";

import type { AlertType } from "@/types/orca";

interface Props {
  alerts: AlertType[];
  onDismiss?: (alert: AlertType) => void;
}

interface AlertStyle {
  /** Plain language — "HIGH_WAVE" means nothing to a fisherman. */
  text: string;
  icon: string;
  className: string;
  /** Life-safety alerts cannot be dismissed. */
  dismissible: boolean;
  /** Lower sorts first. */
  severity: number;
  /** Draw attention on arrival; reserved for the alerts that carry real consequence. */
  urgent?: boolean;
}

const ALERTS: Record<AlertType, AlertStyle> = {
  TSUNAMI: {
    text: "Tsunami warning in force — follow official instructions immediately.",
    icon: "🌊",
    className: "bg-gradient-to-r from-red-700 to-rose-700 text-white",
    dismissible: false,
    severity: 0,
    urgent: true,
  },
  CYCLONE: {
    text: "Cyclone warning for this area. Do not put to sea.",
    icon: "🌀",
    className: "bg-gradient-to-r from-red-700 to-rose-600 text-white",
    dismissible: false,
    severity: 1,
    urgent: true,
  },
  GEOFENCE_BREACH: {
    text: "You are inside a restricted maritime zone. Leave the area.",
    icon: "⛔",
    className: "bg-gradient-to-r from-rose-600 to-red-600 text-white",
    dismissible: false,
    severity: 2,
    urgent: true,
  },
  GEOFENCE_PROXIMITY: {
    text: "Approaching an international maritime boundary — crossing it can lead to detention.",
    icon: "🚩",
    className: "bg-gradient-to-r from-orange-600 to-amber-600 text-white",
    dismissible: true,
    severity: 3,
    urgent: true,
  },
  HIGH_WAVE: {
    text: "High waves forecast — conditions exceed small-craft limits.",
    icon: "🌊",
    className: "bg-gradient-to-r from-amber-600 to-orange-500 text-white",
    dismissible: true,
    severity: 4,
  },
  HIGH_WIND: {
    text: "Strong winds forecast — conditions exceed small-craft limits.",
    icon: "💨",
    className: "bg-gradient-to-r from-amber-600 to-yellow-500 text-white",
    dismissible: true,
    severity: 5,
  },
  LIGHTNING: {
    // Labelled as an estimate: this is CAPE, a modelled proxy, not an observed strike.
    text: "Thunderstorm risk (modelled estimate, not an observed lightning report).",
    icon: "⚡",
    className: "bg-gradient-to-r from-amber-500 to-yellow-500 text-white",
    dismissible: true,
    severity: 6,
  },
  MARINE_HEAT_WAVE: {
    text: "Marine heat wave conditions reported in this area.",
    icon: "🌡️",
    className: "bg-gradient-to-r from-orange-500 to-amber-500 text-white",
    dismissible: true,
    severity: 7,
  },
};

export default function AlertBanner({ alerts, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState<AlertType[]>([]);

  const visible = alerts
    .filter((alert) => !dismissed.includes(alert))
    .filter((alert) => alert in ALERTS)
    // Most severe first — if only one banner is read, it should be the worst one.
    .sort((a, b) => ALERTS[a].severity - ALERTS[b].severity);

  if (visible.length === 0) return null;

  return (
    <div role="alert" className="shrink-0">
      {visible.map((alert) => {
        const style = ALERTS[alert];
        return (
          <div
            key={alert}
            className={`flex animate-slide-up items-center gap-2.5 px-4 py-2 text-sm font-semibold shadow-md ${style.className}`}
          >
            <span aria-hidden="true" className="text-base">
              {style.icon}
            </span>

            {style.urgent && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-white" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
            )}

            <span className="flex-1 leading-snug">{style.text}</span>

            {style.dismissible && (
              <button
                type="button"
                aria-label={`Dismiss ${alert} alert`}
                onClick={() => {
                  setDismissed((current) => [...current, alert]);
                  onDismiss?.(alert);
                }}
                className="shrink-0 rounded-lg px-2 text-lg leading-none opacity-75 transition-all hover:scale-110 hover:bg-white/20 hover:opacity-100"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
