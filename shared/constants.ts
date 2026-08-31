import type {
  ExpenseCategory,
  ParentColor,
  PlanCategory,
  Weekday,
} from './types';

// ── Plan categories ─────────────────────────────────────────────────────────

export interface CategoryTile<T extends string> {
  value: T;
  emoji: string;
  label: string;
}

export const PLAN_CATEGORY_TILES: readonly CategoryTile<PlanCategory>[] = [
  { value: 'handoff', emoji: '🏠', label: 'Handoff' },
  { value: 'school', emoji: '🏫', label: 'School' },
  { value: 'doctor', emoji: '🏥', label: 'Doctor' },
  { value: 'event', emoji: '🎪', label: 'Event' },
  { value: 'camping', emoji: '🏕️', label: 'Camping' },
  { value: 'travel', emoji: '✈️', label: 'Travel' },
  { value: 'birthday', emoji: '🎂', label: 'Birthday' },
  { value: 'sleepover', emoji: '💤', label: 'Sleepover' },
  { value: 'shopping', emoji: '🛍️', label: 'Shopping' },
  { value: 'dinner', emoji: '🍽️', label: 'Dinner out' },
  { value: 'movie', emoji: '🎬', label: 'Movie' },
  { value: 'other', emoji: '📌', label: 'Other' },
] as const;

const PLAN_TILE_BY_VALUE = new Map(PLAN_CATEGORY_TILES.map((t) => [t.value, t]));

export function planCategoryTile(c: PlanCategory): CategoryTile<PlanCategory> {
  return PLAN_TILE_BY_VALUE.get(c) ?? PLAN_CATEGORY_TILES[11]!;
}

// ── Expense categories ──────────────────────────────────────────────────────

export const EXPENSE_CATEGORY_TILES: readonly CategoryTile<ExpenseCategory>[] = [
  { value: 'clothes', emoji: '👟', label: 'Clothes' },
  { value: 'school', emoji: '📚', label: 'School' },
  { value: 'food', emoji: '🍎', label: 'Food' },
  { value: 'medical', emoji: '🏥', label: 'Medical' },
  { value: 'activities', emoji: '⚽', label: 'Activities' },
  { value: 'gifts', emoji: '🎁', label: 'Gifts' },
  { value: 'transport', emoji: '🚗', label: 'Transport' },
  { value: 'other', emoji: '📌', label: 'Other' },
] as const;

const EXPENSE_TILE_BY_VALUE = new Map(
  EXPENSE_CATEGORY_TILES.map((t) => [t.value, t]),
);

export function expenseCategoryTile(
  c: ExpenseCategory,
): CategoryTile<ExpenseCategory> {
  return EXPENSE_TILE_BY_VALUE.get(c) ?? EXPENSE_CATEGORY_TILES[7]!;
}

// ── Activity emoji suggestions ──────────────────────────────────────────────

export const ACTIVITY_EMOJI = [
  '⚽',
  '🤸',
  '🏊',
  '🎹',
  '🥋',
  '🎨',
  '🏀',
  '⚾',
  '🎾',
  '🏐',
  '🩰',
  '🎭',
  '🎸',
  '🎤',
  '🛹',
  '🚴',
  '🏇',
  '🧗',
  '♟️',
  '📖',
] as const;

// ── Weekdays ────────────────────────────────────────────────────────────────

export const WEEKDAYS: readonly { value: Weekday; short: string; long: string }[] =
  [
    { value: 0, short: 'S', long: 'Sunday' },
    { value: 1, short: 'M', long: 'Monday' },
    { value: 2, short: 'T', long: 'Tuesday' },
    { value: 3, short: 'W', long: 'Wednesday' },
    { value: 4, short: 'T', long: 'Thursday' },
    { value: 5, short: 'F', long: 'Friday' },
    { value: 6, short: 'S', long: 'Saturday' },
  ] as const;

/** "Tue & Thu", "Mon, Wed & Fri", "Every day". */
export function formatWeekdays(days: readonly Weekday[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return 'No days set';
  if (sorted.length === 7) return 'Every day';
  const names = sorted.map((d) => WEEKDAYS[d]!.long.slice(0, 3));
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

// ── Parent colours ──────────────────────────────────────────────────────────

/**
 * Tailwind scans source text statically, so `bg-parent-${color}` is never
 * generated. Every class string has to appear here as a literal.
 */
export interface ParentColorClasses {
  bg: string;
  bgSoft: string;
  text: string;
  border: string;
  ring: string;
  dot: string;
}

export const PARENT_COLOR_CLASSES: Record<ParentColor, ParentColorClasses> = {
  indigo: {
    bg: 'bg-parent-indigo',
    bgSoft: 'bg-parent-indigo-soft',
    text: 'text-parent-indigo',
    border: 'border-parent-indigo',
    ring: 'ring-parent-indigo',
    dot: 'bg-parent-indigo',
  },
  teal: {
    bg: 'bg-parent-teal',
    bgSoft: 'bg-parent-teal-soft',
    text: 'text-parent-teal',
    border: 'border-parent-teal',
    ring: 'ring-parent-teal',
    dot: 'bg-parent-teal',
  },
  rose: {
    bg: 'bg-parent-rose',
    bgSoft: 'bg-parent-rose-soft',
    text: 'text-parent-rose',
    border: 'border-parent-rose',
    ring: 'ring-parent-rose',
    dot: 'bg-parent-rose',
  },
  amber: {
    bg: 'bg-parent-amber',
    bgSoft: 'bg-parent-amber-soft',
    text: 'text-parent-amber',
    border: 'border-parent-amber',
    ring: 'ring-parent-amber',
    dot: 'bg-parent-amber',
  },
  violet: {
    bg: 'bg-parent-violet',
    bgSoft: 'bg-parent-violet-soft',
    text: 'text-parent-violet',
    border: 'border-parent-violet',
    ring: 'ring-parent-violet',
    dot: 'bg-parent-violet',
  },
  emerald: {
    bg: 'bg-parent-emerald',
    bgSoft: 'bg-parent-emerald-soft',
    text: 'text-parent-emerald',
    border: 'border-parent-emerald',
    ring: 'ring-parent-emerald',
    dot: 'bg-parent-emerald',
  },
};

export const PARENT_COLOR_LABELS: Record<ParentColor, string> = {
  indigo: 'Indigo',
  teal: 'Teal',
  rose: 'Rose',
  amber: 'Amber',
  violet: 'Violet',
  emerald: 'Emerald',
};

// ── Split rules ─────────────────────────────────────────────────────────────

/** Labels are deliberately explicit about who owes what — an ambiguous label
 *  guarantees the two parents eventually disagree about what a past entry meant. */
export const SPLIT_LABELS = {
  even: 'Split 50/50',
  all_mine: "All mine (don't bill)",
  custom: 'Custom split',
} as const;

export const KID_EMOJI = [
  '🦖',
  '🐙',
  '🦊',
  '🐼',
  '🦋',
  '🐢',
  '🦉',
  '🐝',
  '🦄',
  '🐧',
  '🌻',
  '⭐',
] as const;
