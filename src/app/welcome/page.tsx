import { AddChildForm } from "@/components/AddChildForm";
import { Page } from "@/components/ui";
import { loadSession } from "@/lib/data";

export const metadata = { title: "Add a child · KidLog" };

export default async function Welcome() {
  const { profile, children } = await loadSession();
  const first = children.length === 0;
  return (
    <Page title={first ? "Welcome to KidLog" : "Add a child"} back={first ? undefined : "/"}>
      {first && (
        <p className="-mt-3 mb-6 text-muted">
          Start with your child's name. You can invite the other people in their life next.
        </p>
      )}
      <AddChildForm profileName={profile.display_name} askName={first} />
    </Page>
  );
}
