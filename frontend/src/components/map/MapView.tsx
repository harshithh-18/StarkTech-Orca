/**
 * The map — Maritime Navigation & Hydrodynamic Bathymetry Chart.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
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

import { getLayerCached, OrcaApiError } from "@/api/client";
import {
  BASEMAPS,
  GRID_LAYERS,
  LAYERS,
  rampColor,
  VECTOR_LAYERS,
  type BasemapId,
} from "@/components/map/mapConfig";
import Icon from "@/components/common/Icon";
import type { Location, MapLayer } from "@/types/orca";

interface Props {
  center: Location | null;
  activeLayers: MapLayer[];
  userLocation: Location | null;
  isDark: boolean;
  basemap: BasemapId;
  sessionId: string;
  onPickPoint?: (location: Location) => void;
  onAskPrompt?: (query: string) => void;
  onOpenConditions?: () => void;
}

const DEFAULT_CENTER: [number, number] = [16.99, 82.24];
const DEFAULT_ZOOM = 8;

/**
 * Reported by each data layer to its parent: `null` once the layer's real data is on the
 * map, or a plain-language reason when the fetch failed. This is what turns a silently
 * empty overlay into an honest "this data is not available, and here is why" — the map
 * must never leave a user guessing whether a layer is genuinely quiet or simply broken.
 */
type LayerStatusFn = (layer: MapLayer, reason: string | null) => void;

/** The backend answers every failed layer with {code, message, hint}; show message+hint. */
function layerErrorReason(err: unknown): string {
  if (err instanceof OrcaApiError) return err.displayText;
  return "Could not reach the ORCA backend on port 8000.";
}

const PIN_ICON = L.divIcon({
  className: "orca-pin",
  html: '<span class="orca-pin-pulse"></span><span class="orca-pin-dot"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function Recenter({ center }: { center: Location | null }) {
  const map = useMap();

  useEffect(() => {
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon)) return;

    const size = map.getSize();
    const zoom = map.getZoom();
    if (size.x === 0 || size.y === 0 || !Number.isFinite(zoom)) return;

    map.flyTo([center.lat, center.lon], Math.max(zoom, 8), { duration: 0.8 });
  }, [center?.lat, center?.lon, map]);

  return null;
}

function KeepSized() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

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
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] hidden rounded-xl md:flex items-center gap-2 border border-sky-200/80 bg-white/90 px-3 py-1.5 font-mono text-[11px] font-bold text-ocean-900 shadow-md backdrop-blur-md dark:border-cyan-500/20 dark:bg-abyss-950/90 dark:text-cyan-200">
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
      <span>
        {position
          ? `${position.lat.toFixed(3)}°N  ${position.lng.toFixed(3)}°E`
          : "Move cursor over chart"}
      </span>
      {zoom !== null && <span className="opacity-60 border-l border-current/20 pl-2">Scale z{zoom}</span>}
    </div>
  );
}

function ClickToPick({ onPick }: { onPick?: (location: Location) => void }) {
  useMapEvents({
    click: (event) => {
      if (!onPick) return;
      onPick({
        lat: Number(event.latlng.lat.toFixed(4)),
        lon: Number(event.latlng.lng.toFixed(4)),
        name: "Dropped water pin",
        source: "map_click",
      });
    },
  });
  return null;
}

