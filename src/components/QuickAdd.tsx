"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CURRENCY } from "@/lib/format";
import { downscale } from "@/lib/image";
import { fallbackDraft } from "@/lib/parse/normalize";
import type { ParseContext } from "@/lib/parse/schema";
import type { Draft } from "@/lib/types";
import { useSpeech } from "@/lib/useSpeech";
import { ConfirmCard } from "./ConfirmCard";
import { CameraIcon, MicIcon, SendIcon } from "./icons";

type Phase =
  | { name: "idle" }
  | { name: "parsing"; label: string }
  | { name: "confirm"; drafts: Draft[]; message?: string };

type Receipt = { blob: Blob; previewUrl: string };

/**
 * The always-there way to log something: type it, say it, or snap a receipt.
 * `variant="bar"` is the bottom bar on the timeline; `variant="simple"` is the
 * single huge microphone of simple mode.
 */
export function QuickAdd({
  variant, childId, childName, kids, routines, onSave,
}: {
  variant: "bar" | "simple";
  childId: string;
  childName: string;
  kids: { id: string; name: string }[];
  routines: { id: string; child_id: string; name: string }[];
  onSave: (drafts: Draft[], receipt?: Blob) => void;
}) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const context = useCallback((): ParseContext => ({
    children: kids,
    activeChildId: childId,
    routines,
    now: new Date().toISOString(),
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
    currency: DEFAULT_CURRENCY,
  }), [kids, childId, routines]);

  const ask = useCallback(async (path: string, body: object) => {
    const ctx = context();
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        childId: ctx.activeChildId, now: ctx.now, utcOffsetMinutes: ctx.utcOffsetMinutes, currency: ctx.currency, ...body,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) throw new Error(`parse ${res.status}`);
    return (await res.json()) as { drafts: Draft[]; message?: string };
  }, [context]);

  const submit = useCallback(async (raw: string, source: "text" | "voice") => {
    const note = raw.trim();
    if (!note) return;
    setText("");
    setPhase({ name: "parsing", label: note });
    try {
      const { drafts } = await ask("/api/parse", { text: note, source });
      setPhase({ name: "confirm", drafts });
    } catch {
      // Offline or the parser is down: keep the words, let the person save them.
      setPhase({ name: "confirm", drafts: [fallbackDraft(note, context(), source)] });
    }
  }, [ask, context]);

  const speech = useSpeech({
    onInterim: setText,
    onFinal: (said) => void submit(said, "voice"),
  });

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhase({ name: "parsing", label: "Reading the receipt" });
    try {
      const shot = await downscale(file);
      setReceipt({ blob: shot.blob, previewUrl: shot.previewUrl });
      try {
        const { drafts, message } = await ask("/api/parse-receipt", { image: shot.base64, mediaType: "image/jpeg" });
        setPhase({ name: "confirm", drafts, message });
      } catch {
        const blank = fallbackDraft("Receipt", context(), "receipt");
        setPhase({
          name: "confirm",
          drafts: [{ ...blank, type: "expense", category: "other" }],
          message: "Couldn't read the receipt. You can still fill it in.",
        });
      }
    } catch {
      setPhase({ name: "idle" });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const close = useCallback(() => {
    setPhase({ name: "idle" });
    setReceipt((r) => {
      if (r) URL.revokeObjectURL(r.previewUrl);
      return null;
    });
  }, []);

  // Don't leak the preview if the screen goes away mid-flow.
  useEffect(() => () => { if (receipt) URL.revokeObjectURL(receipt.previewUrl); }, [receipt]);

  const confirm = phase.name === "confirm" && (
    <ConfirmCard
      key={phase.drafts.map((d) => d.id).join()}
      drafts={phase.drafts}
      kids={kids}
      previewUrl={receipt?.previewUrl}
      message={phase.message}
      large={variant === "simple"}
      onDiscard={close}
      onSave={(drafts) => {
        onSave(drafts, receipt?.blob);
        close();
      }}
    />
  );

  if (variant === "simple") {
    const busy = phase.name === "parsing";
    return (
      <section className="flex flex-col items-center gap-5 py-4">
        {speech.supported ? (
          <>
            <button
              type="button" disabled={busy} onClick={speech.toggle}
              aria-label={speech.listening ? "Stop listening" : `Tell KidLog what happened with ${childName}`}
              className={`flex h-48 w-48 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:opacity-60 ${
                speech.listening ? "listening bg-danger" : "bg-brand"
              }`}
            >
              <MicIcon className="h-24 w-24" />
            </button>
            <p className="min-h-[4.5rem] text-center text-3xl font-semibold leading-tight" aria-live="polite">
              {busy ? "Got it…" : speech.listening ? text || "Listening…" : "Tap and talk"}
            </p>
            {speech.error && <p className="text-center text-xl text-danger">{speech.error}</p>}
          </>
        ) : (
          <form
            className="flex w-full flex-col gap-3"
            onSubmit={(e) => { e.preventDefault(); void submit(text, "text"); }}
          >
            <label htmlFor="simple-note" className="text-2xl font-semibold">What happened?</label>
            <input
              id="simple-note" value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
              placeholder={`Took ${childName} to the park`}
              className="w-full rounded-3xl border-2 border-line bg-card px-5 py-5 text-2xl focus:border-brand focus:outline-none"
            />
            <button type="submit" disabled={busy || !text.trim()} className="rounded-3xl bg-brand py-6 text-3xl font-semibold text-white disabled:opacity-50">
              {busy ? "Got it…" : "Log it"}
            </button>
          </form>
        )}
        {confirm}
      </section>
    );
  }

  const parsing = phase.name === "parsing";
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur">
        <div className="safe-bottom mx-auto max-w-md px-3 pt-2.5">
          {parsing && (
            <p className="rise mb-2 flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-2.5 text-brand-ink" aria-live="polite">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <span className="truncate">{phase.label}</span>
            </p>
          )}
          {speech.error && <p className="mb-2 px-2 text-sm text-danger">{speech.error}</p>}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); void submit(text, "text"); }}
          >
            <button
              type="button" aria-label="Add a receipt photo" disabled={parsing}
              onClick={() => fileInput.current?.click()}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-card text-ink shadow-sm ring-1 ring-line active:bg-line disabled:opacity-50"
            >
              <CameraIcon className="h-6 w-6" />
            </button>
            <input
              ref={fileInput} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => void onPhoto(e.target.files?.[0])}
            />
            <input
              aria-label={`Log something for ${childName}`}
              value={text} onChange={(e) => setText(e.target.value)} disabled={parsing}
              placeholder={speech.listening ? "Listening…" : `What happened with ${childName}?`}
              enterKeyHint="send" autoComplete="off"
              className="h-14 min-w-0 flex-1 rounded-full bg-card px-5 shadow-sm ring-1 ring-line placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {text.trim() && !speech.listening ? (
              <button
                type="submit" aria-label="Log it" disabled={parsing}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-sm active:bg-brand-ink disabled:opacity-50"
              >
                <SendIcon className="h-6 w-6" />
              </button>
            ) : speech.supported ? (
              <button
                type="button" onClick={speech.toggle} disabled={parsing}
                aria-label={speech.listening ? "Stop listening" : "Speak"} aria-pressed={speech.listening}
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-sm disabled:opacity-50 ${
                  speech.listening ? "listening bg-danger" : "bg-brand active:bg-brand-ink"
                }`}
              >
                <MicIcon className="h-6 w-6" />
              </button>
            ) : (
              <button
                type="submit" aria-label="Log it" disabled
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-white opacity-40"
              >
                <SendIcon className="h-6 w-6" />
              </button>
            )}
          </form>
        </div>
      </div>
      {confirm}
    </>
  );
}
