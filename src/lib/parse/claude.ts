import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { Draft, EntrySource } from "@/lib/types";
import { normalizeReceipt, normalizeText } from "./normalize";
import { RECEIPT_SYSTEM, TEXT_SYSTEM, receiptUserMessage, textUserMessage } from "./prompt";
import { ParsedReceiptSchema, ParsedTextSchema, type ParseContext } from "./schema";

export const DEFAULT_MODEL = "claude-fable-5-2";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

export class ParseError extends Error {
  constructor(
    public code: "refused" | "truncated" | "invalid" | "not_a_receipt",
    message: string,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

/** The one SDK method the parser uses; tests pass a fake with the same shape. */
export type ParseClient = {
  beta: { messages: { parse: Anthropic["beta"]["messages"]["parse"] } };
};

let shared: Anthropic | undefined;
const defaultClient = (): ParseClient => (shared ??= new Anthropic());

function settings() {
  const model = process.env.KIDLOG_PARSE_MODEL || DEFAULT_MODEL;
  const requested = process.env.KIDLOG_PARSE_EFFORT as Effort | undefined;
  // Extraction from one sentence is easy for this model; low effort keeps the
  // confirm card fast. Raise KIDLOG_PARSE_EFFORT if accuracy ever falls short.
  const effort: Effort = requested && EFFORTS.includes(requested) ? requested : "low";
  // If a safety classifier declines a request, let the API retry it on its
  // default fallback model instead of failing the log entry.
  const supportsFallback = /^claude-(fable-5-[12]|mythos-5-[12]|opus-5|sonnet-5-5)/.test(model);
  return { model, effort, supportsFallback };
}

async function extract<S extends z.ZodType>(
  client: ParseClient,
  schema: S,
  system: string,
  content: string | Anthropic.Beta.BetaContentBlockParam[],
): Promise<z.infer<S>> {
  const { model, effort, supportsFallback } = settings();
  const message = await client.beta.messages.parse(
    {
      model,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
      ...(supportsFallback
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
    },
    { timeout: 30_000, maxRetries: 1 },
  );

  if (message.stop_reason === "refusal") {
    throw new ParseError("refused", "The request was declined");
  }
  if (message.stop_reason === "max_tokens") {
    throw new ParseError("truncated", "The reply was cut off");
  }
  // Validate again here: the output is model-generated, and the SDK returns
  // null rather than throwing when it can't parse.
  const checked = schema.safeParse(message.parsed_output);
  if (!checked.success) {
    throw new ParseError("invalid", "The reply didn't match the expected shape");
  }
  return checked.data;
}

/** "Took Maya to swimming, paid $40" -> an activity draft and an expense draft. */
export async function parseText(
  text: string,
  ctx: ParseContext,
  source: EntrySource = "text",
  client: ParseClient = defaultClient(),
): Promise<Draft[]> {
  const parsed = await extract(client, ParsedTextSchema, TEXT_SYSTEM, textUserMessage(text, ctx));
  return normalizeText(parsed, ctx, source);
}

/** A receipt photo (base64 JPEG/PNG/WebP) -> one expense draft. */
export async function parseReceipt(
  image: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" },
  ctx: ParseContext,
  client: ParseClient = defaultClient(),
): Promise<Draft> {
  const parsed = await extract(client, ParsedReceiptSchema, RECEIPT_SYSTEM, [
    { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
    { type: "text", text: receiptUserMessage(ctx) },
  ]);
  if (!parsed.is_receipt) {
    throw new ParseError("not_a_receipt", "That doesn't look like a receipt");
  }
  return normalizeReceipt(parsed, ctx);
}
