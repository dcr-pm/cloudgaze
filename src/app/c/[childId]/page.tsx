import { Home } from "@/components/Home";
import { SimpleHome } from "@/components/SimpleHome";
import { loadHome } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ChildHome({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const { profile, children, child, members, routines, entries } = await loadHome(childId);
  const View = profile.simple_mode ? SimpleHome : Home;
  return (
    <View
      key={child.id}
      profile={profile} kids={children} child={child}
      members={members} routines={routines} initialEntries={entries}
    />
  );
}
