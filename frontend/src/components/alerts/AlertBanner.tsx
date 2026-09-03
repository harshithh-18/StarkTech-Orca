/**
 * Alert banner.
 *
 * Owner: D · Phase: P3 · Restyled P4
 *
 * Full width, above everything else, sorted worst-first. If only one banner gets read it
 * must be the most serious one.
 *
 * ## What may be dismissed
 *
 * Life-safety alerts — tsunami, cyclone, being inside a restricted zone — cannot be
 * dismissed. Everything else can. That line is drawn deliberately: a banner that cannot be
 * cleared for a condition the user has already accepted trains them to ignore banners, and
 * the next one might be the tsunami.
 *
 * GEOFENCE_PROXIMITY is dismissible but loud. Crossing the IMBL is what gets boats
 * detained, and a warning that arrives after the crossing is worthless.
 */

import { useEffect, useState } from "react";

import Icon, { type IconName } from "@/components/common/Icon";
import type { AlertType } from "@/types/orca";

interface Props {
  alerts: AlertType[];
  /**
   * Raise the bar for what earns a banner.
   *
   * Alerts derived from an *answer* are a response to something the user just asked, so
   * all of them are shown. Alerts derived from the passive conditions dashboard were not
   * asked for, and a permanent double-decker amber banner on every page load is how you
   * teach someone to stop reading banners — at which point the cyclone one is wallpaper
   * too. Passive alerts therefore only break through at consequence level; the rest are
   * already on the Conditions view, attached to the reading that caused them.
   */
  minimumSeverity?: number;
}

/** Everything at or above this rank is a warning nobody chose to receive but must see. */
export const CONSEQUENTIAL = 3;

interface AlertStyle {
  /** Plain language — "HIGH_WAVE" means nothing to a fisherman. */
  text: string;
  icon: IconName;
  className: string;
  dismissible: boolean;
  /** Lower sorts first. */
  severity: number;
}

const ALERTS: Record<AlertType, AlertStyle> = {
  TSUNAMI: {
    text: "Tsunami warning in force — follow official instructions immediately.",
    icon: "wave",
    className: "bg-red-700 text-white",
    dismissible: false,
    severity: 0,
  },
  CYCLONE: {
    text: "Cyclone conditions detected for this area. Do not put to sea.",
    icon: "storm",
    className: "bg-red-700 text-white",
    dismissible: false,
    severity: 1,
  },
  GEOFENCE_BREACH: {
    text: "You are inside a protected marine area — fishing here may be banned. Leave the area.",
    icon: "boundary",
    className: "bg-rose-600 text-white",
    dismissible: false,
    severity: 2,
  },
  GEOFENCE_PROXIMITY: {
    text: "You are close to the sea border with another country — crossing it can get your boat seized.",
    icon: "boundary",
    className: "bg-orange-600 text-white",
    dismissible: true,
    severity: 3,
  },
  HIGH_WAVE: {
    text: "High waves forecast — conditions exceed small-craft limits.",
    icon: "wave",
    className: "bg-amber-600 text-white",
    dismissible: true,
    severity: 4,
  },
  HIGH_WIND: {
    text: "Strong winds forecast — conditions exceed small-craft limits.",
    icon: "wind",
    className: "bg-amber-600 text-white",
    dismissible: true,
    severity: 5,
  },
  LIGHTNING: {
    // Labelled as an estimate: this is CAPE, a modelled proxy, not an observed strike.
    text: "Thunderstorm risk — modelled estimate, not an observed lightning report.",
    icon: "storm",
    className: "bg-amber-500 text-white",
    dismissible: true,
    severity: 6,
  },
  MARINE_HEAT_WAVE: {
    text: "Marine heat-wave conditions reported in this area.",
    icon: "temperature",
    className: "bg-orange-500 text-white",
    dismissible: true,
    severity: 7,
  },
};

export default function AlertBanner({ alerts, minimumSeverity = 99 }: Props) {
  const [dismissed, setDismissed] = useState<AlertType[]>([]);

  // A new set of alerts is a new situation: an alert the user cleared for yesterday's
  // forecast must be able to reappear when it fires again.
  const key = alerts.join("|");
  useEffect(() => setDismissed([]), [key]);

  const visible = alerts
    .filter(
      (alert) =>
        alert in ALERTS &&
        !dismissed.includes(alert) &&
        ALERTS[alert].severity <= minimumSeverity,
    )
    .sort((a, b) => ALERTS[a].severity - ALERTS[b].severity);

  if (visible.length === 0) return null;

  return (
    <div role="alert" className="shrink-0">
      {visible.map((alert) => {
        const style = ALERTS[alert];
        return (
          <div
            key={alert}
            className={`flex animate-slide-up items-center gap-2.5 px-4 py-2 text-[12.5px] font-medium ${style.className}`}
          >
            <Icon name={style.icon} size={16} />

            {!style.dismissible && (
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-white" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
            )}

            <span className="flex-1 leading-snug">{style.text}</span>

            {style.dismissible && (
              <button
                type="button"
                aria-label="Dismiss this alert"
                onClick={() => setDismissed((current) => [...current, alert])}
                className="shrink-0 rounded p-1 opacity-75 transition-opacity hover:bg-white/20 hover:opacity-100"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
