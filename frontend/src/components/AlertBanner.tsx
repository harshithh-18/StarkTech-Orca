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

import type { AlertType } from "@/types/orca";

interface Props {
  alerts: AlertType[];
  onDismiss?: (alert: AlertType) => void;
}

export default function AlertBanner(_props: Props) {
  // TODO(P3, D): one banner per alert, most severe first
  // TODO(P3, D): severity colours; CYCLONE and TSUNAMI are not dismissible
  // TODO(P3, D): plain-language text in the user's language, not the enum name —
  //              "HIGH_WAVE" means nothing to a fisherman
  // TODO(P3, D): label LIGHTNING as a modelled estimate; it's a proxy, not an observation
  return <div>{/* TODO(P3, D) */}</div>;
}
