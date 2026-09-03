/**
 * The icon set.
 *
 * Owner: D · Phase: P4
 *
 * One 24×24 stroke system, `currentColor`, 1.6 px, round caps and joins. Every glyph in
 * the interface comes from here.
 *
 * ## Why not emoji
 *
 * The previous build used emoji for UI chrome — 🎣 on buttons, 🌊 in banners, ▶ for a
 * disclosure arrow. Emoji are rendered by the operating system, so they carry their own
 * colour, their own optical weight and their own metrics: they cannot inherit the text
 * colour, they will not align on a baseline with a label, and the same button looks
 * materially different on macOS, Windows and Android. A row of them reads as decoration
 * bolted onto a page rather than as an interface.
 *
 * Emoji still appear in exactly one place — the language chips, where 🗣️ is content
 * rather than chrome.
 *
 * Adding a glyph: keep it inside a 24×24 box with ~2 px of optical padding, stroke-only,
 * and name it for what it *means* here (`gust`, not `wind-fast`), because the backend
 * sends these names in `ConditionTile.icon`.
 */

import type { SVGProps } from "react";

export type IconName =
  // conditions
  | "wave" | "wind" | "gust" | "swell" | "temperature" | "visibility"
  | "storm" | "tide" | "current"
  // domain
  | "fish" | "anchor" | "compass" | "boundary" | "route" | "front" | "harbour"
  // interface
  | "chat" | "gauge" | "bell" | "layers" | "info" | "map"
  | "mic" | "stop" | "send" | "search" | "gps" | "close" | "check"
  | "alert" | "clock" | "chart" | "agent" | "chevron" | "arrow-right"
  | "sun" | "moon" | "monitor" | "volume" | "refresh" | "plus" | "sparkles"
  | "shield" | "eye" | "external";