function GridLayer({
  layer,
  center,
  onStatus,
}: {
  layer: MapLayer;
  center: Location | null;
  onStatus?: LayerStatusFn;
}) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    if (!center) return;
    let cancelled = false;

    getLayerCached(layer, { lat: center.lat, lon: center.lon })
      .then((collection) => {
        if (!cancelled) {
          setData(collection);
          onStatus?.(layer, null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setData(null);
          onStatus?.(layer, layerErrorReason(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [layer, center?.lat, center?.lon]);

  const props = (data as unknown as { properties?: Record<string, number | string> })
    ?.properties;

  if (!data?.features?.length) return null;

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

const FRONT_POINT_BUDGET = 420;
const FRONT_FEATURE_LIMIT = 8;

function FrontsLayer({
  center,
  onStatus,
}: {
  center: Location | null;
  onStatus?: LayerStatusFn;
}) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    if (!center) return;
    let cancelled = false;

    getLayerCached("ocean_fronts", { lat: center.lat, lon: center.lon, radiusKm: 300 })
      .then((collection) => {
        if (!cancelled) {
          setData(collection);
          onStatus?.("ocean_fronts", null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setData(null);
          onStatus?.("ocean_fronts", layerErrorReason(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [center?.lat, center?.lon]);

  if (!data?.features?.length) return null;

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
            radius={eddy ? 3.5 : 2.5}
            pathOptions={{
              color: eddy ? "#fbbf24" : "#f97316",
              fillColor: eddy ? "#fbbf24" : "#f97316",
              fillOpacity: 0.75,
              weight: 0,
            }}
          >
            {index === 0 && (
              <Popup>
                <strong>{eddy ? "Eddy Feature" : "Thermal Front"}</strong>
                <br />
                Length: {props.length_km} km · Gradient: {props.gradient_max_c_per_km} °C/km
                <br />
                Mean SST: {props.sst_mean_c} °C
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
  onStatus,
}: {
  layer: MapLayer;
  center: Location | null;
  sessionId: string;
  onStatus?: LayerStatusFn;
}) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;

    getLayerCached(
      layer,
      center ? { lat: center.lat, lon: center.lon, sessionId } : { sessionId },
    )
      .then((collection) => {
        if (!cancelled) {
          setData(collection);
          onStatus?.(layer, null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setData(null);
          onStatus?.(layer, layerErrorReason(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [layer, center?.lat, center?.lon, sessionId]);

  if (!data?.features?.length) return null;

  return (
    <GeoJSON
      key={`${layer}-${data.features.length}-${center?.lat ?? 0}`}
      data={data}
      style={() => LAYERS[layer].style ?? { color: "#0891b2", weight: 2 }}
      onEachFeature={(feature, leafletLayer) => {
        const props = feature.properties ?? {};
        const rows = [
          props.chlorophyll_mg_m3 != null && `Chlorophyll-a: ${props.chlorophyll_mg_m3} mg/m³`,
          props.sst_gradient_c_per_km != null &&
            `SST gradient: ${props.sst_gradient_c_per_km} °C/km`,
          props.confidence != null && `Confidence: ${props.confidence}`,
          props.hours != null && `ETA: ~${props.hours} h under way`,
          props.distance_km != null && `Distance: ${props.distance_km} km`,
          props.max_wave_m != null && `Peak wave on passage: ${props.max_wave_m} m`,
          props.method && `Method: ${props.method}`,
          props.source && `Source: ${props.source}`,
        ].filter(Boolean);

        leafletLayer.bindPopup(
          `<div style="font-size:12px;line-height:1.6"><strong>${
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
  onAskPrompt,
  onOpenConditions,
}: Props) {
  const pin = userLocation ?? center;
  const tiles = BASEMAPS[basemap];
  const referenceUrl = (isDark ? tiles.darkReference : tiles.reference) ?? null;

  const vector = useMemo(
    () => activeLayers.filter((layer) => VECTOR_LAYERS.includes(layer)),
    [activeLayers],
  );
  const grids = useMemo(
    () => activeLayers.filter((layer) => GRID_LAYERS.includes(layer)),
    [activeLayers],
  );

  // Reasons for every layer whose real data failed to load, keyed by layer id. A layer
  // clears itself the moment it succeeds. Only currently-active layers are shown, so a
  // stale failure from a layer the user has since switched off never lingers on screen.
  const [layerErrors, setLayerErrors] = useState<Partial<Record<MapLayer, string>>>({});

  const handleLayerStatus = useCallback<LayerStatusFn>((layer, reason) => {
    setLayerErrors((prev) => {
      if (reason === null) {
        if (!(layer in prev)) return prev;
        const next = { ...prev };
        delete next[layer];
        return next;
      }
      if (prev[layer] === reason) return prev;
      return { ...prev, [layer]: reason };
    });
  }, []);

  const activeErrors = useMemo(
    () =>
      (Object.entries(layerErrors) as [MapLayer, string][]).filter(([layer]) =>
        activeLayers.includes(layer),
      ),
    [layerErrors, activeLayers],
  );

  const isClickedPin = pin?.source === "map_click";

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        zoomControl
        className="h-full w-full"
      >
        <TileLayer
          key={basemap}
          attribution={tiles.attribution}
          url={tiles.url}
          maxZoom={tiles.maxZoom}
          className={tiles.darkBase}
        />

        <Recenter center={center} />
        <KeepSized />
        <ClickToPick onPick={onPickPoint} />
        <CoordinateReadout />

        {grids.map((layer) => (
          <GridLayer key={layer} layer={layer} center={center} onStatus={handleLayerStatus} />
        ))}

        {activeLayers.includes("ocean_fronts") && (
          <FrontsLayer center={center} onStatus={handleLayerStatus} />
        )}

        {vector.map((layer) => (
          <VectorLayer
            key={layer}
            layer={layer}
            center={center}
            sessionId={sessionId}
            onStatus={handleLayerStatus}
          />
        ))}

        {referenceUrl && (
          <TileLayer
            key={`${basemap}-reference-${isDark ? "dark" : "light"}`}
            url={referenceUrl}
            maxZoom={tiles.maxZoom}
            zIndex={650}
            attribution=""
          />
        )}

        {pin && (
          <>
            <CircleMarker
              center={[pin.lat, pin.lon]}
              radius={28}
              pathOptions={{
                color: isDark ? "#22d3ee" : "#0284c7",
                weight: 1.5,
                dashArray: "3 4",
                fillColor: isDark ? "#22d3ee" : "#0284c7",
                fillOpacity: 0.08,
              }}
            />
            <Marker position={[pin.lat, pin.lon]} icon={PIN_ICON}>
              <Popup>
                <strong>{pin.name ?? "Station Point"}</strong>
                <br />
                {pin.lat.toFixed(3)}°N, {pin.lon.toFixed(3)}°E
                {pin.source && (
                  <>
                    <br />
                    <span className="opacity-60">Source: {pin.source}</span>
                  </>
                )}
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      {/* ── Data availability notice ──────────────────────────────────────
          When a switched-on layer's real data cannot be fetched, say so plainly rather
          than leaving the map silently blank. Each row names the layer and the backend's
          own reason + fix, so "is this layer just quiet, or is it broken?" is never a
          guess. Empty-but-successful layers (e.g. no hazard cells) are NOT errors and do
          not appear here. */}
      {activeErrors.length > 0 && (
        <div
          className="absolute top-3 left-3 z-[450] max-w-xs rounded-xl border border-amber-400/40 bg-amber-50/95 p-2.5 shadow-lg backdrop-blur-md dark:border-amber-300/30 dark:bg-amber-950/90"
          role="status"
        >
          <div className="flex items-center gap-1.5 border-b border-amber-200/70 pb-1.5 dark:border-amber-300/20">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <Icon name="alert" size={12} />
            </span>
            <span className="text-[12px] font-bold text-amber-900 dark:text-amber-100">
              {activeErrors.length === 1 ? "A layer has no live data" : "Some layers have no live data"}
            </span>
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {activeErrors.map(([layer, reason]) => (
              <li key={layer} className="text-[11px] leading-snug text-amber-900/90 dark:text-amber-100/90">
                <span className="font-semibold">{LAYERS[layer].label}:</span> {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Interactive Water Inspector HUD ───────────────────────────── */}
      {pin && isClickedPin && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[450] animate-slide-up w-[92%] max-w-lg rounded-2xl border border-cyan-500/30 bg-white/95 p-3 shadow-2xl backdrop-blur-md dark:bg-abyss-900/95 dark:border-cyan-400/30">
          <div className="flex items-center justify-between gap-2 border-b border-sky-100 pb-2 dark:border-white/10">
            <div className="flex items-center gap-1.5">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-ocean-500/20 text-ocean-700 dark:text-cyan-300">
                <Icon name="crosshair" size={12} />
              </span>
              <span className="text-[12px] font-bold text-slate-900 dark:text-slate-100">
                Ocean Point Inspector
              </span>
              <span className="font-mono text-[10.5px] font-semibold text-ocean-700 dark:text-cyan-300">
                {pin.lat.toFixed(3)}°N, {pin.lon.toFixed(3)}°E
              </span>
            </div>

            <button
              type="button"
              onClick={() => onPickPoint?.({ lat: DEFAULT_CENTER[0], lon: DEFAULT_CENTER[1], source: "reset" })}
              className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              title="Close HUD"
            >
              <Icon name="close" size={13} />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {onAskPrompt && (
              <button
                type="button"
                onClick={() =>
                  onAskPrompt(`Is it safe to sail tomorrow near coordinates ${pin.lat.toFixed(3)}°N, ${pin.lon.toFixed(3)}°E?`)
                }
                className="btn-primary py-1.5 px-2.5 text-[11px] font-bold shadow-sm"
              >
                <Icon name="anchor" size={13} />
                Check Safety Here
              </button>
            )}

            {onOpenConditions && (
              <button
                type="button"
                onClick={onOpenConditions}
                className="btn-ghost py-1.5 px-2.5 text-[11px] font-bold"
              >
                <Icon name="gauge" size={13} />
                View Conditions
              </button>
            )}

            {onAskPrompt && (
              <button
                type="button"
                onClick={() =>
                  onAskPrompt(`Where is the nearest Potential Fishing Zone from ${pin.lat.toFixed(3)}°N, ${pin.lon.toFixed(3)}°E today?`)
                }
                className="btn-ghost py-1.5 px-2.5 text-[11px] font-bold"
              >
                <Icon name="fish" size={13} />
                Find Fish Nearby
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
