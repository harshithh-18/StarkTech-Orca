/**
 * The user's persisted setup: who they are, where they fish, what language they read.
 *
 * Owner: D · Phase: P4
 *
 * Held in localStorage so the console opens where it was left. Nothing here is sensitive —
 * a role, a harbour and a language code — and none of it leaves the browser except the
 * coordinates, which are already sent with every query.
 *
 * ## Why the default location is a harbour, not the device
 *
 * ORCA answers questions about the sea. Anyone opening this indoors and inland is at a
 * point where there genuinely is no marine forecast, so every query correctly returns
 * nothing — and an interface that correctly returns nothing looks broken. Defaulting to a
 * real harbour means the first thing on screen is real data, and the GPS button is right
 * there for someone actually on the water.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_HARBOUR } from "@/hooks/useHarbours";
import type { Language, Location, Profile, Role } from "@/types/orca";

const STORAGE_KEY = "orca.profile.v1";


export const LANGUAGES: { code: Language; label: string; english: string }[] = [
  { code: "en", label: "English", english: "English" },
  { code: "hi", label: "हिन्दी", english: "Hindi" },
  { code: "ta", label: "தமிழ்", english: "Tamil" },
  { code: "te", label: "తెలుగు", english: "Telugu" },
  { code: "ml", label: "മലയാളം", english: "Malayalam" },
  { code: "bn", label: "বাংলা", english: "Bengali" },
  { code: "kn", label: "ಕನ್ನಡ", english: "Kannada" },
  { code: "mr", label: "मराठी", english: "Marathi" },
  { code: "gu", label: "ગુજરાતી", english: "Gujarati" },
  { code: "or", label: "ଓଡ଼ିଆ", english: "Odia" },
];

export const ROLES: { id: Role; label: string; blurb: string; icon: string }[] = [
  {
    id: "fisherman",
    label: "Fisher / boat owner",
    blurb: "Where the fish are, and whether it is safe to go out.",
    icon: "fish",
  },
  {
    id: "authority",
    label: "Coastal authority",
    blurb: "Boundary compliance, hazard advisories, and who to warn.",
    icon: "shield",
  },
  {
    id: "researcher",
    label: "Researcher",
    blurb: "Chlorophyll, sea-surface temperature and productivity trends.",
    icon: "chart",
  },
  {
    id: "operator",
    label: "Maritime operator",
    blurb: "Route planning and sea state along a passage.",
    icon: "route",
  },
];

const DEFAULT_PROFILE: Profile = {
  role: "fisherman",
  language: "en",
  // Detection is the product feature; the picker is the escape hatch. Defaulting to a
  // fixed language would mean a Tamil query got an English answer, which is precisely
  // the behaviour this platform exists to avoid.
  autoLanguage: true,
  location: {
    lat: DEFAULT_HARBOUR.lat,
    lon: DEFAULT_HARBOUR.lon,
    name: DEFAULT_HARBOUR.name,
    source: "harbour",
  },
  onboarded: false,
};

function read(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    // Merged rather than trusted wholesale: a profile written by an older build is
    // missing fields, and a half-populated profile crashes further downstream than the
    // one line it takes to fill the gaps here.
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      location: { ...DEFAULT_PROFILE.location, ...(parsed.location ?? {}) },
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export interface UseProfile {
  profile: Profile;
  setRole(role: Role): void;
  /** `null` restores automatic detection from the query text. */
  setLanguage(language: Language | null): void;
  setLocation(location: Location): void;
  complete(): void;
  /** Reopen the welcome / setup screen, keeping every choice already made. */
  reopenSetup(): void;
  reset(): void;
}

export function useProfile(): UseProfile {
  const [profile, setProfile] = useState<Profile>(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Private browsing, or storage disabled. The app works fine without persistence —
      // it just forgets between visits, which is not worth an error message.
    }
  }, [profile]);

  const setRole = useCallback((role: Role) => setProfile((p) => ({ ...p, role })), []);
  const setLanguage = useCallback(
    (language: Language | null) =>
      setProfile((p) =>
        language === null
          ? { ...p, autoLanguage: true }
          : { ...p, language, autoLanguage: false },
      ),
    [],
  );
  const setLocation = useCallback(
    (location: Location) => setProfile((p) => ({ ...p, location })),
    [],
  );
  const complete = useCallback(() => setProfile((p) => ({ ...p, onboarded: true })), []);
  // Not a reset: the role, harbour and language survive. The welcome screen is also the
  // settings screen, and there was no way back to it once dismissed.
  const reopenSetup = useCallback(() => setProfile((p) => ({ ...p, onboarded: false })), []);
  const reset = useCallback(() => setProfile({ ...DEFAULT_PROFILE }), []);

  return useMemo(
    () => ({ profile, setRole, setLanguage, setLocation, complete, reopenSetup, reset }),
    [profile, setRole, setLanguage, setLocation, complete, reopenSetup, reset],
  );
}
