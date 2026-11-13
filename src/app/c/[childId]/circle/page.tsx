import { redirect } from "next/navigation";
import { Circle } from "@/components/Circle";
import { Page } from "@/components/ui";
import { loadMembers, loadSession } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CirclePage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const { supabase, profile, children } = await loadSession();
  const child = children.find((c) => c.id === childId);
  if (!child) redirect("/");
  const members = await loadMembers(supabase, childId);
  return (
    <Page title={`${child.name}'s circle`} back={`/c/${childId}`}>
      <Circle childId={childId} childName={child.name} members={members} meId={profile.id} />
    </Page>
  );
}
