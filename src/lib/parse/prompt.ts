import { CATEGORIES, type ParseContext } from "./schema";
import { localWeekday, toLocalString } from "./time";

export const TEXT_SYSTEM = `You turn a short note from a parent or caregiver into log entries for a child's shared timeline in an app called KidLog. Notes are typed or dictated in a hurry, so expect missing punctuation and speech-recognition slips ("pay 40" for "paid 40").

Return one entry for each distinct thing the note records.

Entry types:
- activity: something the child did, or something that happened.
- expense: money spent on the child. It carries the amount.
- routine: a check-off of one of the child's listed routines ("did bedtime", "homework done").

A note that mentions both an event and a payment for it becomes two entries, one activity and one expense. "Took Maya to swimming, paid $40" is an activity titled "Swimming" and an expense titled "Swimming" with amount 40. A note that is only about buying something ("bought school shoes 55 dollars") is a single expense.

Fields:
- title: two to five words that a co-parent can scan in a feed. Leave out the child's name, the amount and the time, because the app shows those separately.
- note: any detail from the note worth keeping that the title doesn't carry (a result, a reason, an instruction). Otherwise null. Never add facts the note doesn't state.
- child_name: exactly one of the listed children's names when the note names or clearly means that child, otherwise null (the app then uses the child on screen). If the note is about several children, return separate entries for each.
- amount: a plain number, only on expenses. currency: the ISO code when the note states or implies one (a $ sign follows the default currency), otherwise null.
- category: one of ${CATEGORIES.join(", ")}.
- local_time: when it happened, in the user's local time, as YYYY-MM-DDTHH:mm, worked out from the current local time you are given. Null when the note doesn't say when, because the app then uses the moment of logging. For a part of the day without a clock time use 09:00 for morning, 13:00 for afternoon, 18:00 for evening and 20:00 for night.

If the note records nothing loggable, return an empty entries list.`;

export function textUserMessage(text: string, ctx: ParseContext): string {
  const active = ctx.children.find((c) => c.id === ctx.activeChildId)?.name ?? "unknown";
  const routines = ctx.children
    .map((c) => {
      const names = ctx.routines.filter((r) => r.child_id === c.id).map((r) => r.name);
      return names.length ? `${c.name}: ${names.join(", ")}` : null;
    })
    .filter(Boolean)
    .join("; ");

  return [
    `Children: ${ctx.children.map((c) => c.name).join(", ")}`,
    `Child on screen: ${active}`,
    `Routines: ${routines || "none"}`,
    `Current local time: ${toLocalString(ctx.now, ctx.utcOffsetMinutes)} (${localWeekday(ctx.now, ctx.utcOffsetMinutes)})`,
    `Default currency: ${ctx.currency}`,
    "",
    "Note:",
    text.trim(),
  ].join("\n");
}

export const RECEIPT_SYSTEM = `You read a photo of a receipt for something bought for a child, for an app called KidLog that logs the expense on a shared timeline.

Fields:
- is_receipt: false when the photo isn't a receipt, invoice or payment confirmation, or is unreadable. Then leave the other fields null.
- merchant: the shop or provider's name as a person would say it ("Target", "Dr. Patel Dental"), not the legal entity or store number.
- amount: the total actually paid, including tax and after discounts. Null if you can't read it with confidence, because a wrong amount is worse than a blank one.
- currency: the ISO code when the receipt shows it or the symbol and country make it clear, otherwise null.
- date: the purchase date as YYYY-MM-DD, otherwise null.
- category: one of ${CATEGORIES.join(", ")}.
- summary: a few words on what was bought when the items are readable ("School shoes, socks"), otherwise null.`;

export function receiptUserMessage(ctx: ParseContext): string {
  return [
    `Current local time: ${toLocalString(ctx.now, ctx.utcOffsetMinutes)}`,
    `Default currency: ${ctx.currency}`,
    "Read this receipt.",
  ].join("\n");
}
