/**
 * Dark mode.
 *
 * Owner: D · Phase: P3
 *
 * Three states, not two: `light`, `dark`, and `system` (follow the OS). Defaulting to
 * the OS is right for a real user; letting them pin it is right for a demo, where the
 * presenter knows whether the room and projector suit a light or dark screen.
 *
 * The choice is applied by toggling a `dark` class on <html> (Tailwind's class strategy)
 * and persisted to localStorage. A blocking script in index.html applies it before first
 * paint so there is no white flash on load.
 */

import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "orca-theme";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

export function readStoredTheme(): ThemeChoice {
  if (typeof localStorage === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** Add or remove the `dark` class on <html>. Exported so the pre-paint script can share it. */
export function applyTheme(choice: ThemeChoice): boolean {
  const isDark = choice === "dark" || (choice === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
  return isDark;
}

export interface UseTheme {
  choice: ThemeChoice;
  isDark: boolean;
  setChoice(next: ThemeChoice): void;
  /** Cycle light → dark → system, for a single-button toggle. */
  cycle(): void;
}

export function useTheme(): UseTheme {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStoredTheme);
  const [isDark, setIsDark] = useState<boolean>(() => applyTheme(readStoredTheme()));

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing blocks localStorage; the theme still applies for this session.
    }
    setIsDark(applyTheme(next));
  }, []);

  const cycle = useCallback(() => {
    setChoice(choice === "light" ? "dark" : choice === "dark" ? "system" : "light");
  }, [choice, setChoice]);

  // While on `system`, follow the OS if it changes mid-session.
  useEffect(() => {
    if (choice !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setIsDark(applyTheme("system"));
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [choice]);

  return { choice, isDark, setChoice, cycle };
}
