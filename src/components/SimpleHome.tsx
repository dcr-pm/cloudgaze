"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import type { Child, Entry, Member, Profile, Routine } from "@/lib/types";
import { useTimeline } from "@/lib/useTimeline";
import { ChildSwitcher, rememberChild } from "./ChildSwitcher";
import { Notice } from "./Notice";
import { QuickAdd } from "./QuickAdd";
import { RoutineButtons } from "./RoutineButtons";

/** Simple mode: one huge microphone and today's routines. Nothing else. */
export function SimpleHome({
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
  useEffect(() => rememberChild(child.id), [child.id]);

  const names = useMemo(() => new Map(members.map((m) => [m.user_id, m.display_name])), [members]);
  const kidList = useMemo(() => kids.map((k) => ({ id: k.id, name: k.name })), [kids]);
  const childRoutines = useMemo(() => routines.filter((r) => r.child_id === child.id), [routines, child.id]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-4">
      <header>
        {kids.length > 1 ? (
          <ChildSwitcher kids={kids} activeId={child.id} large canAdd={false} />
        ) : (
          <h1 className="text-4xl font-semibold">{child.name}</h1>
        )}
      </header>

      <QuickAdd
        variant="simple" childId={child.id} childName={child.name}
        kids={kidList} routines={routines}
        onSave={(drafts, receipt) => {
          timeline.saveDrafts(drafts, receipt);
          timeline.say("Saved");
        }}
      />

      <RoutineButtons
        large routines={childRoutines} entries={timeline.entries} names={names}
        onLog={timeline.logRoutine}
      />

      <footer className="mt-auto pt-10 text-center">
        <Link href="/me" className="inline-block rounded-full px-5 py-3 text-lg text-muted underline">
          Settings
        </Link>
      </footer>

      <Notice notice={timeline.notice} onUndo={timeline.undo} raised={false} />
    </div>
  );
}
