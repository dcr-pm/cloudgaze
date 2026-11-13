import { describe, expect, it, vi } from "vitest";
import { ParseError, parseReceipt, parseText, type ParseClient } from "@/lib/parse/claude";
import { fallbackDraft, matchChild, normalizeText } from "@/lib/parse/normalize";
import { textUserMessage } from "@/lib/parse/prompt";
import type { ParseContext, ParsedText } from "@/lib/parse/schema";
import { localToInstant, toLocalString } from "@/lib/parse/time";

const MAYA = "c0000000-0000-4000-8000-000000000001";
const LEO = "c0000000-0000-4000-8000-000000000002";
const BEDTIME = "d0000000-0000-4000-8000-000000000003";

// Friday 13 Nov 2026, 16:42 in New York (UTC-5).
const ctx: ParseContext = {
  children: [{ id: MAYA, name: "Maya" }, { id: LEO, name: "Leo" }],
  activeChildId: LEO,
  routines: [{ id: BEDTIME, child_id: MAYA, name: "Bedtime" }],
  now: "2026-11-13T21:42:00.000Z",
  utcOffsetMinutes: -300,
  currency: "USD",
};

type RawEntry = ParsedText["entries"][number];
const entry = (over: Partial<RawEntry>): RawEntry => ({
  type: "activity", child_name: null, title: "Something", note: null,
  amount: null, currency: null, category: null, local_time: null, ...over,
});

/** A stand-in for the Anthropic client that replies with a fixed message. */
function fakeClient(reply: { stop_reason?: string; parsed_output: unknown }) {
  const parse = vi.fn(async () => ({ stop_reason: "end_turn", ...reply }));
  return { client: { beta: { messages: { parse } } } as unknown as ParseClient, parse };
}

describe("parseText", () => {
  it("turns one sentence into an activity and an expense", async () => {
    const { client, parse } = fakeClient({
      parsed_output: {
        entries: [
          entry({ type: "activity", child_name: "Maya", title: "swimming", category: "sports" }),
          entry({ type: "expense", child_name: "Maya", title: "swimming", amount: 40, currency: "USD", category: "sports" }),
        ],
      },
    });

    const drafts = await parseText("Took Maya to swimming, paid $40", ctx, "voice", client);

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      type: "activity", child_id: MAYA, title: "Swimming", amount: null,
      category: "sports", occurred_at: ctx.now, source: "voice",
    });
    expect(drafts[1]).toMatchObject({ type: "expense", child_id: MAYA, title: "Swimming", amount: 40, currency: "USD" });
    // Linked as one event, with distinct ids
    expect(drafts[0].group_id).toBeTruthy();
    expect(drafts[0].group_id).toBe(drafts[1].group_id);
    expect(drafts[0].id).not.toBe(drafts[1].id);

    // The request: right model, structured output, and the context Claude needs
    const [params] = parse.mock.calls[0] as unknown as [Record<string, any>];
    expect(params.model).toBe("claude-fable-5-2");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.fallbacks).toBe("default");
    expect(params.thinking).toBeUndefined();
    const user = params.messages[0].content as string;
    expect(user).toContain("Children: Maya, Leo");
    expect(user).toContain("Child on screen: Leo");
    expect(user).toContain("Current local time: 2026-11-13T16:42 (Friday)");
    expect(user).toContain("Took Maya to swimming, paid $40");
  });

  it("returns no drafts when the note records nothing", async () => {
    const { client } = fakeClient({ parsed_output: { entries: [] } });
    expect(await parseText("hmm", ctx, "text", client)).toEqual([]);
  });

  it("throws a ParseError on a refusal, a cut-off reply or a malformed one", async () => {
    const refused = fakeClient({ stop_reason: "refusal", parsed_output: null });
    await expect(parseText("x", ctx, "text", refused.client)).rejects.toMatchObject({ code: "refused" });

    const truncated = fakeClient({ stop_reason: "max_tokens", parsed_output: null });
    await expect(parseText("x", ctx, "text", truncated.client)).rejects.toMatchObject({ code: "truncated" });

    for (const bad of [null, {}, { entries: [{ type: "party", title: 1 }] }]) {
      const { client } = fakeClient({ parsed_output: bad });
      await expect(parseText("x", ctx, "text", client)).rejects.toBeInstanceOf(ParseError);
    }
  });

  it("lets API errors through for the caller to handle", async () => {
    const client = {
      beta: { messages: { parse: vi.fn(async () => { throw new Error("529 overloaded"); }) } },
    } as unknown as ParseClient;
    await expect(parseText("x", ctx, "text", client)).rejects.toThrow("529 overloaded");
  });
});

