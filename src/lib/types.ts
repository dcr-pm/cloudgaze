export type MemberRole = "parent" | "grandparent" | "caregiver";
export type MemberPermission = "log_only" | "view_expenses" | "full";
export type EntryType = "activity" | "expense" | "routine";
export type EntrySource = "text" | "voice" | "receipt" | "routine";

export type Profile = { id: string; display_name: string; simple_mode: boolean };

export type Child = {
  id: string;
  name: string;
  birthdate: string | null;
  photo_url: string | null;
};

export type Member = {
  child_id: string;
  user_id: string;
  role: MemberRole;
  permission: MemberPermission;
  display_name: string;
};

export type RoutineSchedule = { days: number[]; time?: string };

export type Routine = {
  id: string;
  child_id: string;
  name: string;
  schedule: RoutineSchedule;
  sort_order: number;
  archived_at: string | null;
};

export type Entry = {
  id: string;
  child_id: string;
  author_id: string;
  type: EntryType;
  title: string;
  note: string | null;
  occurred_at: string;
  amount: number | null;
  currency: string;
  category: string | null;
  receipt_url: string | null;
  routine_id: string | null;
  group_id: string | null;
  source: EntrySource;
  deleted_at: string | null;
  created_at: string;
  /** Number of recorded edits; > 0 shows the "edited" marker. */
  edit_count: number;
  /** Client-only: optimistic state while the insert is in flight. */
  pending?: boolean;
  failed?: boolean;
};

export type EntryEdit = {
  id: string;
  entry_id: string;
  editor_id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  edited_at: string;
};

/** An entry proposed by the parser, shown on the confirm card before saving. */
export type Draft = {
  id: string;
  child_id: string;
  type: EntryType;
  title: string;
  note: string | null;
  amount: number | null;
  currency: string;
  category: string | null;
  occurred_at: string;
  routine_id: string | null;
  group_id: string | null;
  source: EntrySource;
  receipt_url?: string | null;
};

export const ROLE_LABEL: Record<MemberRole, string> = {
  parent: "Parent",
  grandparent: "Grandparent",
  caregiver: "Caregiver",
};

export const PERMISSION_LABEL: Record<MemberPermission, string> = {
  log_only: "Can log",
  view_expenses: "Can log and see expenses",
  full: "Full access",
};

export const PERMISSION_HELP: Record<MemberPermission, string> = {
  log_only: "Adds entries and sees activities and routines. Doesn't see what others spent.",
  view_expenses: "Adds entries and sees everything, including expenses and receipts.",
  full: "Everything, plus editing any entry and managing the circle and routines.",
};

const RANK: Record<MemberPermission, number> = { log_only: 0, view_expenses: 1, full: 2 };
export const can = (have: MemberPermission | undefined, need: MemberPermission) =>
  have !== undefined && RANK[have] >= RANK[need];
