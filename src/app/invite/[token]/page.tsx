import Link from "next/link";
import { JoinCircle } from "@/components/JoinCircle";
import { LoginForm } from "@/components/LoginForm";
import { primaryButton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { PERMISSION_HELP, ROLE_LABEL, type MemberPermission, type MemberRole } from "@/lib/types";

export const metadata = { title: "You're invited · KidLog" };

type Preview = {
  child_id: string; child_name: string; role: MemberRole;
  permission: MemberPermission; invited_by_name: string; valid: boolean;
};

export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: auth }, { data }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("invite_preview", { _token: token }),
  ]);
  const invite = (data as Preview[] | null)?.[0];

  let alreadyIn = false;
  let name = "";
  if (auth.user && invite) {
    const [{ data: child }, { data: profile }] = await Promise.all([
      supabase.from("children").select("id").eq("id", invite.child_id).maybeSingle(),
      supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle(),
    ]);
    alreadyIn = Boolean(child);
    name = profile?.display_name ?? "";
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pb-16">
      <p className="text-2xl font-semibold tracking-tight text-brand">KidLog</p>
      {!invite || (!invite.valid && !alreadyIn) ? (
        <>
          <h1 className="mt-4 text-2xl font-semibold">This invite link doesn't work any more</h1>
          <p className="mt-2 text-muted">
            Links can be used once and expire after a week. Ask for a new one.
          </p>
          <Link href="/" className={`${primaryButton} mt-8`}>Open KidLog</Link>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-2xl font-semibold">
            {invite.invited_by_name} invited you to {invite.child_name}'s circle
          </h1>
          <p className="mt-3 text-muted">
            You'll join as a <span className="font-medium text-ink">{ROLE_LABEL[invite.role].toLowerCase()}</span>.{" "}
            {PERMISSION_HELP[invite.permission]}
          </p>
          <div className="mt-8">
            {alreadyIn ? (
              <Link href={`/c/${invite.child_id}`} className={primaryButton}>
                Open {invite.child_name}'s timeline
              </Link>
            ) : auth.user ? (
              <JoinCircle token={token} childName={invite.child_name} currentName={name} />
            ) : (
              <LoginForm next={`/invite/${token}`} />
            )}
          </div>
        </>
      )}
    </main>
  );
}
