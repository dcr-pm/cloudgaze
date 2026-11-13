import { z } from "zod";

export const CATEGORIES = [
  "sports", "school", "health", "food", "clothing", "childcare",
  "transport", "play", "social", "outing", "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** What Claude returns for a typed or spoken note. */
export const ParsedTextSchema = z.object({
  entries: z.array(
    z.object({
      type: z.enum(["activity", "expense", "routine"]),
      child_name: z.string().nullable(),
      title: z.string(),
      note: z.string().nullable(),
      amount: z.number().nullable(),
      currency: z.string().nullable(),
      category: z.enum(CATEGORIES).nullable(),
      local_time: z.string().nullable(),
    }),
  ),
});
export type ParsedText = z.infer<typeof ParsedTextSchema>;

/** What Claude returns for a receipt photo. */
export const ParsedReceiptSchema = z.object({
  is_receipt: z.boolean(),
  merchant: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  date: z.string().nullable(),
  category: z.enum(CATEGORIES).nullable(),
  summary: z.string().nullable(),
});
export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;

/** Everything the parser needs to know about who is logging, and when. */
export type ParseContext = {
  children: { id: string; name: string }[];
  activeChildId: string;
  routines: { id: string; child_id: string; name: string }[];
  /** The moment of logging, as an ISO instant. */
  now: string;
  /** The user's offset from UTC in minutes, east positive (New York in winter: -300). */
  utcOffsetMinutes: number;
  currency: string;
};