describe("normalizeText", () => {
  const run = (...entries: RawEntry[]) => normalizeText({ entries }, ctx, "text");

  it("uses the child on screen when none is named or the name is unknown", () => {
    expect(run(entry({}))[0].child_id).toBe(LEO);
    expect(run(entry({ child_name: "Zoe" }))[0].child_id).toBe(LEO);
  });

  it("matches children loosely: case, nicknames and possessives", () => {
    expect(matchChild("maya", ctx)).toBe(MAYA);
    expect(matchChild(" MAYA ", ctx)).toBe(MAYA);
    expect(matchChild("Maya's", ctx)).toBe(MAYA);
    expect(matchChild("May", ctx)).toBe(MAYA);
  });

  it("resolves local times to instants, and falls back to now", () => {
    // 09:00 in New York is 14:00 UTC
    expect(run(entry({ local_time: "2026-11-13T09:00" }))[0].occurred_at).toBe("2026-11-13T14:00:00.000Z");
    // Yesterday evening crosses the UTC date line
    expect(run(entry({ local_time: "2026-11-12T20:00" }))[0].occurred_at).toBe("2026-11-13T01:00:00.000Z");
    expect(run(entry({ local_time: null }))[0].occurred_at).toBe(ctx.now);
    expect(run(entry({ local_time: "last Tuesday" }))[0].occurred_at).toBe(ctx.now);
    expect(run(entry({ local_time: "2026-02-31T10:00" }))[0].occurred_at).toBe(ctx.now);
  });

  it("splits an activity that came back with an amount into activity + expense", () => {
    const drafts = run(entry({ type: "activity", title: "Swimming", amount: 40, note: "Level 3" }));
    expect(drafts.map((d) => [d.type, d.amount])).toEqual([["activity", null], ["expense", 40]]);
    expect(drafts[0].note).toBe("Level 3");
    expect(drafts[0].group_id).toBe(drafts[1].group_id);
  });

  it("keeps an expense with no readable amount, for the user to fill in", () => {
    for (const amount of [null, 0, -5, Number.NaN]) {
      const [d] = run(entry({ type: "expense", title: "School shoes", amount }));
      expect(d).toMatchObject({ type: "expense", amount: null });
    }
  });

  it("rounds amounts to cents and tidies currency, category and title", () => {
    const [d] = run(entry({
      type: "expense", title: "  school   shoes ", amount: 54.999, currency: "eur", category: "clothing",
    }));
    expect(d).toMatchObject({ title: "School shoes", amount: 55, currency: "EUR", category: "clothing" });
    expect(run(entry({ type: "expense", amount: 5, currency: "$" }))[0].currency).toBe("USD");
    expect(run(entry({ category: "weird" as never }))[0].category).toBe("other");
    expect(run(entry({ title: "x".repeat(200) }))[0].title).toHaveLength(80);
  });

  it("links a routine check-off to the child's routine", () => {
    const [d] = run(entry({ type: "routine", child_name: "Maya", title: "bedtime" }));
    expect(d).toMatchObject({ type: "routine", routine_id: BEDTIME, title: "Bedtime", amount: null });
    // Leo has no Bedtime routine: still a routine entry, just unlinked
    expect(run(entry({ type: "routine", title: "Bedtime" }))[0].routine_id).toBeNull();
  });

  it("does not group entries about different children", () => {
    const drafts = run(entry({ child_name: "Maya", title: "Park" }), entry({ child_name: "Leo", title: "Park" }));
    expect(drafts.map((d) => d.child_id)).toEqual([MAYA, LEO]);
    expect(drafts.every((d) => d.group_id === null)).toBe(true);
  });

  it("drops untitled entries and caps the number of drafts", () => {
    expect(run(entry({ title: "   " }))).toEqual([]);
    expect(run(...Array.from({ length: 9 }, (_, i) => entry({ title: `Thing ${i}` })))).toHaveLength(4);
  });
});

