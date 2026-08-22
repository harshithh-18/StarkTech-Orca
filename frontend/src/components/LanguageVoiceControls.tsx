/**
 * Language picker and voice controls.
 *
 * Owner: F (with D) · Phase: P2 (language) / P3 (voice)
 *
 * Language is normally auto-detected from what the user types — the picker is an override
 * and a discoverability cue, not the primary path. Seeing their own language listed is
 * what tells a first-time user they can type in it.
 */

import type { Language } from "@/types/orca";

interface Props {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
}

export default function LanguageVoiceControls(_props: Props) {
  // TODO(P2, F): language picker with each name in its OWN script (தமிழ், తెలుగు,
  //              മലയാളം, বাংলা) — never a list of English names
  // TODO(P2, D): "Auto-detect" as the default option
  // TODO(P3, F): mic button → Bhashini ASR; speaker toggle → TTS on the answer
  // TODO(P3, F): show a recording indicator; silence with no feedback reads as broken
  return <div>{/* TODO(P2, F) */}</div>;
}
