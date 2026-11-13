import { Me } from "@/components/Me";
import { Page } from "@/components/ui";
import { loadSession } from "@/lib/data";

export const metadata = { title: "You · KidLog" };
export const dynamic = "force-dynamic";

export default async function MePage() {
  const { profile, user } = await loadSession();
  return (
    <Page title="You" back="/">
      <Me profile={profile} email={user.email ?? ""} />
    </Page>
  );
}
