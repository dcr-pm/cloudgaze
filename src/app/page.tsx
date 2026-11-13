import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadSession } from "@/lib/data";

/** Home is the timeline of the child you looked at last. */
export default async function Root() {
  const { children } = await loadSession();
  if (children.length === 0) redirect("/welcome");
  const last = (await cookies()).get("kidlog_child")?.value;
  const child = children.find((c) => c.id === last) ?? children[0];
  redirect(`/c/${child.id}`);
}
