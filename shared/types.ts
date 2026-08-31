/**
 * The data model. Imported by BOTH the browser app (src/) and the Netlify
 * functions (netlify/functions/) via relative paths.
 *
 * Do not introduce a `@shared` path alias for this directory: Vite resolves
 * aliases from vite.config.ts, but Netlify's esbuild function bundler does not
 * read that file. An alias here builds locally and breaks on deploy.
 */

// ── Primitives ──────────────────────────────────────────────────────────────

/** "2026-08-31" — a LOCAL calendar date. Never pass this to `new Date(str)`,
 *  which parses bare date strings as UTC and shifts them a day in most zones. */
export type LocalDate = string;

/** "17:30" — 24h local wall-clock time. */
export type LocalTime = string;

/** Full ISO-8601 instant, e.g. "2026-08-31T14:03:22.114Z". Audit stamps only. */
export type Instant = string;

/** crypto.randomUUID(). Generated CLIENT-side so every op is idempotent, which
 *  is what makes both CAS retries and offline queue replay safe to repeat. */
export type Id = string;

/** 0 = Sunday, matching Date.prototype.getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Integer cents. Never a float — `0.1 + 0.2 !== 0.3` is not acceptable in a
 *  ledger two people are going to argue over. Parse at the input boundary,
 *  format at the render boundary, integers everywhere in between. */
export type Cents = number;

// ── Household ───────────────────────────────────────────────────────────────

export const PARENT_COLORS = [
  'indigo',
  'teal',
  'rose',
  'amber',
  'violet',
  'emerald',
] as const;

export type ParentColor = (typeof PARENT_COLORS)[number];

export interface Parent {
  id: Id;
  name: string;
  color: ParentColor;
}

export interface Kid {
  id: Id;
  name: string;
  /** Optional avatar, e.g. "🦖". Purely decorative. */
  emoji?: string;
  archived?: boolean;
}

export interface Household {
  id: Id;
  createdAt: Instant;
  /** IANA zone, e.g. "America/Denver". Used for display formatting so two
   *  parents in different zones read the same calendar. */
  timezone: string;
  /** Exactly two, by product definition. */
  parents: [Parent, Parent];
  kids: Kid[];
}

// ── Entries ─────────────────────────────────────────────────────────────────

export interface EntryBase {
  id: Id;
  /** Plural: a camping weekend or a handoff covers every kid at once. */
  kidIds: Id[];
  createdAt: Instant;
  createdByParentId: Id;
  updatedAt: Instant;
  updatedByParentId: Id;
  notes?: string;
  /** Soft delete. Combined with the audit log this makes a removal visible and
   *  recoverable rather than silent. Hard-purged after 90 days. */
  deletedAt?: Instant;
}

export const PLAN_CATEGORIES = [
  'camping',
  'event',
  'school',
  'shopping',
  'doctor',
  'birthday',
  'travel',
  'dinner',
  'handoff',
  'sleepover',
  'movie',
  'other',
] as const;

export type PlanCategory = (typeof PLAN_CATEGORIES)[number];

export interface PlanEntry extends EntryBase {
  kind: 'plan';
  title: string;
  category: PlanCategory;
  /** Start date. */
  date: LocalDate;
  /** Multi-day events (camping Fri→Sun). Omit for single-day. */
  endDate?: LocalDate;
  startTime?: LocalTime;
  endTime?: LocalTime;
  allDay?: boolean;
  /** Free text, rendered as a maps deep link. */
  location?: string;
  /** Which parent has the kid for this event. When category === 'handoff'
   *  this is the parent RECEIVING the kid, which drives the custody banner. */
  withParentId?: Id;
}

export interface ActivityEntry extends EntryBase {
  kind: 'activity';
  /** "Soccer practice" */
  name: string;
  emoji: string;
  /** e.g. [2, 4] = Tuesdays and Thursdays. */
  weekdays: Weekday[];
  startTime: LocalTime;
  durationMinutes: number;
  seasonStart: LocalDate;
  /** null = open-ended. */
  seasonEnd: LocalDate | null;
  location?: string;
  contactName?: string;
  contactPhone?: string;
  dropoffParentId?: Id;
  pickupParentId?: Id;
  /** Dates to skip — cancelled practice, holiday. Occurrences are expanded on
   *  the fly, never stored, so this is how a single date gets removed. */
  exceptions?: LocalDate[];
}

