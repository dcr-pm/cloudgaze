"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PERMISSION_HELP, PERMISSION_LABEL, ROLE_LABEL, can,
  type Member, type MemberPermission, type MemberRole,
} from "@/lib/types";
import { Avatar, ErrorNote, primaryButton, quietButton } from "./ui";

const ROLES: MemberRole[] = ["parent", "grandparent", "caregiver"];
const PERMISSIONS: MemberPermission[] = ["log_only", "view_expenses", "full"];
// A sensible starting permission for each role; the inviter can change it.
const DEFAULT_PERMISSION: Record<MemberRole, MemberPermission> = {
  parent: "full", grandparent: "log_only", caregiver: "log_only",
};

/** Who is in the circle, and the one action: invite someone by link. */
export function Circle({
  childId, childName, members, meId,
}: { childId: string; childName: string; members: Member[]; meId: string }) {
  const router = useRouter();
  const me = members.find((m) => m.user_id === meId);
  const isFull = can(me?.permission, "full");

  const [inviting, setInviting] = useState(false);
  const [role, setRole] = useState<MemberRole>("grandparent");
  const [permission, setPermission] = useState<MemberPermission>("log_only");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createLink() {
    setBusy(true);
    setError("");
    const { data, error } = await createClient()
      .from("invites")
      .insert({ child_id: childId, role, permission, created_by: meId })
      .select("token")
      .single();
    setBusy(false);
    if (error || !data) return setError(error?.message ?? "Couldn't create the link.");
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    setLink(`${origin}/invite/${data.token}`);
  }

  async function share() {
    const text = `Join ${childName}'s circle on KidLog`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "KidLog", text, url: link });
        return;
      } catch {
        /* cancelled: fall through to copy */
      }
    }
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  async function change(member: Member, next: MemberPermission) {
    setError("");
    const { error } = await createClient().from("circle_members")
      .update({ permission: next }).eq("child_id", childId).eq("user_id", member.user_id);
    if (error) setError(error.message);
    router.refresh();
  }

  async function remove(member: Member) {
    const self = member.user_id === meId;
    if (!window.confirm(self ? `Leave ${childName}'s circle?` : `Remove ${member.display_name} from the circle?`)) return;
    setError("");
    const { error } = await createClient().from("circle_members")
      .delete().eq("child_id", childId).eq("user_id", member.user_id);
    if (error) return setError(error.message);
    if (self) router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-line">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0">
            <Avatar name={m.display_name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold">
                {m.display_name}{m.user_id === meId && <span className="font-normal text-muted"> (you)</span>}
              </p>
              {isFull && m.user_id !== meId ? (
                <select
                  aria-label={`What ${m.display_name} can do`}
                  className="-ml-1 max-w-full rounded-lg bg-transparent py-1 text-sm text-muted"
                  value={m.permission}
                  onChange={(e) => void change(m, e.target.value as MemberPermission)}
                >
                  {PERMISSIONS.map((p) => (
                    <option key={p} value={p}>{ROLE_LABEL[m.role]} · {PERMISSION_LABEL[p]}</option>
                  ))}
                </select>
              ) : (
                <p className="truncate text-sm text-muted">{ROLE_LABEL[m.role]} · {PERMISSION_LABEL[m.permission]}</p>
              )}
            </div>
            {(isFull || m.user_id === meId) && members.length > 1 && (
              <button
                type="button" onClick={() => void remove(m)}
                className="shrink-0 rounded-full px-3 py-2.5 text-sm font-medium text-muted active:bg-line"
              >
                {m.user_id === meId ? "Leave" : "Remove"}
              </button>
            )}
          </li>
        ))}
      </ul>

      <ErrorNote>{error}</ErrorNote>

      {!isFull ? (
        <p className="px-1 text-muted">Ask someone with full access to invite more people.</p>
      ) : !inviting ? (
        <button type="button" className={primaryButton} onClick={() => setInviting(true)}>
          Invite someone
        </button>
      ) : link ? (
        <div className="rise flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-line">
          <p className="text-lg font-semibold">Send this link to the {ROLE_LABEL[role].toLowerCase()}</p>
          <p className="break-all rounded-xl bg-paper px-3 py-2.5 text-sm text-muted">{link}</p>
          <button type="button" className={primaryButton} onClick={() => void share()}>
            {copied ? "Copied" : "Share link"}
          </button>
          <p className="text-center text-sm text-muted">Works once and expires in 7 days.</p>
          <button
            type="button" className={quietButton}
            onClick={() => { setLink(""); setCopied(false); setInviting(false); }}
          >
            Done
          </button>
        </div>
      ) : (
        <div className="rise flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-line">
          <fieldset>
            <legend className="mb-2 font-semibold">Who are they?</legend>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r} type="button" aria-pressed={role === r}
                  onClick={() => { setRole(r); setPermission(DEFAULT_PERMISSION[r]); }}
                  className={`rounded-2xl px-1 py-3.5 text-sm font-medium ${
                    role === r ? "bg-ink text-white" : "bg-paper text-ink active:bg-line"
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-semibold">What can they do?</legend>
            <div className="flex flex-col gap-2">
              {PERMISSIONS.map((p) => (
                <label
                  key={p}
                  className={`flex cursor-pointer gap-3 rounded-2xl p-3.5 ring-1 ${
                    permission === p ? "bg-brand-soft ring-brand" : "ring-line"
                  }`}
                >
                  <input
                    type="radio" name="permission" className="mt-1 h-5 w-5 accent-brand"
                    checked={permission === p} onChange={() => setPermission(p)}
                  />
                  <span>
                    <span className="block font-semibold">{PERMISSION_LABEL[p]}</span>
                    <span className="block text-sm text-muted">{PERMISSION_HELP[p]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="button" disabled={busy} className={primaryButton} onClick={() => void createLink()}>
            {busy ? "Creating…" : "Create invite link"}
          </button>
          <button type="button" className={quietButton} onClick={() => setInviting(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
