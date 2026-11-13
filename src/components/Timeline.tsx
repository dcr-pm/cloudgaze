"use client";

import { clock, dayLabel, firstName, money } from "@/lib/format";
import type { Entry, EntryType } from "@/lib/types";
import { CheckIcon, ReceiptIcon } from "./icons";

const BADGE: Record<EntryType, string> = {
  activity: "bg-activity-soft text-activity",
  expense: "bg-expense-soft text-expense",
  routine: "bg-routine-soft text-routine",
};

function TypeBadge({ type }: { type: EntryType }) {
  return (
    <span aria-hidden className={`${BADGE[type]} flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl`}>
      {type === "routine" ? (
        <CheckIcon className="h-5 w-5" />
      ) : type === "expense" ? (
        <span className="text-lg font-bold">$</span>
      ) : (
        <span className="h-2.5 w-2.5 rounded-full bg-current" />
      )}
    </span>
  );
}

/** Reverse-chronological feed, grouped by day. */
export function Timeline({
  entries, names, onOpen, onRetry,
}: {
  entries: Entry[];
  names: Map<string, string>;
  onOpen: (entry: Entry) => void;
  onRetry: (entry: Entry) => void;
}) {
  const days: { label: string; items: Entry[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(entry.occurred_at);
    if (days.at(-1)?.label === label) days.at(-1)!.items.push(entry);
    else days.push({ label, items: [entry] });
  }

  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => (
        <section key={day.label}>
          <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-muted">{day.label}</h2>
          <ul className="overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-line">
            {day.items.map((entry) => {
              const author = firstName(names.get(entry.author_id) ?? "Former member");
              const removed = Boolean(entry.deleted_at);
              return (
                <li key={entry.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => (entry.failed ? onRetry(entry) : onOpen(entry))}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-paper ${
                      entry.pending || removed ? "opacity-60" : ""
                    }`}
                  >
                    <TypeBadge type={entry.type} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[17px] font-semibold ${removed ? "line-through" : ""}`}>
                        {entry.title}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {entry.failed ? (
                          <span className="font-medium text-danger">Not saved. Tap to try again</span>
                        ) : (
                          <>
                            {author} · {clock(entry.occurred_at)}
                            {entry.pending && " · Saving…"}
                            {removed ? " · removed" : entry.edit_count > 0 && " · edited"}
                          </>
                        )}
                      </span>
                    </span>
                    {entry.receipt_url && <ReceiptIcon className="h-5 w-5 shrink-0 text-muted" />}
                    {entry.amount !== null && (
                      <span className={`shrink-0 text-[17px] font-semibold tabular-nums ${removed ? "line-through" : ""}`}>
                        {money(entry.amount, entry.currency)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
