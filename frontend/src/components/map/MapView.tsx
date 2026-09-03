/**
 * The map — the constant of the interface.
 *
 * Owner: D · Phase: P1 · Rebuilt P4
 *
 * Leaflet, free tiles, no key. Layers switch on according to the answer's `map_layers`,
 * and the Layers view lets the user switch any explorable one on directly.
 *
 * A chatbot with no map is a generic RAG bot. The map plus the visible reasoning are what
 * make this *this* project — so the map is always on screen on desktop, not a tab.
 *
 * ## Two rendering paths
 *
 * Vector layers (zones, boundaries, the route) are GeoJSON drawn with `style` from
 * `mapConfig`. Gridded fields (chlorophyll, SST, wave, hazard cells) come back as point
 * FeatureCollections and are drawn as a coloured scatter — a real raster overlay would
 * mean generating tiles, which is a lot of machinery for a field that is 49 cells wide.
 */

import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

import { getLayerCached } from "@/api/client";
import {
  BASEMAPS,
  GRID_LAYERS,
  LAYERS,
  rampColor,
  VECTOR_LAYERS,
  type BasemapId,
} from "@/components/map/mapConfig";
import type { Location, MapLayer } from "@/types/orca";

interface Props {
  center: Location | null;
  activeLayers: MapLayer[];
  userLocation: Location | null;
  isDark: boolean;
  basemap: BasemapId;
  /** Needed for route_line, which is computed per query and held per session. */
  sessionId: string;
  /** Clicking the water re-points every panel at that spot. */
  onPickPoint?: (location: Location) => void;
}

/** Bay of Bengal off Kakinada — a sensible first view before any query. */
const DEFAULT_CENTER: [number, number] = [16.99, 82.24];
const DEFAULT_ZOOM = 8;

/**
 * The user's pin, as a div marker.
 *
 * Leaflet's default icon is a PNG resolved by relative URL, which breaks under a bundler
 * and has to be re-pointed at the packaged asset. A div marker sidesteps that entirely,
 * inherits the palette in both themes, and stays crisp on a retina screen.
 */
const PIN_ICON = L.divIcon({
  className: "orca-pin",
  html: '<span class="orca-pin-pulse"></span><span class="orca-pin-dot"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/**
 * Pans (never jumps) to a new answer's location.
 *
 * Both guards below are load-bearing, and the second one was found the hard way: below
 * `md` the map lives inside a `display: none` panel until the user switches to it. A
 * hidden Leaflet container has a size of 0×0, `getZoom()` comes back undefined, and
 * `flyTo` then computes an `Invalid LatLng (NaN, NaN)` and throws — which, with no error
 * boundary above it, unmounted the entire application and left a blank white page on
 * every phone.
 */
function Recenter({ center }: { center: Location | null }) {
  const map = useMap();

  useEffect(() => {
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon)) return;

    const size = map.getSize();
    const zoom = map.getZoom();
    if (size.x === 0 || size.y === 0 || !Number.isFinite(zoom)) return;

    // flyTo rather than setView: a smooth pan keeps the viewer oriented, while a jump
    // makes it unclear whether the map moved or the data changed.
    map.flyTo([center.lat, center.lon], Math.max(zoom, 8), { duration: 0.8 });
  }, [center?.lat, center?.lon, map]);

  return null;
}

/**
 * Re-measure the map whenever its container changes size.
 *
 * Leaflet caches the container's dimensions and only recomputes them on a window resize.
 * A panel that appears, a rail that opens, a tab that switches — none of those fire one,
 * so the map keeps drawing at whatever size it had when it was last measured, and renders
 * as a grey box with the tiles in the wrong place.
 */
function KeepSized() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      // `animate: false` — a size correction is not a movement, and animating it makes
      // the map lurch every time a panel opens.
      map.invalidateSize({ animate: false });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

/** Live coordinate readout, bottom-left. Small, but it is what makes a map feel like a chart. */
function CoordinateReadout() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  const map = useMapEvents({
    mousemove: (event) => setPosition(event.latlng),
    mouseout: () => setPosition(null),
    zoomend: () => setZoom(map.getZoom()),
  });

  useEffect(() => setZoom(map.getZoom()), [map]);

  return (
    // Hidden on touch: it reports the pointer position, and there is no pointer.
    <div className="pointer-events-none absolute bottom-2 left-2 z-[400] hidden rounded-md md:block border border-slate-200 bg-white/85 px-2 py-1 font-mono text-[10.5px] text-slate-600 backdrop-blur dark:border-white/10 dark:bg-abyss-950/85 dark:text-slate-300">
      {position
        ? `${position.lat.toFixed(3)}°N  ${position.lng.toFixed(3)}°E`
        : "move over the map"}
      {zoom !== null && <span className="ml-2 opacity-60">z{zoom}</span>}
    </div>
  );
}

/** Click-to-repoint. A map you cannot ask about the spot you clicked is a picture. */
function ClickToPick({ onPick }: { onPick?: (location: Location) => void }) {
  useMapEvents({
    click: (event) => {
      if (!onPick) return;
      onPick({
        lat: Number(event.latlng.lat.toFixed(4)),
        lon: Number(event.latlng.lng.toFixed(4)),
        name: "Dropped pin",
        source: "map_click",
      });
    },
  });
  return null;
}

