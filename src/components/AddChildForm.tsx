"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { downscale } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { ErrorNote, fieldClass, primaryButton } from "./ui";

export function AddChildForm({ profileName, askName }: { profileName: string; askName: boolean }) {
  const router = useRouter();
  const [yourName, setYourName] = useState(profileName);
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();

    if (askName && yourName.trim() && yourName.trim() !== profileName) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from("profiles").update({ display_name: yourName.trim() }).eq("id", data.user.id);
      }
    }

    const { data: childId, error } = await supabase.rpc("create_child", {
      _name: name.trim(),
      _birthdate: birthdate || null,
    });
    if (error || !childId) {
      setError(error?.message ?? "Couldn't add the child. Please try again.");
      setBusy(false);
      return;
    }

    // The photo is optional; if it fails the child is still created.
    if (photo) {
      try {
        const { blob } = await downscale(photo, 512);
        const path = `${childId}/photo-${Date.now()}.jpg`;
        const up = await supabase.storage.from("child-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (!up.error) await supabase.from("children").update({ photo_url: path }).eq("id", childId);
      } catch {
        /* keep going without a photo */
      }
    }

    document.cookie = `kidlog_child=${childId}; path=/; max-age=31536000; samesite=lax`;
    router.replace(`/c/${childId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {askName && (
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Your name</span>
          <input
            className={fieldClass} required autoComplete="given-name" placeholder="What the others call you"
            value={yourName} onChange={(e) => setYourName(e.target.value)}
          />
        </label>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Child's name</span>
        <input
          className={fieldClass} required autoFocus={!askName} placeholder="Maya"
          value={name} onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Birthday <span className="font-normal text-muted">(optional)</span></span>
        <input
          type="date" className={fieldClass} max={new Date().toISOString().slice(0, 10)}
          value={birthdate} onChange={(e) => setBirthdate(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Photo <span className="font-normal text-muted">(optional)</span></span>
        <input
          type="file" accept="image/*"
          className="text-sm text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-brand-soft file:px-4 file:py-3 file:font-medium file:text-brand-ink"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
      </label>
      <ErrorNote>{error}</ErrorNote>
      <button type="submit" disabled={busy || !name.trim()} className={`${primaryButton} mt-2`}>
        {busy ? "Adding…" : "Add child"}
      </button>
    </form>
  );
}
