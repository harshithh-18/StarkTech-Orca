/**
 * The harbour list, from the backend.
 *
 * Owner: D · Phase: P4
 *
 * Fetched once per session from `GET /api/harbours` so there is exactly one list in the
 * system. The same fourteen coordinates that fill the picker are the ones the backend
 * measures against when it has to tell someone in Hyderabad where the sea actually is —
 * and a picker offering a harbour the backend has never heard of would be a quiet way for
 * those two answers to disagree.
 *
 * `SEED` is a three-entry fallback for the case where the backend is not up yet. It is not
 * a copy of the list: it exists so the header control is never empty and never blocks
 * first paint, and it is replaced the moment the real list arrives.
 */

import { useEffect, useState } from "react";

import { getHarbours } from "@/api/client";
import type { Harbour } from "@/types/orca";

/** Enough to not render an empty control before the fetch resolves. Not the real list. */
export const SEED: Harbour[] = [
  { name: "Kakinada", lat: 16.99, lon: 82.24, state: "Andhra Pradesh", coast: "east" },
  { name: "Visakhapatnam", lat: 17.69, lon: 83.30, state: "Andhra Pradesh", coast: "east" },
  { name: "Chennai", lat: 13.08, lon: 80.29, state: "Tamil Nadu", coast: "east" },
  { name: "Nagapattinam", lat: 10.77, lon: 79.85, state: "Tamil Nadu", coast: "east" },
  { name: "Rameswaram", lat: 9.29, lon: 79.31, state: "Tamil Nadu", coast: "east" },
  { name: "Paradip", lat: 20.26, lon: 86.67, state: "Odisha", coast: "east" },
  { name: "Digha", lat: 21.62, lon: 87.53, state: "West Bengal", coast: "east" },
  { name: "Port Blair", lat: 11.62, lon: 92.73, state: "Andaman & Nicobar", coast: "east" },
  { name: "Kochi", lat: 9.95, lon: 76.24, state: "Kerala", coast: "west" },
  { name: "Kozhikode", lat: 11.25, lon: 75.75, state: "Kerala", coast: "west" },
  { name: "Mangaluru", lat: 12.86, lon: 74.83, state: "Karnataka", coast: "west" },
  { name: "Ratnagiri", lat: 16.99, lon: 73.30, state: "Maharashtra", coast: "west" },
  { name: "Mumbai", lat: 18.94, lon: 72.83, state: "Maharashtra", coast: "west" },
  { name: "Veraval", lat: 20.90, lon: 70.36, state: "Gujarat", coast: "west" },
];

/** The default working location. Kakinada is the demo's home port. */
export const DEFAULT_HARBOUR = SEED[0];

let cached: Harbour[] | null = null;

export function useHarbours(): Harbour[] {
  const [harbours, setHarbours] = useState<Harbour[]>(cached ?? SEED);

  useEffect(() => {
    if (cached) return;
    let dropped = false;

    getHarbours()
      .then((list) => {
        if (dropped || !list.length) return;
        cached = list;
        setHarbours(list);
      })
      // The seed list still works. A picker that shows three harbours instead of fourteen
      // is a smaller problem than one that shows an error where the harbours should be.
      .catch(() => undefined);

    return () => {
      dropped = true;
    };
  }, []);

  return harbours;
}
