"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorNote, fieldClass, primaryButton } from "./ui";

export function JoinCircle({
  token, childName, currentName,
}: { token: string; childName: string; currentName: string }) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    if (name.trim() && name.trim() !== currentName) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", data.user.id);
      }
    }
    const { data: childId, error } = await supabase.rpc("accept_invite", { _token: token });
    if (error || !childId) {
      setError(error?.message ?? "Couldn't join. Please try again.");
      setBusy(false);
      return;
    }
    document.cookie = `kidlog_child=${childId}; path=/; max-age=31536000; samesite=lax`;
    router.replace(`/c/${childId}`);
    router.refresh();
  }

  return (
    <form onSubmit={join} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Your name, as the others will see it</span>
        <input className={fieldClass} required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <ErrorNote>{error}</ErrorNote>
      <button type="submit" disabled={busy || !name.trim()} className={primaryButton}>
        {busy ? "Joining…" : `Join ${childName}'s circle`}
      </button>
    </form>
  );
}
