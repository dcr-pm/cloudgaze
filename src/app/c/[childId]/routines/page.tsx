import { redirect } from "next/navigation";
import { Routines } from "@/components/Routines";
import { Page } from "@/components/ui";
import { loadSession } from "@/lib/data";
import type { Routine } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RoutinesPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const { supabase, profile, children } = await loadSession();
  const child = children.find((c) => c.id === childId);
  if (!child) redirect("/");

  const [{ data: routines }, { data: me }] = await Promise.all([
    supabase.from("routines").select("*").eq("child_id", childId).is("archived_at", null)
      .order("sort_order").order("created_at"),
    supabase.from("circle_members").select("permission").eq("child_id", childId).eq("user_id", profile.id).maybeSingle(),
  ]);

  return (
    <Page title={`${child.name}'s routines`} back={`/c/${childId}`}>
      <Routines childId={childId} routines={(routines ?? []) as Routine[]} canManage={me?.permission === "full"} />
    </Page>
  );
}
