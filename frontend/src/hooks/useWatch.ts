/**
 * Proactive safety watch.
 *
 * Owner: D · Phase: P4
 *
 * The user arms a watch on a location; the backend re-checks it on a timer and pushes
 * `type: "alert"` frames down the shared socket. This hook holds the watch's identity and
 * the alerts it has raised.
 *
 * ## Alerts arrive twice, on purpose
 *
 * A frame on the socket is the fast path. `GET /api/watch/{id}` is the durable one — a
 * client that was reconnecting when an alert fired would otherwise never learn about it,
 * and a safety warning that can be lost by a dropped WebSocket is not a safety feature.
 * The two are reconciled by `raised_at` + `title`, so seeing an alert on both paths shows
 * it once.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  API_BASE,
  cancelWatch,
  createWatch,
  listWatches,
  OrcaApiError,
} from "@/api/client";
import type { TraceListener } from "@/hooks/useOrcaSocket";
import type { Language, Location, WatchAlert, WatchStatus } from "@/types/orca";

/** Reconciliation key. Two alerts with the same title at the same instant are the same. */
const keyOf = (alert: WatchAlert) => `${alert.raised_at}|${alert.title}`;

function merge(existing: WatchAlert[], incoming: WatchAlert[]): WatchAlert[] {
  const seen = new Set(existing.map(keyOf));
  const added = incoming.filter((alert) => !seen.has(keyOf(alert)));
  if (!added.length) return existing;
  // Newest first: the panel is read from the top and the newest alert is the one that
  // matters.
  return [...added, ...existing].sort((a, b) => b.raised_at.localeCompare(a.raised_at));
}

export interface UseWatch {
  status: WatchStatus | null;
  alerts: WatchAlert[];
  /** Alerts raised since the panel was last opened — drives the nav badge. */
  unread: number;
  starting: boolean;
  error: string | null;
  start(location: Location, language: Language): Promise<void>;
  stop(): Promise<void>;
  markRead(): void;
}

export function useWatch(
  sessionId: string,
  subscribe: (listener: TraceListener) => () => void,
): UseWatch {
  const [status, setStatus] = useState<WatchStatus | null>(null);
  const [alerts, setAlerts] = useState<WatchAlert[]>([]);
  const [unread, setUnread] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchId = useRef<string | null>(null);

  // ── Fast path: socket frames ────────────────────────────────────────────
  useEffect(
    () =>
      subscribe((event) => {
        if (event.type !== "alert") return;
        if (watchId.current && event.payload.watch_id !== watchId.current) return;

        setAlerts((current) => {
          const merged = merge(current, [event.payload]);
          if (merged !== current) setUnread((n) => n + 1);
          return merged;
        });
      }),
    [subscribe],
  );

  // ── Durable path: poll the watch's own history ──────────────────────────
  useEffect(() => {
    if (!status?.watch.active) return;

    let cancelled = false;
    const poll = () => {
      listWatches(sessionId)
        .then((all) => {
          if (cancelled) return;
          const mine = all.find((w) => w.watch.id === watchId.current);
          if (!mine) {
            // The backend forgot it — a restart, since watches are in-memory by design.
            // Say so by clearing, rather than showing a watch that is not running.
            setStatus(null);
            watchId.current = null;
            return;
          }
          setStatus(mine);
          setAlerts((current) => merge(current, mine.alerts));
        })
        .catch(() => undefined);
    };

    // A third of the watch's own interval: often enough to catch a missed frame quickly,
    // rarely enough that it is not a second polling loop in disguise.
    const period = Math.max(60_000, (status.watch.interval_seconds * 1000) / 3);
    const timer = window.setInterval(poll, period);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [sessionId, status?.watch.id, status?.watch.active, status?.watch.interval_seconds]);

  const start = useCallback(
    async (location: Location, language: Language) => {
      setStarting(true);
      setError(null);
      try {
        const created = await createWatch({
          session_id: sessionId,
          lat: location.lat,
          lon: location.lon,
          name: location.name,
          language,
        });
        watchId.current = created.watch.id;
        setStatus(created);
        // The first check runs server-side before the response returns, so anything
        // already wrong at this location is in `created.alerts` right now.
        setAlerts((current) => merge(current, created.alerts));
        setUnread((n) => n + created.alerts.length);
      } catch (cause: unknown) {
        setError(
          cause instanceof OrcaApiError
            ? cause.displayText
            : "Could not start a watch here.",
        );
      } finally {
        setStarting(false);
      }
    },
    [sessionId],
  );

  const stop = useCallback(async () => {
    const id = watchId.current;
    if (!id) return;
    watchId.current = null;
    setStatus(null);
    try {
      await cancelWatch(id);
    } catch {
      // The watch is gone from this client either way; a failed cancel leaves a timer
      // running on the server that will be cleared at shutdown, which is not worth an
      // error message the user cannot act on.
    }
  }, []);

  const markRead = useCallback(() => setUnread(0), []);

  // Stop the watch when the tab closes, so a refresh does not leave orphaned timers
  // polling a free forecast API forever.
  //
  // `keepalive` rather than sendBeacon: a beacon is always a POST and would hit the
  // register route instead of cancelling. keepalive lets a DELETE outlive the page.
  useEffect(() => {
    const onPageHide = () => {
      const id = watchId.current;
      if (!id) return;
      fetch(`${API_BASE}/api/watch/${id}`, { method: "DELETE", keepalive: true }).catch(
        () => undefined,
      );
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  return { status, alerts, unread, starting, error, start, stop, markRead };
}
