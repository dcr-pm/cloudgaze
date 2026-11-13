import { NextResponse } from "next/server";
import { z } from "zod";
import { ParseError, parseReceipt } from "@/lib/parse/claude";
import { ContextBody, buildContext } from "@/lib/parse/request";
import type { Draft } from "@/lib/types";

export const maxDuration = 45;

const Body = ContextBody.extend({
  // Base64 JPEG, already downscaled in the browser (about 3 MB at most).
  image: z.string().min(100).max(4_000_000),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
});

/** Receipt photo -> one expense draft for the confirm card. */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const ctx = await buildContext(body.data);
  if (!ctx) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  try {
    const draft = await parseReceipt({ data: body.data.image, mediaType: body.data.mediaType }, ctx);
    return NextResponse.json({ drafts: [draft] });
  } catch (error) {
    console.error("receipt parse failed:", error instanceof Error ? error.message : error);
    // Keep the photo and let the person type the amount.
    const blank: Draft = {
      id: crypto.randomUUID(),
      child_id: ctx.activeChildId,
      type: "expense",
      title: "Receipt",
      note: null,
      amount: null,
      currency: ctx.currency,
      category: "other",
      occurred_at: ctx.now,
      routine_id: null,
      group_id: null,
      source: "receipt",
    };
    const notReceipt = error instanceof ParseError && error.code === "not_a_receipt";
    return NextResponse.json({
      drafts: [blank],
      degraded: true,
      message: notReceipt
        ? "That didn't look like a receipt. You can still fill it in."
        : "Couldn't read the receipt. You can still fill it in.",
    });
  }
}