describe("parseReceipt", () => {
  const image = { data: "aGVsbG8=", mediaType: "image/jpeg" as const };
  const receipt = (over: Record<string, unknown>) => ({
    is_receipt: true, merchant: "Target", amount: 54.99, currency: "USD",
    date: "2026-11-10", category: "clothing", summary: "School shoes", ...over,
  });

  it("turns a receipt into one expense draft and sends the image to Claude", async () => {
    const { client, parse } = fakeClient({ parsed_output: receipt({}) });
    const draft = await parseReceipt(image, ctx, client);
    expect(draft).toMatchObject({
      type: "expense", child_id: LEO, title: "Target", amount: 54.99, currency: "USD",
      category: "clothing", note: "School shoes", source: "receipt",
      occurred_at: "2026-11-10T17:00:00.000Z", // noon local on the receipt date
    });
    const [params] = parse.mock.calls[0] as unknown as [Record<string, any>];
    expect(params.messages[0].content[0]).toEqual({
      type: "image", source: { type: "base64", media_type: "image/jpeg", data: "aGVsbG8=" },
    });
  });

  it("logs a receipt dated today, in the future or undated as now", async () => {
    for (const date of ["2026-11-13", "2027-01-01", null, "garbage"]) {
      const { client } = fakeClient({ parsed_output: receipt({ date }) });
      expect((await parseReceipt(image, ctx, client)).occurred_at).toBe(ctx.now);
    }
  });

  it("leaves the amount blank when it can't be read, and names an unknown merchant", async () => {
    const { client } = fakeClient({ parsed_output: receipt({ amount: null, merchant: null, category: null }) });
    expect(await parseReceipt(image, ctx, client)).toMatchObject({ amount: null, title: "Receipt", category: "other" });
  });

  it("rejects photos that aren't receipts", async () => {
    const { client } = fakeClient({ parsed_output: receipt({ is_receipt: false, merchant: null, amount: null }) });
    await expect(parseReceipt(image, ctx, client)).rejects.toMatchObject({ code: "not_a_receipt" });
  });
});

describe("helpers", () => {
  it("fallbackDraft saves the raw text as an activity", () => {
    expect(fallbackDraft("took maya to the park", ctx, "voice")).toMatchObject({
      type: "activity", title: "Took maya to the park", child_id: LEO, occurred_at: ctx.now, source: "voice", note: null,
    });
    const long = "word ".repeat(40).trim();
    const d = fallbackDraft(long, ctx, "text");
    expect(d.title.length).toBeLessThanOrEqual(80);
    expect(d.note).toBe(long);
  });

  it("converts between instants and local time", () => {
    expect(toLocalString("2026-11-13T21:42:00.000Z", -300)).toBe("2026-11-13T16:42");
    expect(toLocalString("2026-11-13T21:42:00.000Z", 330)).toBe("2026-11-14T03:12");
    expect(localToInstant("2026-11-13T16:42", -300)).toBe("2026-11-13T21:42:00.000Z");
    expect(localToInstant("2026-11-13", 0)).toBe("2026-11-13T12:00:00.000Z");
    expect(localToInstant("25:99", 0)).toBeNull();
  });

  it("lists each child's routines in the prompt", () => {
    expect(textUserMessage("x", ctx)).toContain("Routines: Maya: Bedtime");
  });
});