/** A gridded field drawn as small coloured dots. */
function GridLayer({ layer, center }: { layer: MapLayer; center: Location | null }) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    if (!center) return;
    let cancelled = false;

    getLayerCached(layer, { lat: center.lat, lon: center.lon })
      .then((collection) => {
        if (!cancelled) setData(collection);
      })
      // A layer whose data isn't downloaded returns 503. The trace and the layer control
      // both say why, so the map just omits it rather than throwing up an error.
      .catch(() => setData(null));

    return () => {
      cancelled = true;
    };
  }, [layer, center?.lat, center?.lon]);

  const props = (data as unknown as { properties?: Record<string, number | string> })
    ?.properties;

  if (!data?.features?.length) return null;

  // min/max ride along on the collection so the ramp doesn't need a second pass.
  const min = Number(props?.min ?? 0);
  const max = Number(props?.max ?? 1);
  const unit = String(props?.unit ?? "");

  return (
    <>
      {data.features.map((feature, index) => {
        const coords = (feature.geometry as GeoJSON.Point)?.coordinates;
        const value = Number(feature.properties?.value);
        if (!coords || !Number.isFinite(value)) return null;

        const color = rampColor(layer, value, min, max);
        return (
          <CircleMarker
            key={`${layer}-${index}`}
            center={[coords[1], coords[0]]}
            radius={layer === "hazard_overlay" ? 7 : 5.5}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: layer === "hazard_overlay" ? 0.75 : 0.6,
              weight: layer === "hazard_overlay" ? 1 : 0,
            }}
          >
            <Popup>
              <strong>{LAYERS[layer].label}</strong>
              <br />
              {value} {unit}
              {feature.properties?.time && (
                <>
                  <br />
                  <span className="opacity-60">
                    {new Date(String(feature.properties.time)).toLocaleString()}
                  </span>
                </>
              )}
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

/**
 * Detected thermal fronts: MultiPoint features, drawn as small warm dots.
 *
 * The backend already thins each feature to at most 240 points, but a dozen features is
 * still ~1500 individual Leaflet vectors — enough to make panning visibly stutter on a
 * phone, and enough to bury the coastline under confetti. So the client applies a second,
 * *total* budget across all features: the strongest features are drawn at full density and
 * the weaker ones are progressively thinned, which keeps the structure legible while
 * bounding the vector count.
 */
const FRONT_POINT_BUDGET = 420;
const FRONT_FEATURE_LIMIT = 8;

function FrontsLayer({ center }: { center: Location | null }) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    if (!center) return;
    let cancelled = false;

    getLayerCached("ocean_fronts", { lat: center.lat, lon: center.lon, radiusKm: 300 })
      .then((collection) => {
        if (!cancelled) setData(collection);
      })
      .catch(() => setData(null));

    return () => {
      cancelled = true;
    };
  }, [center?.lat, center?.lon]);

  if (!data?.features?.length) return null;

  // Features arrive strongest-first, so a per-feature share of the budget spends most of
  // it on the fronts that matter and thins the rest.
  const drawn = data.features.slice(0, FRONT_FEATURE_LIMIT);
  const total = drawn.reduce(
    (sum, feature) => sum + ((feature.geometry as GeoJSON.MultiPoint)?.coordinates?.length ?? 0),
    0,
  );
  const stride = Math.max(1, Math.ceil(total / FRONT_POINT_BUDGET));

  return (
    <>
      {drawn.map((feature, featureIndex) => {
        const coordinates = (feature.geometry as GeoJSON.MultiPoint)?.coordinates ?? [];
        const props = feature.properties ?? {};
        const eddy = props.kind === "eddy_like";

        return coordinates.filter((_, index) => index % stride === 0).map((position, index) => (
          <CircleMarker
            key={`front-${featureIndex}-${index}`}
            center={[position[1], position[0]]}
            radius={eddy ? 3 : 2.5}
            pathOptions={{
              color: eddy ? "#fbbf24" : "#f97316",
              fillColor: eddy ? "#fbbf24" : "#f97316",
              fillOpacity: 0.7,
              weight: 0,
            }}
          >
            {index === 0 && (
              <Popup>
                <strong>{eddy ? "Eddy-like feature" : "Thermal front"}</strong>
                <br />
                {props.length_km} km long, peak gradient {props.gradient_max_c_per_km} °C/km
                <br />
                Mean SST {props.sst_mean_c} °C
                <br />
                <span className="opacity-60">{String(props.source)}</span>
              </Popup>
            )}
          </CircleMarker>
        ));
      })}
    </>
  );
}

