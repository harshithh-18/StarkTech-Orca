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
  className: string;
  /** Life-safety alerts cannot be dismissed. */
  dismissible: boolean;
  /** Lower sorts first. */
  severity: number;
}

const ALERTS: Record<AlertType, AlertStyle> = {
  TSUNAMI: {
    text: "Tsunami warning in force — follow official instructions immediately.",
    className: "bg-red-700 text-white",
    dismissible: false,
    severity: 0,
  },
  CYCLONE: {
    text: "Cyclone warning for this area. Do not put to sea.",
    className: "bg-red-700 text-white",
    dismissible: false,
    severity: 1,
  },
  GEOFENCE_BREACH: {
    text: "You are inside a restricted maritime zone. Leave the area.",
    className: "bg-red-600 text-white",
    dismissible: false,
    severity: 2,
  },
  GEOFENCE_PROXIMITY: {
    text: "You are approaching a restricted maritime boundary. Crossing it can lead to detention.",
    className: "bg-orange-600 text-white",
    dismissible: true,
    severity: 3,
  },
  HIGH_WAVE: {
    text: "High waves forecast — conditions exceed small-craft limits.",
    className: "bg-amber-600 text-white",
    dismissible: true,
    severity: 4,
  },
  HIGH_WIND: {
    text: "Strong winds forecast — conditions exceed small-craft limits.",
    className: "bg-amber-600 text-white",
    dismissible: true,
    severity: 5,
  },
  LIGHTNING: {
    // Labelled as an estimate: this is CAPE, a modelled proxy, not an observed strike.
    text: "Thunderstorm risk (modelled estimate, not an observed lightning report).",
    className: "bg-amber-500 text-white",
    dismissible: true,
    severity: 6,
  },
  MARINE_HEAT_WAVE: {
    text: "Marine heat wave conditions reported in this area.",
    className: "bg-orange-500 text-white",
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
    <div role="alert">
      {visible.map((alert) => {
        const style = ALERTS[alert];
        return (
          <div
            key={alert}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${style.className}`}
          >
            <span aria-hidden="true">⚠</span>
            <span className="flex-1">{style.text}</span>
            {style.dismissible && (
              <button
                type="button"
                aria-label={`Dismiss ${alert} alert`}
                onClick={() => {
                  setDismissed((current) => [...current, alert]);
                  onDismiss?.(alert);
                }}
                className="shrink-0 rounded px-1.5 text-lg leading-none opacity-80 hover:opacity-100"
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
