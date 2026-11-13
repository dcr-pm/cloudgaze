"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { firstName } from "@/lib/format";
import { can, type Child, type Draft, type Entry, type EntryType, type Member, type Profile, type Routine } from "@/lib/types";
import { useTimeline } from "@/lib/useTimeline";
import { ChildSwitcher, rememberChild } from "./ChildSwitcher";
import { EntrySheet } from "./EntrySheet";
import { PeopleIcon } from "./icons";
import { Notice } from "./Notice";
import { QuickAdd } from "./QuickAdd";
import { RoutineButtons } from "./RoutineButtons";
import { Timeline } from "./Timeline";
import { Avatar } from "./ui";

const TYPES: { value: EntryType | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "activity", label: "Activities" },
  { value: "expense", label: "Expenses" },
  { value: "routine", label: "Routines" },
];

const chip = (on: boolean) =>
  `shrink-0 rounded-full px-4 py-2.5 text-[15px] font-medium transition ${
    on ? "bg-ink text-white" : "bg-card text-ink ring-1 ring-line active:bg-line"
  }`;

/**
 * Removed entries stay in the feed, struck through, so nothing vanishes
 * silently. The exception is a slip undone within two minutes of logging it:
 * nobody acted on it, so it would only be clutter. Its history is still kept.
 */
const wasUndone = (e: Entry) =>
  e.deleted_at !== null &&
  new Date(e.deleted_at).getTime() - new Date(e.created_at).getTime() < 120_000;

/** Home: the child's timeline, today's routines, and the quick-add bar. */
export function Home({
  profile, kids, child, members, routines, initialEntries,
}: {
  profile: Profile;
  kids: Child[];
  child: Child;
  members: Member[];
  routines: Routine[];
  initialEntries: Entry[];
}) {
  const timeline = useTimeline(child.id, profile.id, initialEntries);
  const [type, setType] = useState<EntryType | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => rememberChild(child.id), [child.id]);

  const names = useMemo(() => new Map(members.map((m) => [m.user_id, m.display_name])), [members]);
  const me = members.find((m) => m.user_id === profile.id);
  const isFull = can(me?.permission, "full");
  const kidList = useMemo(() => kids.map((k) => ({ id: k.id, name: k.name })), [kids]);
  const childRoutines = useMemo(() => routines.filter((r) => r.child_id === child.id), [routines, child.id]);

  const visible = timeline.entries.filter(
    (e) => !wasUndone(e) && (!type || e.type === type) && (!person || e.author_id === person),
  );
  const open = openId ? timeline.entries.find((e) => e.id === openId) : undefined;

  function save(drafts: Draft[], receipt?: Blob) {
    timeline.saveDrafts(drafts, receipt);
    const elsewhere = drafts.find((d) => d.child_id !== child.id);
    if (elsewhere) {
      const other = kids.find((k) => k.id === elsewhere.child_id);
      timeline.say(`Saved to ${other?.name ?? "the other"}'s timeline`);
    }
  }

  return (
    <>
      <div className="mx-auto min-h-dvh max-w-md px-4 pb-36">
        <header className="sticky top-0 z-20 -mx-4 flex items-center gap-1 bg-paper/95 px-4 pb-2 pt-3 backdrop-blur">
          <ChildSwitcher kids={kids} activeId={child.id} />
          <Link
            href={`/c/${child.id}/circle`} aria-label={`${child.name}'s circle`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink active:bg-line"
          >
            <PeopleIcon className="h-6 w-6" />
          </Link>
          <Link href="/me" aria-label="You" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full active:bg-line">
            <Avatar name={profile.display_name} />
          </Link>
        </header>

        <div className="mt-2">
          <RoutineButtons
            routines={childRoutines} entries={timeline.entries} names={names}
            manageHref={isFull ? `/c/${child.id}/routines` : undefined}
            onLog={timeline.logRoutine}
          />
        </div>

        <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter the timeline">
          {TYPES.map((t) => (
            <button key={t.label} type="button" aria-pressed={type === t.value} className={chip(type === t.value)} onClick={() => setType(t.value)}>
              {t.label}
            </button>
          ))}
          {members.length > 1 && <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-line" />}
          {members.length > 1 &&
            members.map((m) => (
              <button
                key={m.user_id} type="button" aria-pressed={person === m.user_id}
                className={chip(person === m.user_id)}
                onClick={() => setPerson(person === m.user_id ? null : m.user_id)}
              >
                {m.user_id === profile.id ? "Me" : firstName(m.display_name)}
              </button>
            ))}
        </div>

        <main className="mt-4">
          {visible.length > 0 ? (
            <Timeline entries={visible} names={names} onOpen={(e) => setOpenId(e.id)} onRetry={timeline.retry} />
          ) : timeline.entries.some((e) => !wasUndone(e)) ? (
            <p className="px-2 py-10 text-center text-muted">Nothing matches that filter.</p>
          ) : (
            <div className="px-2 py-10 text-center">
              <p className="text-xl font-semibold">Nothing logged for {child.name} yet</p>
              <p className="mt-2 text-muted">
                Type or say something like “Took {child.name} to swimming, paid $40” in the bar below.
              </p>
            </div>
          )}
        </main>
      </div>

      <Notice notice={timeline.notice} onUndo={timeline.undo} />

      <QuickAdd
        variant="bar" childId={child.id} childName={child.name}
        kids={kidList} routines={routines} onSave={save}
      />

      {open && (
        <EntrySheet
          key={open.id} entry={open} names={names}
          canEdit={!open.pending && !open.failed && (open.author_id === profile.id || isFull)}
          onUpdate={timeline.update} onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
