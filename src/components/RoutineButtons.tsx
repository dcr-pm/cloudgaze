"use client";

import Link from "next/link";
import { useRef } from "react";
import { clock, firstName, isToday } from "@/lib/format";
import type { Entry, Routine } from "@/lib/types";
import { CheckIcon, PlusIcon } from "./icons";

/** Today's routines as big one-tap buttons. A tap logs it now, by you. */
export function RoutineButtons({
  routines, entries, names, large = false, manageHref, onLog,
}: {
  routines: Routine[];
  entries: Entry[];
  names: Map<string, string>;
  large?: boolean;
  manageHref?: string;
  onLog: (routine: Routine) => void;
}) {
  const lastTap = useRef(new Map<string, number>());
  const weekday = new Date().getDay();
  const today = routines.filter((r) => (r.schedule?.days ?? [0, 1, 2, 3, 4, 5, 6]).includes(weekday));

  if (today.length === 0 && !manageHref) return null;

  function tap(routine: Routine) {
    // Guard against a double tap logging the same routine twice.
    const now = Date.now();
    if (now - (lastTap.current.get(routine.id) ?? 0) < 2500) return;
    lastTap.current.set(routine.id, now);
    onLog(routine);
  }

  return (
    <section aria-label="Today's routines">
      <ul className={large ? "flex flex-col gap-4" : "grid grid-cols-2 gap-2.5"}>
        {today.map((routine) => {
          const done = entries.find(
            (e) => e.routine_id === routine.id && !e.deleted_at && isToday(e.occurred_at),
          );
          const who = done ? firstName(names.get(done.author_id) ?? "Someone") : "";
          return (
            <li key={routine.id}>
              <button
                type="button" onClick={() => tap(routine)}
                className={`flex w-full items-center gap-3 rounded-3xl text-left transition active:scale-[0.97] ${
                  large ? "min-h-28 gap-5 px-7 py-5" : "min-h-[4.5rem] px-3.5 py-3"
                } ${done ? "bg-routine-soft text-routine ring-1 ring-routine/30" : "bg-card text-ink shadow-sm ring-1 ring-line"}`}
              >
                <span
                  aria-hidden
                  className={`flex shrink-0 items-center justify-center rounded-full ${large ? "h-14 w-14" : "h-9 w-9"} ${
                    done ? "bg-routine text-white" : "border-2 border-line"
                  }`}
                >
                  {done && <CheckIcon className={large ? "h-8 w-8" : "h-5 w-5"} />}
                </span>
                <span className="min-w-0">
                  <span className={`block truncate font-semibold ${large ? "text-4xl" : "text-[17px]"}`}>{routine.name}</span>
                  <span className={`block truncate ${large ? "text-xl" : "text-sm"} ${done ? "" : "text-muted"}`}>
                    {done ? `${who} · ${clock(done.occurred_at)}` : routine.schedule?.time ? (large ? `Usually ${shortTime(routine.schedule.time)}` : shortTime(routine.schedule.time)) : "Tap when done"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {manageHref && (
          <li className={today.length % 2 === 0 ? "col-span-2" : ""}>
            <Link
              href={manageHref}
              className="flex min-h-12 h-full w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line px-4 py-3 font-medium text-muted active:bg-line"
            >
              <PlusIcon className="h-5 w-5" />
              {today.length ? "Routines" : "Add a routine like Bedtime"}
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

function shortTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
