"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { InterviewLanguage, VoiceError } from "./types";

// UC-07 Answer by voice (SCRUM-180, 182, 183). Owner: Tài.
// Speech is turned into text by the browser (Web Speech API). The application never
// records or stores the audio; only the edited transcript and its duration are sent.

// The DOM types of TypeScript do not include the Web Speech API, so only the parts we use are declared.
type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; length: number; [index: number]: SpeechAlternative };
type SpeechResultEvent = { resultIndex: number; results: { length: number; [index: number]: SpeechResult } };
type SpeechErrorEvent = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionConstructor = new () => Recognition;

/** Stop by itself after this much silence (UC-07 step 5). */
const SILENCE_MS = 7000;
/** The first words arrive about this long after the Candidate starts speaking. */
const FIRST_RESULT_DELAY_MS = 1000;
/** The answers API accepts at most one hour. */
const MAX_SECONDS = 3600;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * True on Chrome and Edge. Firefox has no speech recognition. Safari exposes the API but
 * works only with Siri dictation turned on and gives poor results, so the plan treats it as
 * unsupported (Plan W7: "On Safari and Firefox hide the button and show typing only").
 */
export function isSpeechSupported(): boolean {
  if (!recognitionConstructor()) return false;
  const ua = navigator.userAgent;
  const safari = /Safari\//.test(ua) && !/(Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|Android)/.test(ua);
  return !safari;
}

const noSubscribe = () => () => {};

/** null while rendering on the server, then true or false in the browser. */
export function useSpeechSupported(): boolean | null {
  return useSyncExternalStore(noSubscribe, isSpeechSupported, () => null);
}

export const speechLang = (language: InterviewLanguage) => (language === "vi" ? "vi-VN" : "en-US");

/** Adds new text after the existing text, with one space between them. */
export function appendTranscript(base: string, added: string): string {
  const head = base.trimEnd();
  const tail = added.trim();
  if (!head) return tail;
  if (!tail) return head;
  return `${head} ${tail}`;
}

function mapError(code: string): VoiceError | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "denied";
    case "audio-capture":
      return "no-mic";
    case "no-speech":
      return "no-speech";
    case "network":
      return "network";
    case "aborted":
      return null; // we stopped it ourselves
    default:
      return "unavailable"; // language-not-supported, bad-grammar, …
  }
}

type Options = {
  language: InterviewLanguage;
  /** Called with the whole box text (earlier text + what was heard so far). */
  onText: (text: string) => void;
};

export function useSpeechInput({ language, onText }: Options) {
  const supported = useSpeechSupported();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<VoiceError | null>(null);

  const recognition = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  // Speaking time of the current answer, summed over every time the microphone was used.
  const spokenMs = useRef(0);

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = useCallback(
    (base: string) => {
      if (recognition.current) return;
      const Ctor = recognitionConstructor();
      if (!Ctor) {
        setError("unavailable");
        return;
      }
      const rec = new Ctor();
      rec.lang = speechLang(language);
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      let finalText = "";
      let interimText = "";
      let failure: VoiceError | null = null;
      let heard = false;
      let firstResultAt: number | null = null;
      let lastResultAt: number | null = null;
      let silence: ReturnType<typeof setTimeout> | null = null;
      const armSilence = () => {
        if (silence) clearTimeout(silence);
        silence = setTimeout(() => rec.stop(), SILENCE_MS);
      };

      rec.onresult = (event) => {
        interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const piece = result[0]?.transcript ?? "";
          if (result.isFinal) finalText = appendTranscript(finalText, piece);
          else interimText = appendTranscript(interimText, piece);
        }
        if (appendTranscript(finalText, interimText)) {
          heard = true;
          lastResultAt = performance.now();
          if (firstResultAt === null) firstResultAt = lastResultAt;
        }
        armSilence();
        onTextRef.current(appendTranscript(base, appendTranscript(finalText, interimText)));
      };

      rec.onerror = (event) => {
        failure = mapError(event.error) ?? failure;
      };

      rec.onend = () => {
        if (silence) clearTimeout(silence);
        recognition.current = null;
        // Keep everything recognised so far, also after a network error (UC-07 AF4).
        onTextRef.current(appendTranscript(base, appendTranscript(finalText, interimText)));
        // Speaking time: from the first to the last recognised words, plus the delay before the
        // first words arrive. Waiting before speaking (or for the permission prompt) and the
        // silence before "Stop" are not counted, so they do not lower the speaking pace.
        if (heard && firstResultAt !== null && lastResultAt !== null) {
          spokenMs.current += lastResultAt - firstResultAt + FIRST_RESULT_DELAY_MS;
        }
        if (!heard && !failure) failure = "no-speech"; // UC-07 AF3: keep the box as it was
        setError(failure);
        setListening(false);
      };

      try {
        rec.start(); // the browser asks for microphone permission the first time (UC-07 step 2)
      } catch {
        setError("unavailable");
        return;
      }
      recognition.current = rec;
      setError(null);
      setListening(true);
    },
    [language],
  );

  // Leaving the page stops the microphone without sending anything.
  useEffect(
    () => () => {
      const rec = recognition.current;
      if (!rec) return;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.abort();
      recognition.current = null;
    },
    [],
  );

  /** Seconds spoken for the current answer (one decimal), or null when the microphone was not used. */
  const spokenSeconds = useCallback((): number | null => {
    if (spokenMs.current <= 0) return null;
    return Math.min(MAX_SECONDS, Math.round(spokenMs.current / 100) / 10);
  }, []);

  /** Starts a new answer: forget the speaking time and any old message. */
  const reset = useCallback(() => {
    spokenMs.current = 0;
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { supported, listening, error, start, stop, spokenSeconds, reset, clearError };
}
