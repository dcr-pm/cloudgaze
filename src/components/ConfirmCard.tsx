"use client";

import { useState } from "react";
import { fromInputValue, toInputValue } from "@/lib/format";
import type { Draft, EntryType } from "@/lib/types";
import { CheckIcon, CloseIcon } from "./icons";
import { primaryButton, quietButton } from "./ui";

const TYPE_STYLE: Record<EntryType, string> = {
  activity: "bg-activity-soft text-activity",
  expense: "bg-expense-soft text-expense",
  routine: "bg-routine-soft text-routine",
};

const editable =
  "min-w-0 rounded-lg bg-transparent px-1.5 py-1 -mx-1.5 hover:bg-paper focus:bg-paper focus:outline-none focus:ring-2 focus:ring-brand/40";

/**
 * Shows what KidLog understood. One tap on Save keeps it; every value is a
 * field, so tapping it fixes it in place.
 */
export function ConfirmCard({
  drafts: initial, kids, previewUrl, message, large = false, onSave, onDiscard,
}: {
  drafts: Draft[];
  kids: { id: string; name: string }[];
  previewUrl?: string;
  message?: string;
  large?: boolean;
  onSave: (drafts: Draft[]) => void;
  onDiscard: () => void;
}) {
  const [drafts, setDrafts] = useState(initial);
  const set = (id: string, patch: Partial<Draft>) =>
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const missingAmount = drafts.some((d) => d.type === "expense" && !(d.amount && d.amount > 0));
  const missingTitle = drafts.some((d) => !d.title.trim());
  const label = missingAmount ? "Add the amount to save" : drafts.length > 1 ? `Save ${drafts.length} entries` : "Save";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30" role="dialog" aria-modal aria-label="Check and save">
      <div className="rise safe-bottom max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card px-5 pt-5 shadow-xl">
        {message && <p className="mb-3 rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense">{message}</p>}

        <ul className="flex flex-col gap-3">
          {drafts.map((d) => (
            <li key={d.id} className="rounded-2xl border border-line p-3.5">
              <div className="flex items-center gap-2">
                <select
                  aria-label="Type"
                  className={`${TYPE_STYLE[d.type]} rounded-full px-3 py-1.5 text-sm font-semibold capitalize focus:outline-none`}
                  value={d.type}
                  onChange={(e) => {
                    const type = e.target.value as EntryType;
                    set(d.id, { type, amount: type === "expense" ? d.amount : null, routine_id: type === "routine" ? d.routine_id : null });
                  }}
                >
                  <option value="activity">Activity</option>
                  <option value="expense">Expense</option>
                  <option value="routine">Routine</option>
                </select>
                {kids.length > 1 && (
                  <select
                    aria-label="Child"
                    className="rounded-full bg-paper px-3 py-1.5 text-sm font-medium focus:outline-none"
                    value={d.child_id}
                    onChange={(e) => set(d.id, { child_id: e.target.value, routine_id: null, group_id: null })}
                  >
                    {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                )}
                {drafts.length > 1 && (
                  <button
                    type="button" aria-label={`Don't save ${d.title}`}
                    className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-muted active:bg-line"
                    onClick={() => setDrafts((list) => list.filter((x) => x.id !== d.id))}
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="mt-2 flex items-baseline gap-3">
                <input
                  aria-label="Title"
                  className={`${editable} flex-1 font-semibold ${large ? "text-3xl" : "text-xl"}`}
                  value={d.title}
                  onChange={(e) => set(d.id, { title: e.target.value })}
                />
                {d.type === "expense" && (
                  <label className="flex shrink-0 items-baseline gap-1">
                    <span className="text-sm font-medium text-muted">{d.currency}</span>
                    <input
                      aria-label="Amount" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
                      autoFocus={d.amount === null}
                      className={`${editable} text-right font-semibold tabular-nums ${large ? "w-32 text-3xl" : "w-24 text-xl"} ${d.amount ? "" : "ring-2 ring-expense/60"}`}
                      value={d.amount ?? ""}
                      onChange={(e) => set(d.id, { amount: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </label>
                )}
              </div>

              {!large && (
                <div className="mt-1 flex flex-col gap-1 text-muted">
                  <input
                    aria-label="When" type="datetime-local" className={`${editable} w-fit text-sm`}
                    value={toInputValue(d.occurred_at)}
                    onChange={(e) => {
                      const iso = fromInputValue(e.target.value);
                      if (iso) set(d.id, { occurred_at: iso });
                    }}
                  />
                  <input
                    aria-label="Note" placeholder="Add a note" className={`${editable} text-sm placeholder:text-muted/60`}
                    value={d.note ?? ""}
                    onChange={(e) => set(d.id, { note: e.target.value || null })}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>

        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Receipt photo" className="mt-3 h-24 w-full rounded-2xl object-cover" />
        )}

        <div className="mt-4 flex flex-col gap-1">
          <button
            type="button" autoFocus={!missingAmount}
            disabled={missingAmount || missingTitle || drafts.length === 0}
            className={`${primaryButton} ${large ? "py-6 text-2xl" : ""}`}
            onClick={() => onSave(drafts)}
          >
            {!missingAmount && <CheckIcon className="h-6 w-6" />}
            {label}
          </button>
          <button type="button" className={`${quietButton} ${large ? "text-xl" : ""}`} onClick={onDiscard}>
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
