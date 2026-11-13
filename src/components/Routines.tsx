"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Routine } from "@/lib/types";
import { ErrorNote, fieldClass, primaryButton } from "./ui";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeDays(days: number[]): string {
  const sorted = [...days].sort();
  if (sorted.length === 7) return "Every day";
  if (sorted.join() === "1,2,3,4,5") return "Weekdays";
  if (sorted.join() === "0,6") return "Weekends";
  return sorted.map((d) => SHORT[d]).join(", ");
}

/** The routines that show up as one-tap buttons, and the one action: add one. */
export function Routines({
  childId, routines, canManage,
}: { childId: string; routines: Routine[]; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient().from("routines").insert({
      child_id: childId, name: name.trim(), schedule: { days: [...days].sort() }, sort_order: routines.length + 1,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setName("");
    router.refresh();
  }

  async function archive(routine: Routine) {
    setError("");
    const { error } = await createClient().from("routines")
      .update({ archived_at: new Date().toISOString() }).eq("id", routine.id);
    if (error) setError(error.message);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {routines.length > 0 ? (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-line">
          {routines.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-semibold">{r.name}</p>
                <p className="text-sm text-muted">{describeDays(r.schedule?.days ?? [])}</p>
              </div>
              {canManage && (
                <button
                  type="button" onClick={() => void archive(r)}
                  className="shrink-0 rounded-full px-3 py-2.5 text-sm font-medium text-muted active:bg-line"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">
          Routines are things that happen most days, like Bedtime, Homework or Meds. Each one becomes a
          big button on the timeline: one tap logs it with the time and who did it.
        </p>
      )}

      <ErrorNote>{error}</ErrorNote>

      {canManage ? (
        <form onSubmit={add} className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-line">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">New routine</span>
            <input
              className={fieldClass} placeholder="Bedtime" required maxLength={30}
              value={name} onChange={(e) => setName(e.target.value)}
            />
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-muted">Which days? {describeDays(days)}</legend>
            <div className="flex justify-between gap-1">
              {DAYS.map((label, d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[d]}
                    onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                    className={`h-11 w-11 rounded-full font-semibold ${on ? "bg-ink text-white" : "bg-paper text-muted"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <button type="submit" disabled={busy || !name.trim() || days.length === 0} className={primaryButton}>
            {busy ? "Adding…" : "Add routine"}
          </button>
        </form>
      ) : (
        <p className="px-1 text-muted">Someone with full access can add or remove routines.</p>
      )}
    </div>
  );
}
