"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* The Web Speech API has no bundled TypeScript types. */
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): (new () => Recognition) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Recognition) | undefined;
}

/**
 * Press-to-talk dictation. `onInterim` fires as words arrive; `onFinal` fires
 * once with the whole utterance when the person stops speaking.
 */
export function useSpeech(handlers: {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => setSupported(Boolean(getRecognition())), []);
  useEffect(() => () => recognition.current?.abort(), []);

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    recognition.current?.abort();

    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let transcript = "";

    rec.onresult = (e) => {
      transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ").replace(/\s+/g, " ").trim();
      latest.current.onInterim?.(transcript);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Allow the microphone to talk to KidLog.");
      } else if (e.error !== "aborted" && e.error !== "no-speech") {
        setError("Didn't catch that. Try again.");
      }
    };
    rec.onend = () => {
      setListening(false);
      recognition.current = null;
      if (transcript) latest.current.onFinal(transcript);
    };

    setError("");
    setListening(true);
    recognition.current = rec;
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, []);

  return { supported, listening, error, start, stop, toggle: listening ? stop : start };
}
