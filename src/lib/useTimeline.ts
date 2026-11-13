"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ENTRY_SELECT, byNewest, toEntry } from "./entries";
import { createClient } from "./supabase/client";
import type { Draft, Entry, Routine } from "./types";

type Patch = Partial<Pick<Entry, "type" | "title" | "note" | "occurred_at" | "amount" | "category" | "deleted_at">>;

/** The database columns of an entry, without client-only fields. */
function toRow(e: Entry) {
  return {
    id: e.id, child_id: e.child_id, author_id: e.author_id, type: e.type, title: e.title,
    note: e.note, occurred_at: e.occurred_at, amount: e.amount, currency: e.currency,
    category: e.category, receipt_url: e.receipt_url, routine_id: e.routine_id,
    group_id: e.group_id, source: e.source,
  };
}

/**
 * The entries of one child, kept in sync with the server. Writes are
 * optimistic: the entry shows up at once and is marked if saving fails.
 */
export function useTimeline(childId: string, userId: string, initial: Entry[]) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Entry[]>(initial);
  const [notice, setNotice] = useState<{ text: string; undoId?: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Inserts still on their way, so an edit or undo can wait for its entry.
  const inflight = useRef(new Map<string, Promise<void>>());

  const say = useCallback((text: string, undoId?: string) => {
    clearTimeout(noticeTimer.current);
    setNotice({ text, undoId });
    noticeTimer.current = setTimeout(() => setNotice(null), undoId ? 6000 : 4000);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("entries").select(ENTRY_SELECT).eq("child_id", childId)
      .order("occurred_at", { ascending: false }).limit(200);
    if (!data) return;
    const fresh = data.map(toEntry);
    const known = new Set(fresh.map((e) => e.id));
    // Keep entries that are still on their way to the server.
    setEntries((prev) => [...prev.filter((e) => (e.pending || e.failed) && !known.has(e.id)), ...fresh].sort(byNewest));
  }, [supabase, childId]);

  // Other people's entries arrive live; also catch up when the app is reopened.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 300);
    };
    const channel = supabase
      .channel(`entries-${childId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries", filter: `child_id=eq.${childId}` }, soon)
      .subscribe();
    const onVisible = () => document.visibilityState === "visible" && soon();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [supabase, childId, refresh]);

  const patchLocal = useCallback((id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)).sort(byNewest));
  }, []);

  const insert = useCallback(
    (list: Entry[], receipt?: Blob) => {
      const run = async () => {
      for (const entry of list) {
        let row = toRow(entry);
        if (receipt && entry.receipt_url) {
          const up = await supabase.storage.from("receipts")
            .upload(entry.receipt_url, receipt, { contentType: "image/jpeg", upsert: false });
          // A failed photo upload shouldn't lose the expense itself.
          if (up.error && !/exists/i.test(up.error.message)) {
            row = { ...row, receipt_url: null };
            patchLocal(entry.id, { receipt_url: null });
          }
        }
        const { error } = await supabase.from("entries").insert(row);
        const duplicate = error?.code === "23505"; // already saved by an earlier try
        patchLocal(entry.id, { pending: false, failed: Boolean(error) && !duplicate });
        if (error && !duplicate) say("Couldn't save. Tap the entry to try again.");
      }
      };
      const job = run().finally(() => {
        for (const e of list) if (inflight.current.get(e.id) === job) inflight.current.delete(e.id);
      });
      for (const e of list) inflight.current.set(e.id, job);
    },
    [supabase, patchLocal, say],
  );

  /** Saves confirmed drafts. Returns immediately; entries appear at once. */
  const saveDrafts = useCallback(
    (drafts: Draft[], receipt?: Blob) => {
      const now = new Date().toISOString();
      const list: Entry[] = drafts.map((d) => ({
        id: d.id, child_id: d.child_id, author_id: userId, type: d.type, title: d.title.trim(),
        note: d.note?.trim() || null, occurred_at: d.occurred_at,
        amount: d.type === "expense" ? d.amount : null, currency: d.currency, category: d.category,
        receipt_url: receipt && d.type === "expense" ? `${d.child_id}/${d.id}.jpg` : null,
        routine_id: d.type === "routine" ? d.routine_id : null, group_id: d.group_id, source: d.source,
        deleted_at: null, created_at: now, edit_count: 0, pending: true,
      }));
      setEntries((prev) => [...list.filter((e) => e.child_id === childId), ...prev].sort(byNewest));
      void insert(list, receipt);
      return list;
    },
    [childId, userId, insert],
  );

  const retry = useCallback(
    (entry: Entry) => {
      patchLocal(entry.id, { pending: true, failed: false });
      void insert([entry]);
    },
    [insert, patchLocal],
  );

  /** One-tap routine check-off: logged now, by you. */
  const logRoutine = useCallback(
    (routine: Routine) => {
      const [entry] = saveDrafts([{
        id: crypto.randomUUID(), child_id: routine.child_id, type: "routine", title: routine.name,
        note: null, amount: null, currency: "USD", category: null, occurred_at: new Date().toISOString(),
        routine_id: routine.id, group_id: null, source: "routine",
      }]);
      say(`${routine.name} logged`, entry.id);
    },
    [saveDrafts, say],
  );

  /** Edits an entry. The database records the change in its history. */
  const update = useCallback(
    async (entry: Entry, patch: Patch) => {
      patchLocal(entry.id, { ...patch, edit_count: entry.edit_count + 1 });
      await inflight.current.get(entry.id);
      // RLS turns a disallowed update into "0 rows", not an error, so ask for the row back.
      const { data, error } = await supabase.from("entries").update(patch).eq("id", entry.id).select("id");
      if (error || !data?.length) {
        patchLocal(entry.id, entry);
        say("Couldn't save that change.");
        return false;
      }
      return true;
    },
    [supabase, patchLocal, say],
  );

  const remove = useCallback(
    (entry: Entry) => update(entry, { deleted_at: new Date().toISOString() }),
    [update],
  );

  const undo = useCallback(
    async (id: string) => {
      setNotice(null);
      const entry = entries.find((e) => e.id === id);
      if (entry) await remove(entry);
    },
    [entries, remove],
  );

  return { entries, notice, say, saveDrafts, retry, logRoutine, update, remove, undo, dismissNotice: () => setNotice(null) };
}
