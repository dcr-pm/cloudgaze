"use client";

import Link from "next/link";
import type { Child } from "@/lib/types";
import { PlusIcon } from "./icons";
import { Avatar } from "./ui";

export function rememberChild(id: string) {
  document.cookie = `kidlog_child=${id}; path=/; max-age=31536000; samesite=lax`;
}

/** One tap to move between children. */
export function ChildSwitcher({
  kids, activeId, large = false, canAdd = true,
}: { kids: Child[]; activeId: string; large?: boolean; canAdd?: boolean }) {
  return (
    <nav aria-label="Children" className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 py-1">
      {kids.map((kid) => {
        const active = kid.id === activeId;
        return (
          <Link
            key={kid.id} href={`/c/${kid.id}`} prefetch aria-current={active ? "page" : undefined}
            onClick={() => rememberChild(kid.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 font-semibold transition ${
              large ? "text-2xl" : "text-lg"
            } ${active ? "bg-card shadow-sm ring-1 ring-line" : "text-muted active:bg-line"}`}
          >
            <Avatar name={kid.name} src={kid.photo_url} active={active} size={large ? "lg" : "md"} />
            {kid.name}
          </Link>
        );
      })}
      {canAdd && (
        <Link
          href="/welcome" aria-label="Add a child"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-line"
        >
          <PlusIcon className="h-5 w-5" />
        </Link>
      )}
    </nav>
  );
}
