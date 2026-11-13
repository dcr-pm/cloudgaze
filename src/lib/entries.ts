import type { Entry } from "./types";

export const ENTRY_SELECT = "*, entry_edits(count)";

/** Maps a PostgREST row (with the embedded edit count) to an Entry. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toEntry(row: any): Entry {
  const { entry_edits, ...rest } = row;
  return {
    ...rest,
    amount: rest.amount === null || rest.amount === undefined ? null : Number(rest.amount),
    currency: String(rest.currency ?? "USD").trim(),
    edit_count: Number(entry_edits?.[0]?.count ?? 0),
  };
}

export const byNewest = (a: Entry, b: Entry) =>
  b.occurred_at.localeCompare(a.occurred_at) || b.created_at.localeCompare(a.created_at);
