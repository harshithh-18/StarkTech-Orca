/**
 * Map layer toggles.
 *
 * Owner: D · Phase: P2
 *
 * The agent picks sensible defaults per answer; this lets the user explore beyond them.
 * Keep the default set small — two or three layers, not all ten. A map with everything on
 * communicates nothing.
 */

import type { MapLayer } from "@/types/orca";

interface Props {
  active: MapLayer[];
  onToggle: (layer: MapLayer) => void;
}

export default function LayerToggles(_props: Props) {
  // TODO(P2, D): grouped checkboxes — Zones (PFZ, EEZ, IMBL, MPA), Conditions (SST,
  //              chlorophyll, wave), Route
  // TODO(P2, D): legend for the heatmap colour scales; an unlabelled heatmap is decoration
  // TODO(P3, D): collapse to an icon button on mobile
  return <div>{/* TODO(P2, D) */}</div>;
}
