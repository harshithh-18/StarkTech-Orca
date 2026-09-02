/**
 * Voice input and output.
 *
 * Owner: F · Phase: P3 (stretch)
 *
 * Uses the **browser's native Web Speech API** rather than a server pipeline. Bhashini
 * ASR/TTS remains the documented upgrade path (see `backend/app/i18n/bhashini.py`), but
 * the browser route needs no credentials, no audio upload, and no backend change — which
 * is what makes it shippable today.
 *
 *   mic → SpeechRecognition → agent graph → answer → speechSynthesis → speaker
 *
 * Support is uneven and that is fine: `supported` is false where it is missing and the
 * mic button simply doesn't render. Nothing else depends on it.
 *
 * ⚠️ Chrome's SpeechRecognition streams audio to Google's servers, so dictation needs
 * network even when ORCA is running from mocks. Speech *output* is local and always works.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { Language } from "@/types/orca";

/** ORCA language codes → BCP-47 tags the speech APIs expect. */
const SPEECH_LOCALE: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN",
  ml: "ml-IN",
  bn: "bn-IN",
  kn: "kn-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  or: "or-IN",
};

type RecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseVoice {
  /** Whether this browser can do speech input at all. */
  supported: boolean;
  listening: boolean;
  speaking: boolean;
  error: string | null;
  /** Start dictation in `language`; the transcript arrives via `onTranscript`. */
  listen(language: Language): void;
  stopListening(): void;
  /** Read `text` aloud in `language`. */
  speak(text: string, language: Language): void;
  stopSpeaking(): void;
}

export function useVoice(onTranscript: (text: string) => void): UseVoice {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const supported = recognitionCtor() !== null;

  // Callback kept in a ref so `listen` stays stable across renders.
  const transcriptRef = useRef(onTranscript);
  transcriptRef.current = onTranscript;

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const listen = useCallback((language: Language) => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError("Speech input isn't supported in this browser.");
      return;
    }

    // Cancel any previous session — two recognisers running at once produce duplicates.
    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = SPEECH_LOCALE[language] ?? "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) transcriptRef.current(transcript.trim());
    };

    recognition.onerror = (event) => {
      setListening(false);
      // "aborted" and "no-speech" are ordinary user behaviour, not failures worth
      // shouting about — the user changed their mind or paused too long.
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError(
        event.error === "not-allowed"
          ? "Microphone permission denied."
          : `Speech input failed (${event.error}).`,
      );
    };

    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setError(null);
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string, language: Language) => {
    if (!window.speechSynthesis || !text.trim()) return;

    // Cancel first: queued utterances otherwise stack up across turns and the app keeps
    // talking about an answer the user has moved on from.
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const locale = SPEECH_LOCALE[language] ?? "en-IN";
    utterance.lang = locale;

    // Prefer a voice that actually matches the language; falling back to an English voice
    // reading Telugu text is worse than not speaking at all.
    const voices = window.speechSynthesis.getVoices();
    const match =
      voices.find((v) => v.lang === locale) ??
      voices.find((v) => v.lang.startsWith(locale.split("-")[0]));
    if (match) utterance.voice = match;

    // Slightly slower than default: this is safety information, often heard once.
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, []);

  // Stop talking if the component unmounts — speechSynthesis outlives React otherwise.
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    };
  }, []);

  return { supported, listening, speaking, error, listen, stopListening, speak, stopSpeaking };
}
