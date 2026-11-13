"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorNote, fieldClass, primaryButton, quietButton } from "./ui";

/** Email magic link sign-in. `next` is where to land after the link is opened. */
export function LoginForm({ next, linkFailed = false }: { next?: string; linkFailed?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState(
    linkFailed ? "That sign-in link didn't work or has expired. Send yourself a new one." : "",
  );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const safeNext = next && /^\/(?![\/\\])/.test(next) && !next.includes("\\") ? next : "/";
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}` },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <div className="rise rounded-3xl bg-card p-6 text-center shadow-sm">
        <p className="text-xl font-semibold">Check your email</p>
        <p className="mt-2 text-muted">
          We sent a sign-in link to <span className="font-medium text-ink">{email.trim()}</span>. Open it on this
          device.
        </p>
        <button type="button" className={`${quietButton} mt-4`} onClick={() => setState("idle")}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-3">
      <label htmlFor="email" className="font-medium">Your email</label>
      <input
        id="email" type="email" required autoComplete="email" inputMode="email"
        placeholder="you@example.com" className={fieldClass}
        value={email} onChange={(e) => setEmail(e.target.value)}
      />
      <ErrorNote>{error}</ErrorNote>
      <button type="submit" disabled={state === "sending"} className={primaryButton}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p className="text-center text-sm text-muted">No password needed.</p>
    </form>
  );
}
