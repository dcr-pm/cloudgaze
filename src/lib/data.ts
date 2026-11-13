import { redirect } from "next/navigation";
import { ENTRY_SELECT, toEntry } from "./entries";
import { createClient } from "./supabase/server";
import type { Child, Entry, Member, Profile, Routine } from "./types";

/** The signed-in user's profile and children. Redirects to /login if signed out. */
export async function loadSession() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [profileRes, childrenRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name, simple_mode").eq("id", auth.user.id).maybeSingle(),
    supabase.from("children").select("id, name, birthdate, photo_url").order("created_at"),
  ]);
  if (childrenRes.error) throw new Error(childrenRes.error.message);

  const profile: Profile = profileRes.data ?? {
    id: auth.user.id,
    display_name: auth.user.email?.split("@")[0] ?? "You",
    simple_mode: false,
  };
  const children = (childrenRes.data ?? []) as Child[];

  // Photos live in a private bucket; swap storage paths for short-lived URLs.
  const paths = children.filter((c) => c.photo_url).map((c) => c.photo_url!);
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("child-photos").createSignedUrls(paths, 3600);
    for (const child of children) {
      const hit = signed?.find((s) => s.path === child.photo_url);
      child.photo_url = hit?.signedUrl ?? null;
    }
  }
  return { supabase, user: auth.user, profile, children };
}

/** Members of a child's circle, with display names. */
export async function loadMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  childId: string,
): Promise<Member[]> {
  const { data: rows } = await supabase
    .from("circle_members")
    .select("child_id, user_id, role, permission, created_at")
    .eq("child_id", childId)
    .order("created_at");
  const ids = (rows ?? []).map((r) => r.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  return (rows ?? []).map((r) => ({
    child_id: r.child_id,
    user_id: r.user_id,
    role: r.role,
    permission: r.permission,
    display_name: names.get(r.user_id) ?? "Someone",
  }));
}

/** Everything the home screen needs for one child. */
export async function loadHome(childId: string) {
  const session = await loadSession();
  const { supabase, children } = session;
  const child = children.find((c) => c.id === childId);
  if (!child) redirect("/");

  const [members, routinesRes, entriesRes] = await Promise.all([
    loadMembers(supabase, childId),
    // Routines for all of the user's children, so a spoken "Leo did bath"
    // can be matched even while Maya is on screen.
    supabase.from("routines").select("*").is("archived_at", null).order("sort_order").order("created_at"),
    supabase.from("entries").select(ENTRY_SELECT).eq("child_id", childId)
      .order("occurred_at", { ascending: false }).limit(200),
  ]);
  if (entriesRes.error) throw new Error(entriesRes.error.message);

  return {
    ...session,
    child,
    members,
    routines: (routinesRes.data ?? []) as Routine[],
    entries: (entriesRes.data ?? []).map(toEntry) as Entry[],
  };
}