function VectorLayer({
  layer,
  center,
  sessionId,
}: {
  layer: MapLayer;
  center: Location | null;
  sessionId: string;
}) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;

    getLayerCached(
      layer,
      center ? { lat: center.lat, lon: center.lon, sessionId } : { sessionId },
    )
      .then((collection) => {
        if (!cancelled) setData(collection);
      })
      .catch(() => setData(null));

    return () => {
      cancelled = true;
    };
  }, [layer, center?.lat, center?.lon, sessionId]);

  if (!data?.features?.length) return null;

  return (
    <GeoJSON
      // Keyed so React rebuilds the layer when the data changes; Leaflet layers don't
      // re-render their geometry in place.
      key={`${layer}-${data.features.length}-${center?.lat ?? 0}`}
      data={data}
      style={() => LAYERS[layer].style ?? { color: "#0891b2", weight: 2 }}
      onEachFeature={(feature, leafletLayer) => {
        const props = feature.properties ?? {};
        // Popups show WHY a zone qualified — the proxy's own evidence, so a green blob
        // on the map can explain itself instead of appearing by fiat.
        const rows = [
          props.chlorophyll_mg_m3 != null && `Chlorophyll-a: ${props.chlorophyll_mg_m3} mg/m³`,
          props.sst_gradient_c_per_km != null &&
            `SST gradient: ${props.sst_gradient_c_per_km} °C/km`,
          props.confidence != null && `Confidence: ${props.confidence}`,
          props.hours != null && `About ${props.hours} h under way`,
          props.distance_km != null && `Distance: ${props.distance_km} km`,
          props.max_wave_m != null && `Peak wave on route: ${props.max_wave_m} m`,
          props.method && `Method: ${props.method}`,
          props.source && `Source: ${props.source}`,
        ].filter(Boolean);

        leafletLayer.bindPopup(
          `<div style="font-size:12px;line-height:1.55"><strong>${
            LAYERS[layer].label
          }</strong>${rows.length ? `<br/>${rows.join("<br/>")}` : ""}</div>`,
        );
      }}
    />
  );
}

export default function MapView({
  center,
  activeLayers,
  userLocation,
  isDark,
  basemap,
  sessionId,
  onPickPoint,
}: Props) {
  const pin = userLocation ?? center;
  const tiles = BASEMAPS[basemap];
  // Dark mode swaps the label tile set rather than filtering it — see mapConfig.
  const referenceUrl = (isDark ? tiles.darkReference : tiles.reference) ?? null;

  const vector = useMemo(
    () => activeLayers.filter((layer) => VECTOR_LAYERS.includes(layer)),
    [activeLayers],
  );
  const grids = useMemo(
    () => activeLayers.filter((layer) => GRID_LAYERS.includes(layer)),
    [activeLayers],
  );

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      zoomControl
      className="h-full w-full"
    >
      <TileLayer
        // Keyed on the basemap so switching actually swaps the tile source: react-leaflet
        // will not change a live TileLayer's url prop in place.
        key={basemap}
        attribution={tiles.attribution}
        url={tiles.url}
        maxZoom={tiles.maxZoom}
        // Each basemap declares its own dark-mode treatment — see mapConfig. The class is
        // inert in light mode: the filters are defined under `html.dark` only.
        className={tiles.darkBase}
      />

      <Recenter center={center} />
      <KeepSized />
      <ClickToPick onPick={onPickPoint} />
      <CoordinateReadout />

      {/* Grids first so vector zones and boundaries draw on top of them. */}
      {grids.map((layer) => (
        <GridLayer key={layer} layer={layer} center={center} />
      ))}

      {activeLayers.includes("ocean_fronts") && <FrontsLayer center={center} />}

      {vector.map((layer) => (
        <VectorLayer key={layer} layer={layer} center={center} sessionId={sessionId} />
      ))}

      {/* Place labels for the ocean basemap, which ships bathymetry with no names on it.
          A second tile layer, so it sits above the base and below the data overlays —
          which is the right order: a fishing zone should cover a label, not the reverse. */}
      {referenceUrl && (
        <TileLayer
          // Keyed on the theme too, so switching to dark actually swaps the tile source.
          key={`${basemap}-reference-${isDark ? "dark" : "light"}`}
          url={referenceUrl}
          maxZoom={tiles.maxZoom}
          zIndex={650}
          attribution=""
        />
      )}

      {pin && (
        <>
          {/* A soft ring marks roughly the area the sea-state sample covers, so the
              verdict's "25 km offshore" reading has a visible footprint. */}
          <CircleMarker
            center={[pin.lat, pin.lon]}
            radius={26}
            pathOptions={{
              color: isDark ? "#22d3ee" : "#0891b2",
              weight: 1.25,
              dashArray: "3 4",
              fillColor: isDark ? "#22d3ee" : "#06b6d4",
              fillOpacity: 0.06,
            }}
          />
          <Marker position={[pin.lat, pin.lon]} icon={PIN_ICON}>
            <Popup>
              <strong>{pin.name ?? "Your location"}</strong>
              <br />
              {pin.lat.toFixed(3)}°N, {pin.lon.toFixed(3)}°E
              {pin.source && (
                <>
                  <br />
                  <span className="opacity-60">via {pin.source}</span>
                </>
              )}
            </Popup>
          </Marker>
        </>
      )}
    </MapContainer>
  );
}
