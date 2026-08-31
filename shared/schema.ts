import { z } from 'zod';
import {
  EXPENSE_CATEGORIES,
  PARENT_COLORS,
  PLAN_CATEGORIES,
  SCHEMA_VERSION,
} from './types';

/**
 * Validation for everything crossing the network boundary. The server runs
 * these before touching stored state; the client reuses them so a malformed
 * entry is caught before it is optimistically applied.
 */

// ── Primitives ──────────────────────────────────────────────────────────────

export const zLocalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((s) => {
    // Reject 2026-02-31 and friends: round-tripping through Date must be stable.
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    const dt = new Date(y, m - 1, d, 12);
    return (
      dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
    );
  }, 'Not a real calendar date');

export const zLocalTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM in 24-hour time');

export const zInstant = z.string().datetime();

export const zId = z.string().min(1).max(64);

export const zWeekday = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

/** Integer cents. Capped well above any plausible child expense so a typo or a
 *  hostile client can't produce a nonsense balance. */
export const zCents = z.number().int().min(0).max(100_000_000);

const zShortText = z.string().trim().min(1).max(200);
const zOptionalText = z.string().trim().max(500).optional();

// ── Household ───────────────────────────────────────────────────────────────

export const zParentColor = z.enum(PARENT_COLORS);

export const zParent = z.object({
  id: zId,
  name: zShortText.max(60),
  color: zParentColor,
});

export const zKid = z.object({
  id: zId,
  name: zShortText.max(60),
  emoji: z.string().max(8).optional(),
  archived: z.boolean().optional(),
});

export const zHousehold = z.object({
  id: zId,
  createdAt: zInstant,
  timezone: z.string().min(1).max(64),
  parents: z.tuple([zParent, zParent]),
  kids: z.array(zKid).max(20),
});

// ── Entries ─────────────────────────────────────────────────────────────────

const entryBase = {
  id: zId,
  kidIds: z.array(zId).max(20),
  createdAt: zInstant,
  createdByParentId: zId,
  updatedAt: zInstant,
  updatedByParentId: zId,
  notes: zOptionalText,
  deletedAt: zInstant.optional(),
};

/** Plain object shapes. Kept separate from the refined versions below because a
 *  discriminated union needs to read the `kind` discriminator off the raw
 *  object, and cross-field refinements are re-checked by validateEntry(). */
const planEntryShape = z.object({
  ...entryBase,
  kind: z.literal('plan'),
  title: zShortText,
  category: z.enum(PLAN_CATEGORIES),
  date: zLocalDate,
  endDate: zLocalDate.optional(),
  startTime: zLocalTime.optional(),
  endTime: zLocalTime.optional(),
  allDay: z.boolean().optional(),
  location: zOptionalText,
  withParentId: zId.optional(),
});

const activityEntryShape = z.object({
  ...entryBase,
  kind: z.literal('activity'),
  name: zShortText,
  emoji: z.string().min(1).max(8),
  weekdays: z.array(zWeekday).min(1).max(7),
  startTime: zLocalTime,
  durationMinutes: z.number().int().min(5).max(24 * 60),
  seasonStart: zLocalDate,
  seasonEnd: zLocalDate.nullable(),
  location: zOptionalText,
  contactName: z.string().trim().max(100).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  dropoffParentId: zId.optional(),
  pickupParentId: zId.optional(),
  exceptions: z.array(zLocalDate).max(400).optional(),
});

export const zPlanEntry = planEntryShape.refine(
  (e) => !e.endDate || e.endDate >= e.date,
  { message: 'End date cannot be before the start date', path: ['endDate'] },
);

export const zActivityEntry = activityEntryShape.refine(
  (a) => !a.seasonEnd || a.seasonEnd >= a.seasonStart,
  { message: 'Season end cannot be before season start', path: ['seasonEnd'] },
);

export const zSplitRule = z.discriminatedUnion('type', [
  z.object({ type: z.literal('even') }),
  z.object({ type: z.literal('all_mine') }),
  z.object({
    type: z.literal('custom'),
    otherOwesPercent: z.number().min(0).max(100),
  }),
]);

export const zExpenseEntry = z.object({
  ...entryBase,
  kind: z.literal('expense'),
  description: zShortText,
  amountCents: zCents,
  date: zLocalDate,
  category: z.enum(EXPENSE_CATEGORIES),
  paidByParentId: zId,
  split: zSplitRule,
  reimbursed: z.boolean(),
  reimbursedAt: zInstant.optional(),
});

export const zEntry = z.discriminatedUnion('kind', [
  planEntryShape,
  activityEntryShape,
  zExpenseEntry,
]);

/** Full validation including the cross-field date rules. */
export function validateEntry(input: unknown) {
  const base = zEntry.safeParse(input);
  if (!base.success) return base;
  switch (base.data.kind) {
    case 'plan':
      return zPlanEntry.safeParse(input);
    case 'activity':
      return zActivityEntry.safeParse(input);
    case 'expense':
      return base;
  }
}

// ── Ops ─────────────────────────────────────────────────────────────────────

export const zHouseholdPatch = z.object({
  timezone: z.string().min(1).max(64).optional(),
  parents: z.tuple([zParent, zParent]).optional(),
  kids: z.array(zKid).max(20).optional(),
});

export const zOp = z.discriminatedUnion('type', [
  z.object({ type: z.literal('upsertEntry'), entry: zEntry }),
  z.object({ type: z.literal('deleteEntry'), id: zId }),
  z.object({ type: z.literal('restoreEntry'), id: zId }),
  z.object({
    type: z.literal('setReimbursed'),
    ids: z.array(zId).min(1).max(500),
    reimbursed: z.boolean(),
  }),
  z.object({ type: z.literal('updateHousehold'), patch: zHouseholdPatch }),
]);

export const zMutateRequest = z.object({
  actorParentId: zId,
  now: zInstant,
  ops: z.array(zOp).min(1).max(500),
});

// ── Household creation ──────────────────────────────────────────────────────

export const zCreateHouseholdRequest = z.object({
  parents: z.tuple([
    z.object({ name: zShortText.max(60), color: zParentColor }),
    z.object({ name: zShortText.max(60), color: zParentColor }),
  ]),
  kids: z
    .array(z.object({ name: zShortText.max(60), emoji: z.string().max(8).optional() }))
    .min(1)
    .max(20),
  timezone: z.string().min(1).max(64),
});

export const zJoinRequest = z.object({
  familyCode: z.string().min(1).max(40),
});

// ── Stored document ─────────────────────────────────────────────────────────

export const zFamilyState = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  household: zHousehold,
  entries: z.array(zEntry),
  audit: z.array(
    z.object({
      id: zId,
      at: zInstant,
      byParentId: zId,
      action: z.enum([
        'create',
        'update',
        'delete',
        'restore',
        'settle',
        'household',
      ]),
      entryId: zId.optional(),
      summary: z.string().max(300),
    }),
  ),
  updatedAt: zInstant,
});

export type CreateHouseholdRequest = z.infer<typeof zCreateHouseholdRequest>;
export type JoinRequest = z.infer<typeof zJoinRequest>;
