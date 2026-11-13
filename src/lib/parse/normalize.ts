import type { Draft, EntrySource, EntryType } from "@/lib/types";
import { CATEGORIES, type ParseContext, type ParsedReceipt, type ParsedText } from "./schema";
import { localToInstant } from "./time";

const MAX_ENTRIES = 4;
const MAX_TITLE = 80;

const newId = () => crypto.randomUUID();

function cleanTitle(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE).trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

function cleanAmount(raw: number | null | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw * 100) / 100;
}

function cleanCurrency(raw: string | null | undefined, fallback: string): string {
  const c = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : fallback;
}

function cleanCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = raw.trim().toLowerCase();
  return (CATEGORIES as readonly string[]).includes(c) ? c : "other";
}

/** Matches a spoken or typed name to one of the user's children. */
export function matchChild(name: string | null | undefined, ctx: ParseContext): string {
  const n = (name ?? "").trim().toLowerCase();
  if (n) {
    const exact = ctx.children.find((c) => c.name.toLowerCase() === n);
    if (exact) return exact.id;
    const partial = ctx.children.filter(
      (c) => c.name.toLowerCase().startsWith(n) || n.startsWith(c.name.toLowerCase()),
    );
    if (partial.length === 1) return partial[0].id;
  }
  return ctx.activeChildId;
}

function matchRoutine(title: string, childId: string, ctx: ParseContext) {
  const t = title.toLowerCase();
  return ctx.routines.find((r) => r.child_id === childId && r.name.toLowerCase() === t)
    ?? ctx.routines.find((r) => r.child_id === childId && t.includes(r.name.toLowerCase()));
}

/** A plain activity built from the raw text, for when parsing isn't available. */
export function fallbackDraft(text: string, ctx: ParseContext, source: EntrySource): Draft {
  return {
    id: newId(),
    child_id: ctx.activeChildId,
    type: "activity",
    title: cleanTitle(text) || "Note",
    note: text.trim().length > MAX_TITLE ? text.trim() : null,
    amount: null,
    currency: ctx.currency,
    category: null,
    occurred_at: ctx.now,
    routine_id: null,
    group_id: null,
    source,
  };
}

/**
 * Turns Claude's output into drafts the app can save as-is. Guarantees:
 * only expenses carry an amount, every draft has a real child and time,
 * and entries from one sentence about one child share a group id.
 */
export function normalizeText(parsed: ParsedText, ctx: ParseContext, source: EntrySource): Draft[] {
  const drafts: Draft[] = [];

  for (const raw of parsed.entries) {
    const title = cleanTitle(raw.title ?? "");
    if (!title) continue;

    const child_id = matchChild(raw.child_name, ctx);
    const amount = cleanAmount(raw.amount);
    const base = {
      child_id,
      title,
      note: raw.note?.trim() || null,
      currency: cleanCurrency(raw.currency, ctx.currency),
      category: cleanCategory(raw.category),
      occurred_at: localToInstant(raw.local_time, ctx.utcOffsetMinutes) ?? ctx.now,
      group_id: null,
      source,
    };

    let type: EntryType = raw.type;
    let routine_id: string | null = null;
    if (type === "routine") {
      const routine = matchRoutine(title, child_id, ctx);
      routine_id = routine?.id ?? null;
      if (routine) base.title = routine.name;
    }

    if (type === "expense") {
      // An expense without a readable amount stays an expense; the confirm
      // card asks for the amount before it can be saved.
      drafts.push({ ...base, id: newId(), type, amount, routine_id: null });
    } else {
      drafts.push({ ...base, id: newId(), type, amount: null, routine_id });
      // "Swimming, $40" returned as a single activity: split the money out.
      if (amount !== null) {
        drafts.push({ ...base, id: newId(), type: "expense", amount, note: null, routine_id: null });
      }
    }
  }

  const kept = drafts.slice(0, MAX_ENTRIES);

  // Link entries that came from the same sentence about the same child.
  const byChild = new Map<string, Draft[]>();
  for (const d of kept) byChild.set(d.child_id, [...(byChild.get(d.child_id) ?? []), d]);
  for (const group of byChild.values()) {
    if (group.length > 1) {
      const group_id = newId();
      for (const d of group) d.group_id = group_id;
    }
  }
  return kept;
}

/** Turns a parsed receipt into a single expense draft. */
export function normalizeReceipt(parsed: ParsedReceipt, ctx: ParseContext): Draft {
  const dated = localToInstant(parsed.date, ctx.utcOffsetMinutes);
  // A receipt dated today (or in the future, i.e. misread) is logged as now.
  const now = new Date(ctx.now).getTime();
  const sameDay = dated !== null && Math.abs(new Date(dated).getTime() - now) < 12 * 3_600_000;
  const occurred_at = dated === null || sameDay || new Date(dated).getTime() > now ? ctx.now : dated;

  return {
    id: newId(),
    child_id: ctx.activeChildId,
    type: "expense",
    title: cleanTitle(parsed.merchant ?? "") || "Receipt",
    note: parsed.summary?.trim() || null,
    amount: cleanAmount(parsed.amount),
    currency: cleanCurrency(parsed.currency, ctx.currency),
    category: cleanCategory(parsed.category) ?? "other",
    occurred_at,
    routine_id: null,
    group_id: null,
    source: "receipt",
  };
}
