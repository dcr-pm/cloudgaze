import { NextResponse } from "next/server";
import { z } from "zod";
import { parseText } from "@/lib/parse/claude";
import { fallbackDraft } from "@/lib/parse/normalize";
import { ContextBody, buildContext } from "@/lib/parse/request";

export const maxDuration = 45;

const Body = ContextBody.extend({
  text: z.string().trim().min(1).max(1000),
  source: z.enum(["text", "voice"]).default("text"),
});

/** Free text -> entry drafts for the confirm card. */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const ctx = await buildContext(body.data);
  if (!ctx) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const { text, source } = body.data;
  try {
    const drafts = await parseText(text, ctx, source);
    // Nothing loggable found: still offer the note as written.
    return NextResponse.json({ drafts: drafts.length ? drafts : [fallbackDraft(text, ctx, source)] });
  } catch (error) {
    // Logging must never be blocked by the parser: fall back to the raw text.
    console.error("parse failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ drafts: [fallbackDraft(text, ctx, source)], degraded: true });
  }
}
