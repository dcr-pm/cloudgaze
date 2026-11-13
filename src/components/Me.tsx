"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { ErrorNote, fieldClass, quietButton } from "./ui";

/** Your name, simple mode, sign out. That's all the settings there are. */
export function Me({ profile, email }: { profile: Profile; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(profile.display_name);
  const [simple, setSimple] = useState(profile.simple_mode);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save(patch: Partial<Pick<Profile, "display_name" | "simple_mode">>) {
    setError("");
    const { error } = await createClient().from("profiles").update(patch).eq("id", profile.id);
    if (error) {
      setError(error.message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function saveName() {
    const next = name.trim();
    if (!next || next === profile.display_name) return;
    if (await save({ display_name: next })) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function toggleSimple() {
    const next = !simple;
    setSimple(next);
    if (!(await save({ simple_mode: next }))) setSimple(!next);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">
          Your name {saved && <span className="font-normal text-routine">· saved</span>}
        </span>
        <input
          className={fieldClass} value={name} enterKeyHint="done"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <span className="text-sm text-muted">Shown next to everything you log. Signed in as {email}.</span>
      </label>

      <button
        type="button" role="switch" aria-checked={simple} onClick={() => void toggleSimple()}
        className="flex items-center gap-4 rounded-3xl bg-card p-5 text-left shadow-sm ring-1 ring-line active:bg-paper"
      >
        <span className="flex-1">
          <span className="block text-lg font-semibold">Simple mode</span>
          <span className="block text-muted">
            Shows only a big microphone and the routine buttons, in very large type.
          </span>
        </span>
        <span aria-hidden className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition ${simple ? "bg-brand" : "bg-line"}`}>
          <span className={`h-6 w-6 rounded-full bg-white shadow transition ${simple ? "translate-x-6" : ""}`} />
        </span>
      </button>

      <ErrorNote>{error}</ErrorNote>

      <button type="button" className={quietButton} onClick={() => void signOut()}>Sign out</button>
    </div>
  );
}
