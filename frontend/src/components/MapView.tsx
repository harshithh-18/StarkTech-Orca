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

import { useEffect, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

import { getLayerCached } from "@/api/client";
import type { Location, MapLayer } from "@/types/orca";

interface Props {
  center: Location | null;
  activeLayers: MapLayer[];
  userLocation?: Location | null;
}

// Leaflet's default marker icons are resolved by relative URL and break under a bundler.
// Point them at the packaged assets so the pin actually renders.
const markerIcon = new L.Icon({
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).href,
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).href,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Bay of Bengal off Kakinada — a sensible first view before any query.
const DEFAULT_CENTER: [number, number] = [16.99, 82.24];
const DEFAULT_ZOOM = 8;

/** Per-layer styling. The IMBL is the one with consequences, so it is the loudest. */
const LAYER_STYLE: Partial<Record<MapLayer, L.PathOptions>> = {
  eez_boundary: { color: "#2563eb", weight: 2, fillOpacity: 0.05, dashArray: "6 4" },
  imbl_line: { color: "#b91c1c", weight: 3, fillOpacity: 0 },
  mpa_zones: { color: "#7c3aed", weight: 2, fillOpacity: 0.15 },
  pfz_zones: { color: "#15803d", weight: 2, fillOpacity: 0.35 },
};

/** Layers served as GeoJSON polygons/lines from the backend. */
const GEOJSON_LAYERS: MapLayer[] = ["pfz_zones", "eez_boundary", "imbl_line", "mpa_zones"];

/** Gridded point layers, rendered as a coloured scatter rather than vector outlines. */
const HEATMAP_LAYERS: MapLayer[] = ["chlorophyll_heatmap", "sst_heatmap"];

/** Colour ramps, low → high. Green for productivity, warm for temperature. */
const RAMPS: Record<string, string[]> = {
  chlorophyll_heatmap: ["#f7fcf5", "#c7e9c0", "#74c476", "#31a354", "#006d2c"],
  sst_heatmap: ["#2c7bb6", "#abd9e9", "#ffffbf", "#fdae61", "#d7191c"],
};

function rampColor(layer: MapLayer, value: number, min: number, max: number): string {
  const ramp = RAMPS[layer] ?? RAMPS.chlorophyll_heatmap;
  if (!Number.isFinite(value) || max <= min) return ramp[0];
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
}

/** A gridded field drawn as small coloured dots. */
function HeatmapData({ layer, center }: { layer: MapLayer; center: Location | null }) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    if (!center) return;
    let cancelled = false;

    getLayerCached(layer, { lat: center.lat, lon: center.lon })
      .then((collection) => {
        if (!cancelled) setData(collection);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [layer, center?.lat, center?.lon]);

  if (!data?.features?.length) return null;

  // min/max ride along on the collection so the ramp doesn't need a second pass.
  const props = (data as unknown as { properties?: Record<string, number | string> })
    .properties;
  const min = Number(props?.min ?? 0);
  const max = Number(props?.max ?? 1);
  const unit = String(props?.unit ?? "");

  return (
    <>
      {data.features.map((feature, index) => {
        const coords = (feature.geometry as GeoJSON.Point)?.coordinates;
        const value = Number(feature.properties?.value);
        if (!coords || !Number.isFinite(value)) return null;
        return (
          <CircleMarker
            key={`${layer}-${index}`}
            center={[coords[1], coords[0]]}
            radius={5}
            pathOptions={{
              color: rampColor(layer, value, min, max),
              fillColor: rampColor(layer, value, min, max),
              fillOpacity: 0.55,
              weight: 0,
            }}
          >
            <Popup>
              {value} {unit}
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

/** Pans (never jumps) to a new answer's location. */
function Recenter({ center }: { center: Location | null }) {
  const map = useMap();

  useEffect(() => {
    if (!center) return;
    // flyTo rather than setView: a smooth pan keeps the viewer oriented, while a jump
    // makes it unclear whether the map moved or the data changed.
    map.flyTo([center.lat, center.lon], Math.max(map.getZoom(), 8), { duration: 0.8 });
  }, [center, map]);

  return null;
}

function LayerData({ layer, center }: { layer: MapLayer; center: Location | null }) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;

    getLayerCached(layer, center ? { lat: center.lat, lon: center.lon } : undefined)
      .then((collection) => {
        if (!cancelled) setData(collection);
      })
      // A layer whose data isn't downloaded returns 503. The trace panel already tells
      // the user why, so the map just omits it rather than throwing up an error.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [layer, center?.lat, center?.lon]);

  if (!data?.features?.length) return null;

  return (
    <GeoJSON
      // Keyed so React rebuilds the layer when the data changes; Leaflet layers don't
      // re-render their geometry in place.
      key={`${layer}-${data.features.length}-${center?.lat ?? 0}`}
      data={data}
      style={() => LAYER_STYLE[layer] ?? { color: "#0c2340", weight: 2 }}
      onEachFeature={(feature, leafletLayer) => {
        const props = feature.properties ?? {};
        // Popups show WHY a zone qualified — the proxy's own evidence, so a green blob
        // on the map can explain itself instead of appearing by fiat.
        const rows = [
          props.chlorophyll_mg_m3 != null &&
            `Chlorophyll-a: ${props.chlorophyll_mg_m3} mg/m³`,
          props.sst_gradient_c_per_km != null &&
            `SST gradient: ${props.sst_gradient_c_per_km} °C/km`,
          props.confidence != null && `Confidence: ${props.confidence}`,
          props.distance_km != null && `Distance: ${props.distance_km} km`,
          props.method && `Method: ${props.method}`,
          props.source && `Source: ${props.source}`,
        ].filter(Boolean);

        if (rows.length) {
          leafletLayer.bindPopup(
            `<div style="font-size:12px;line-height:1.5">${rows.join("<br/>")}</div>`,
          );
        }
      }}
    />
  );
}

export default function MapView({ center, activeLayers, userLocation }: Props) {
  const pin = userLocation ?? center;

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        // Attribution is REQUIRED by the OpenStreetMap tile usage policy.
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <Recenter center={center} />

      {/* Heatmaps first so vector zones and boundaries draw on top of them. */}
      {activeLayers
        .filter((layer) => HEATMAP_LAYERS.includes(layer))
        .map((layer) => (
          <HeatmapData key={layer} layer={layer} center={center} />
        ))}

      {activeLayers
        .filter((layer) => GEOJSON_LAYERS.includes(layer))
        .map((layer) => (
          <LayerData key={layer} layer={layer} center={center} />
        ))}

      {pin && (
        <>
          <Marker position={[pin.lat, pin.lon]} icon={markerIcon}>
            <Popup>
              <strong>{pin.name ?? "Your location"}</strong>
              <br />
              {pin.lat.toFixed(3)}, {pin.lon.toFixed(3)}
              {pin.source && (
                <>
                  <br />
                  <span style={{ color: "#64748b" }}>via {pin.source}</span>
                </>
              )}
            </Popup>
          </Marker>
          {/* A soft ring marks roughly the area the sea-state sample covers, so the
              verdict's "25 km offshore" reading has a visible footprint. */}
          <CircleMarker
            center={[pin.lat, pin.lon]}
            radius={28}
            pathOptions={{ color: "#12507a", weight: 1, fillOpacity: 0.06 }}
          />
        </>
      )}
    </MapContainer>
  );
}
