/**
 * How a departure window is written.
 *
 * Owner: D · Phase: P4
 *
 * Shared by the verdict card, the glance card and the windows card, because they must
 * agree: three components each formatting the same window their own way is how a user ends
 * up reading two different answers to "when can I go".
 *
 * The date on the end matters. A 27-hour window written "Thu 3 Sept, 04:00–06:00" reads as
 * two hours on Thursday morning, and the "(27 h)" beside it looks like a bug. When the
 * window crosses midnight the end carries its own day.
 */

import type { SafeWindow } from "@/types/orca";

const DAY: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
const CLOCK: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

export function formatWindow(window: SafeWindow): string {
  const start = new Date(window.start);
  const end = new Date(window.end);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${window.hours} h`;
  }

  const sameDay = start.toDateString() === end.toDateString();
  const from = `${start.toLocaleDateString(undefined, DAY)}, ${start.toLocaleTimeString(undefined, CLOCK)}`;

  return sameDay
    ? `${from}–${end.toLocaleTimeString(undefined, CLOCK)}`
    : `${from} → ${end.toLocaleDateString(undefined, DAY)}, ${end.toLocaleTimeString(undefined, CLOCK)}`;
}

/** The short form, for a one-line summary: "Thu, 04:00 · 27 h". */
export function formatWindowShort(window: SafeWindow): string {
  const start = new Date(window.start);
  if (Number.isNaN(start.getTime())) return `${window.hours} h`;
  return `${start.toLocaleDateString(undefined, { weekday: "short" })}, ${start.toLocaleTimeString(
    undefined,
    CLOCK,
  )} · ${window.hours} h`;
}