/** Path data only — the wrapper below supplies every shared attribute. */
const PATHS: Record<IconName, string> = {
  // ── Conditions ─────────────────────────────────────────────────────────
  wave: "M2 15c2.5 0 2.5-2.5 5-2.5s2.5 2.5 5 2.5 2.5-2.5 5-2.5 2.5 2.5 5 2.5M2 19.5c2.5 0 2.5-2.5 5-2.5s2.5 2.5 5 2.5 2.5-2.5 5-2.5 2.5 2.5 5 2.5M2 10.5c2.5 0 2.5-2.5 5-2.5s2.5 2.5 5 2.5 2.5-2.5 5-2.5 2.5 2.5 5 2.5",
  wind: "M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8a2.5 2.5 0 1 1-2.5 2.5",
  gust: "M2 7h9a2.5 2.5 0 1 0-2.5-2.5M2 11.5h13.5a3 3 0 1 1-3 3M2 16h7M12 19.5h4.5a2.5 2.5 0 1 0-2.5-2.5",
  swell: "M2 17c3 0 3-4 6-4s3 4 6 4 3-4 6-4M4 9.5 8 5l4 4.5",
  temperature: "M10 13.8V5a2 2 0 1 1 4 0v8.8a4.5 4.5 0 1 1-4 0ZM12 17.5v-6",
  visibility: "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z M12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z",
  storm: "M6.5 16a4.5 4.5 0 0 1 .3-9 6 6 0 0 1 11.4 1.6A3.7 3.7 0 0 1 17.5 16M13 12l-3 4.5h3.5L11 22",
  tide: "M2 16.5c2.5 0 2.5-2.2 5-2.2s2.5 2.2 5 2.2 2.5-2.2 5-2.2 2.5 2.2 5 2.2M12 11V3m0 0L8.8 6.2M12 3l3.2 3.2",
  current: "M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0",

  // ── Domain ─────────────────────────────────────────────────────────────
  // Body, then tail, then a zero-length segment for the eye — round line caps render it
  // as a dot. Drawn with a visible tail because an eye-shaped body alone reads as an eye.
  fish: "M20.8 12c-1.9 3.1-4.6 5-7.9 5s-6-1.9-7.9-5c1.9-3.1 4.6-5 7.9-5s6 1.9 7.9 5ZM5 12 2 8.2v7.6L5 12ZM16.6 10.7h.01",
  anchor: "M12 8.5V22M12 8.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM7 12H3v1.5A9 9 0 0 0 12 22a9 9 0 0 0 9-8.5V12h-4",
  compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M15.6 8.4 13.8 14 8.4 15.6 10.2 10Z",
  boundary: "M4 3v18M20 3v18M9 8h6M9 12h6M9 16h6",
  route: "M6.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM17.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15 6.5H9.5A3.5 3.5 0 0 0 6 10c0 3.5 12 1.5 12 5a3.5 3.5 0 0 1-3.5 2.5H9",
  front: "M3 18c2.5-1 3.5-4 6-5s4.5 1.5 7-1 3-3.5 5-4M3 21c3-1.4 4-4.6 7-5.6",
  harbour: "M3 21h18M5 21V9l7-5 7 5v12M9.5 21v-5.5h5V21",

  // ── Interface ──────────────────────────────────────────────────────────
  chat: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-3.9-.8L3 20.5l1.5-4.2A8.2 8.2 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4Z",
  gauge: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18ZM12 12l4-4M8.5 12h.01M12 8.5h.01M15.5 12h.01",
  bell: "M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5ZM13.7 19.5a2 2 0 0 1-3.4 0",
  layers: "m12 2.5 9.5 5-9.5 5-9.5-5 9.5-5ZM2.5 12.5 12 17.5l9.5-5M2.5 17l9.5 5 9.5-5",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16.5v-5M12 8h.01",
  map: "m9 3.5-6 2.7v14.3l6-2.7 6 2.7 6-2.7V3.5l-6 2.7-6-2.7ZM9 3.5v14.3M15 6.2v14.3",
  mic: "M12 15.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 1 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5ZM19 11.5a7 7 0 0 1-14 0M12 18.5V22",
  stop: "M7 7h10v10H7z",
  send: "m4 11.5 16-7.5-7.5 16-2-6.5-6.5-2Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20.5 20.5 16 16",
  gps: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
  close: "M6 6l12 12M18 6 6 18",
  check: "m4.5 12.5 5 5 10-11",
  alert: "M12 9v5M12 17.5h.01M10.3 3.9 2.4 17.4A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5.3l3.3 2",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  agent: "M12 3 4 7v6.5c0 4.3 3.3 7.4 8 8.5 4.7-1.1 8-4.2 8-8.5V7l-8-4ZM9.5 12l1.8 1.8 3.5-3.6",
  chevron: "m9 5 7 7-7 7",
  "arrow-right": "M4 12h15M13 6l6 6-6 6",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1.5V4M12 20v2.5M3.5 12H1M23 12h-2.5M5.6 5.6 4 4M20 20l-1.6-1.6M18.4 5.6 20 4M4 20l1.6-1.6",
  moon: "M20.5 14.3A8.8 8.8 0 0 1 9.7 3.5a8.8 8.8 0 1 0 10.8 10.8Z",
  monitor: "M3.5 5h17v11h-17zM8.5 20h7M12 16v4",
  volume: "M11 5.5 6.5 9.5H3v5h3.5L11 18.5v-13ZM15 9.5a3.5 3.5 0 0 1 0 5M18 6.5a7.5 7.5 0 0 1 0 11",
  refresh: "M20.5 12a8.5 8.5 0 1 1-2.6-6.1M20.5 4v5h-5",
  plus: "M12 5v14M5 12h14",
  sparkles: "m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z",
  shield: "M12 22c4.7-1.1 8-4.2 8-8.5V6l-8-3.5L4 6v7.5c0 4.3 3.3 7.4 8 8.5Z",
  eye: "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12ZM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z",
  external: "M14 4h6v6M20 4l-8.5 8.5M18 14v5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h5",
};

interface Props extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** Rendered size in px. The stroke scales with it so small icons stay legible. */
  size?: number;
  className?: string;
}

export default function Icon({ name, size = 18, className = "", ...rest }: Props) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      // Slightly heavier stroke below 18 px, or the glyph disappears next to bold text.
      strokeWidth={size < 18 ? 1.9 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Icons here are always paired with a text label or an aria-label on the control,
      // so they are decorative to a screen reader by default.
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      {...rest}
    >
      <path d={path} />
    </svg>
  );
}

/** The tile icon keys the backend sends, mapped onto this set. */
export function tileIcon(key: string): IconName {
  const map: Record<string, IconName> = {
    wave: "wave",
    wind: "wind",
    gust: "gust",
    swell: "swell",
    temperature: "temperature",
    visibility: "visibility",
    storm: "storm",
    tide: "tide",
    current: "current",
  };
  return map[key] ?? "gauge";
}
