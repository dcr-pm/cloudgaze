"use client";

import { useEffect, useMemo, useState } from "react";
import { fromInputValue, money, toInputValue, when } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Entry, EntryEdit } from "@/lib/types";
import { CloseIcon } from "./icons";
import { fieldClass, primaryButton, quietButton } from "./ui";

const FIELD: Record<string, string> = {
  title: "the title", note: "the note", amount: "the amount", occurred_at: "the time",
  type: "the type", category: "the category", currency: "the currency", receipt_url: "the receipt",
};

/** "changed the amount from $54.99 to $49.99", one phrase per changed field. */
function describe(edit: EntryEdit, currency: string): string[] {
  const show = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return "nothing";
    if (key === "amount") return money(Number(value), currency);
    if (key === "occurred_at") return when(String(value));
    return `“${String(value)}”`;
  };
  if ("deleted_at" in edit.after) {
    return [edit.after.deleted_at ? "removed this entry" : "put this entry back"];
  }
  return Object.keys(edit.after).map((key) =>
    key === "receipt_url"
      ? "changed the receipt"
      : `changed ${FIELD[key] ?? key} from ${show(key, edit.before[key])} to ${show(key, edit.after[key])}`,
  );
}

/** Entry details: who logged it, the full edit history, and editing if allowed. */
export function EntrySheet({
  entry, names, canEdit, onUpdate, onClose,
}: {
  entry: Entry;
  names: Map<string, string>;
  canEdit: boolean;
  onUpdate: (entry: Entry, patch: Partial<Entry>) => Promise<boolean>;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [edits, setEdits] = useState<EntryEdit[] | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [title, setTitle] = useState(entry.title);
  const [amount, setAmount] = useState(entry.amount === null ? "" : String(entry.amount));
  const [time, setTime] = useState(toInputValue(entry.occurred_at));
  const [note, setNote] = useState(entry.note ?? "");
  const [busy, setBusy] = useState(false);

  const name = (id: string) => names.get(id) ?? "A former member";
  const removed = Boolean(entry.deleted_at);

  useEffect(() => {
    let live = true;
    supabase.from("entry_edits").select("*").eq("entry_id", entry.id).order("edited_at", { ascending: false })
      .then(({ data }) => live && setEdits((data ?? []) as EntryEdit[]));
    if (entry.receipt_url) {
      supabase.storage.from("receipts").createSignedUrl(entry.receipt_url, 600)
        .then(({ data }) => live && setReceiptUrl(data?.signedUrl ?? null));
    }
    return () => { live = false; };
  }, [supabase, entry.id, entry.receipt_url, entry.edit_count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch: Partial<Entry> = {};
  if (title.trim() && title.trim() !== entry.title) patch.title = title.trim();
  if ((note.trim() || null) !== entry.note) patch.note = note.trim() || null;
  const iso = fromInputValue(time);
  if (iso && toInputValue(iso) !== toInputValue(entry.occurred_at)) patch.occurred_at = iso;
  if (entry.type === "expense" && amount !== "" && Number(amount) > 0 && Number(amount) !== entry.amount) {
    patch.amount = Math.round(Number(amount) * 100) / 100;
  }
  const dirty = Object.keys(patch).length > 0;

  async function run(change: Partial<Entry>, closeAfter: boolean) {
    setBusy(true);
    const ok = await onUpdate(entry, change);
    setBusy(false);
    if (ok && closeAfter) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30"
      role="dialog" aria-modal aria-label={entry.title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="rise safe-bottom max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card px-5 pt-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium capitalize text-muted">
              {entry.type}{removed && " · removed"}
            </p>
            <h2 className="text-2xl font-semibold leading-tight">{entry.title}</h2>
            <p className="mt-1 text-muted">
              Logged by {name(entry.author_id)} · {when(entry.occurred_at)}
            </p>
          </div>
          <button
            type="button" aria-label="Close" onClick={onClose}
            className="-mr-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-muted active:bg-line"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        {receiptUrl && (
          <a href={receiptUrl} target="_blank" rel="noreferrer" className="mt-4 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receiptUrl} alt="Receipt" className="max-h-64 w-full rounded-2xl object-cover" />
          </a>
        )}

        {canEdit && !removed ? (
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(e) => { e.preventDefault(); if (dirty) void run(patch, true); }}
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted">Title</span>
              <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            {entry.type === "expense" && (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted">Amount ({entry.currency})</span>
                <input
                  className={fieldClass} type="number" inputMode="decimal" min="0.01" step="0.01" required
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted">When</span>
              <input className={fieldClass} type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted">Note</span>
              <textarea className={fieldClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button type="submit" disabled={!dirty || busy} className={primaryButton}>Save changes</button>
            <p className="text-center text-sm text-muted">Changes are shown to everyone in the history below.</p>
          </form>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {entry.amount !== null && (
              <p className="text-3xl font-semibold tabular-nums">{money(entry.amount, entry.currency)}</p>
            )}
            {entry.note && <p className="whitespace-pre-wrap text-lg">{entry.note}</p>}
          </div>
        )}

        <section className="mt-6" aria-label="History">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">History</h3>
          <ol className="mt-2 flex flex-col gap-2.5 text-[15px]">
            {(edits ?? []).map((edit) => (
              <li key={edit.id}>
                <span className="font-medium">{name(edit.editor_id)}</span>{" "}
                {describe(edit, entry.currency).join(", and ")}
                <span className="block text-sm text-muted">{when(edit.edited_at)}</span>
              </li>
            ))}
            <li>
              <span className="font-medium">{name(entry.author_id)}</span> logged this
              <span className="block text-sm text-muted">{when(entry.created_at)}</span>
            </li>
          </ol>
          {edits === null && entry.edit_count > 0 && <p className="mt-2 text-sm text-muted">Loading history…</p>}
        </section>

        {canEdit && (
          <button
            type="button" disabled={busy}
            className={`${quietButton} mt-4 ${removed ? "" : "!text-danger"}`}
            onClick={() => void run({ deleted_at: removed ? null : new Date().toISOString() }, true)}
          >
            {removed ? "Put this entry back" : "Remove entry"}
          </button>
        )}
      </div>
    </div>
  );
}