export const EXPENSE_CATEGORIES = [
  'clothes',
  'school',
  'food',
  'medical',
  'activities',
  'gifts',
  'transport',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Always expressed as the share the NON-paying parent owes, so there is exactly
 * one reading of every past entry:
 *   even     → other owes 50%
 *   all_mine → other owes 0%  ("I'm absorbing this, don't bill them")
 *   custom   → other owes N%
 */
export type SplitRule =
  | { type: 'even' }
  | { type: 'all_mine' }
  | { type: 'custom'; otherOwesPercent: number };

export interface ExpenseEntry extends EntryBase {
  kind: 'expense';
  description: string;
  amountCents: Cents;
  date: LocalDate;
  category: ExpenseCategory;
  paidByParentId: Id;
  split: SplitRule;
  reimbursed: boolean;
  reimbursedAt?: Instant;
}

export type Entry = PlanEntry | ActivityEntry | ExpenseEntry;

export type EntryKind = Entry['kind'];

// ── Audit log ───────────────────────────────────────────────────────────────

/**
 * Append-only. `createdBy` on an entry is self-asserted — a device simply says
 * which parent it is, and nothing verifies that. This log doesn't fix that, but
 * it does make edits and deletions visible rather than silent, which is the
 * most that's achievable without accounts.
 */
export interface AuditRecord {
  id: Id;
  at: Instant;
  byParentId: Id;
  action: 'create' | 'update' | 'delete' | 'restore' | 'settle' | 'household';
  entryId?: Id;
  /** Human-readable, e.g. "Deleted expense: Soccer cleats $64.00". */
  summary: string;
}

export const AUDIT_LIMIT = 500;

// ── The blob document ───────────────────────────────────────────────────────

/**
 * One blob per family, holding everything.
 *
 * Netlify Blobs has no multi-key transaction, so one blob means one ETag means
 * one serialization point — a compare-and-swap commit is genuinely atomic. It
 * also means a single GET returns the entire app state, so all filtering,
 * search, balance maths and CSV export run client-side with no round trip.
 */
export interface FamilyState {
  schemaVersion: 1;
  household: Household;
  entries: Entry[];
  audit: AuditRecord[];
  updatedAt: Instant;
}

export const SCHEMA_VERSION = 1 as const;

// ── Mutation ops ────────────────────────────────────────────────────────────

/**
 * Every write goes through `applyOps` (shared/ops.ts), which both the server
 * (inside the CAS loop) and the client (for its optimistic update) run. They
 * therefore cannot disagree about what an op means.
 */
export type Op =
  | { type: 'upsertEntry'; entry: Entry }
  | { type: 'deleteEntry'; id: Id }
  | { type: 'restoreEntry'; id: Id }
  | { type: 'setReimbursed'; ids: Id[]; reimbursed: boolean }
  | { type: 'updateHousehold'; patch: HouseholdPatch };

export interface HouseholdPatch {
  timezone?: string;
  parents?: [Parent, Parent];
  kids?: Kid[];
}

/** Envelope sent to POST /api/mutate. */
export interface MutateRequest {
  actorParentId: Id;
  /** Client clock, applied to createdAt/updatedAt inside the reducer so retries
   *  produce identical results. */
  now: Instant;
  ops: Op[];
}

// ── API wire shapes ─────────────────────────────────────────────────────────

export interface StateResponse {
  state: FamilyState;
  rev: string;
}

export interface CreateHouseholdResponse extends StateResponse {
  familyCode: string;
}

export type ApiErrorCode =
  | 'not_found'
  | 'invalid_input'
  | 'conflict'
  | 'too_large'
  | 'rate_limited'
  | 'server_error';

export interface ApiError {
  error: ApiErrorCode;
  message?: string;
}
