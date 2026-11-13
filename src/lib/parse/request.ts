import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ParseContext } from "./schema";

export const ContextBody = z.object({
  childId: z.uuid(),
  now: z.iso.datetime(),
  utcOffsetMinutes: z.number().int().min(-14 * 60).max(14 * 60),
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
});

/**
 * Builds the parse context from the database rather than the request body:
 * the caller only names the child on screen, and RLS decides which children
 * and routines they can actually see.
 */
export async function buildContext(body: z.infer<typeof ContextBody>): Promise<ParseContext | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [children, routines] = await Promise.all([
    supabase.from("children").select("id, name").order("created_at"),
    supabase.from("routines").select("id, child_id, name").is("archived_at", null),
  ]);
  const kids = children.data ?? [];
  if (!kids.some((c) => c.id === body.childId)) return null;

  return {
    children: kids,
    activeChildId: body.childId,
    routines: routines.data ?? [],
    now: body.now,
    utcOffsetMinutes: body.utcOffsetMinutes,
    currency: body.currency,
  };
}
