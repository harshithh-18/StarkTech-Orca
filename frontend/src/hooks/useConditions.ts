/**
 * Live conditions for the selected location.
 *
 * Owner: D · Phase: P4
 *
 * Fetches `GET /api/conditions` whenever the location changes, and refreshes on a timer so
 * a console left open on a wheelhouse screen does not quietly go stale. Refreshes pause
 * while the tab is hidden — a backgrounded tab polling a forecast API every ten minutes
 * for a week is rude to a free service that asks for nothing in return.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { getConditions, OrcaApiError } from "@/api/client";
import type { ConditionsSnapshot, Location } from "@/types/orca";

/** Upstream models publish hourly and the backend caches for an hour; 10 min is plenty. */
const REFRESH_MS = 10 * 60 * 1000;

export interface UseConditions {
  data: ConditionsSnapshot | null;
  loading: boolean;
  error: string | null;
  /** Wall-clock of the last successful fetch — the dashboard shows it. */
  updatedAt: Date | null;
  refresh(): void;
}

export function useConditions(location: Location | null): UseConditions {
  const [data, setData] = useState<ConditionsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [nonce, setNonce] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!location) return;

    // Cancel the in-flight request before starting another: clicking three harbours in a
    // row must leave the third one's data on screen, not whichever response lands last.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    getConditions(location.lat, location.lon, location.name, controller.signal)
      .then((snapshot) => {
        if (controller.signal.aborted) return;
        setData(snapshot);
        setUpdatedAt(new Date());
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || (cause as Error)?.name === "AbortError") return;
        setData(null);
        setError(
          cause instanceof OrcaApiError
            ? cause.displayText
            : "Could not reach the ORCA backend.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [location?.lat, location?.lon, location?.name, nonce]);

  // Periodic refresh, paused while the tab is hidden.
  useEffect(() => {
    if (!location) return;

    let timer: number | undefined;

    const schedule = () => {
      window.clearTimeout(timer);
      if (document.hidden) return;
      timer = window.setTimeout(() => {
        refresh();
        schedule();
      }, REFRESH_MS);
    };

    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
      } else {
        // Coming back to the tab, the number on screen may be an hour old — refresh
        // immediately rather than waiting out the rest of the interval.
        refresh();
        schedule();
      }
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [location?.lat, location?.lon, refresh]);

  return { data, loading, error, updatedAt, refresh };
}
