/**
 * The map — the hero of the interface.
 *
 * Owner: D · Phase: P1
 *
 * Leaflet on OpenStreetMap tiles (free, no key). Layers switch on according to the
 * response's `map_layers`, fetched from GET /api/layers/{layer}.
 *
 * A pretty chatbot with no map is a generic RAG bot. The map plus the visible reasoning
 * are what make this *this* project.
 */

import type { Location, MapLayer } from "@/types/orca";

interface Props {
  center: Location | null;
  activeLayers: MapLayer[];
  userLocation?: Location | null;
}

export default function MapView(_props: Props) {
  // TODO(P1, D): MapContainer + TileLayer (OSM); attribution prop is REQUIRED by OSM terms
  // TODO(P1, D): user pin + PFZ polygons
  // TODO(P2, D): EEZ / IMBL / MPA boundary layers, each visually distinct — the IMBL is
  //              the one with consequences, so make it the loudest
  // TODO(P2, E): SST / chlorophyll / wave heatmap overlays from the coarse grid endpoint
  // TODO(P2, D): fly to the response location on new answers, don't jump
  // TODO(P3, D): popups on zones showing why they qualified (the pfz_proxy evidence)
  return <div className="w-full h-full">{/* TODO(P1, D) */}</div>;
}
