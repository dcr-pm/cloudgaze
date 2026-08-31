import type {
  ActivityEntry,
  Entry,
  Id,
  LocalDate,
  PlanEntry,
} from '../../shared/types';
import { datesInRange } from './dates';
import { expandActivities, type ActivityOccurrence } from './recurrence';

/**
 * Merges one-off plans and expanded recurring occurrences into the shape both
 * the month grid and the Upcoming list need.
 *
 * A multi-day plan behaves differently in the two views on purpose: it appears
 * on every day it spans in the grid (so a camping weekend reads as a block),
 * but only once in the list (so it doesn't bury everything else).
 */

export interface PlanItem {
  kind: 'plan';
  id: string;
  plan: PlanEntry;
  date: LocalDate;
  /** For a multi-day plan: which day of the span this is, and how long it runs. */
  spanIndex: number;
  spanLength: number;
}

export type AgendaItem = PlanItem | ActivityOccurrence;

export function isPlanItem(item: AgendaItem): item is PlanItem {
  return item.kind === 'plan';
}

export function livePlans(entries: readonly Entry[]): PlanEntry[] {
  return entries.filter((e): e is PlanEntry => e.kind === 'plan' && !e.deletedAt);
}

export function liveActivities(entries: readonly Entry[]): ActivityEntry[] {
  return entries.filter(
    (e): e is ActivityEntry => e.kind === 'activity' && !e.deletedAt,
  );
}

function sortKey(item: AgendaItem): string {
  // All-day and untimed items sort to the top of their day.
  const time = isPlanItem(item) ? (item.plan.startTime ?? '') : item.startTime;
  return `${item.date} ${time.padStart(5, '0')}`;
}

/** Every day a plan occupies, for the grid. */
function planDates(plan: PlanEntry): LocalDate[] {
  if (!plan.endDate || plan.endDate <= plan.date) return [plan.date];
  return datesInRange(plan.date, plan.endDate);
}

/**
 * Day-keyed map for the month grid. Multi-day plans are repeated on each day
 * they cover.
 */
export function buildDayMap(
  entries: readonly Entry[],
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
): Map<LocalDate, AgendaItem[]> {
  const map = new Map<LocalDate, AgendaItem[]>();
  const push = (date: LocalDate, item: AgendaItem) => {
    if (date < rangeStart || date > rangeEnd) return;
    const bucket = map.get(date);
    if (bucket) bucket.push(item);
    else map.set(date, [item]);
  };

  for (const plan of livePlans(entries)) {
    const dates = planDates(plan);
    dates.forEach((date, i) => {
      push(date, {
        kind: 'plan',
        id: dates.length > 1 ? `${plan.id}@${date}` : plan.id,
        plan,
        date,
        spanIndex: i,
        spanLength: dates.length,
      });
    });
  }

  for (const occ of expandActivities(liveActivities(entries), rangeStart, rangeEnd)) {
    push(occ.date, occ);
  }

  for (const bucket of map.values()) {
    bucket.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }
  return map;
}

/**
 * Flat chronological list for the Upcoming view. Multi-day plans appear once,
 * on their start date (or on `from`, if they're already underway).
 */
export function buildAgenda(
  entries: readonly Entry[],
  from: LocalDate,
  to: LocalDate,
): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const plan of livePlans(entries)) {
    const start = plan.date;
    const end = plan.endDate && plan.endDate > start ? plan.endDate : start;
    // Include anything overlapping the window, not just starting in it — a trip
    // that began yesterday is still the most relevant thing today.
    if (end < from || start > to) continue;
    const dates = planDates(plan);
    items.push({
      kind: 'plan',
      id: plan.id,
      plan,
      date: start < from ? from : start,
      spanIndex: 0,
      spanLength: dates.length,
    });
  }

  items.push(...expandActivities(liveActivities(entries), from, to));

  return items.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

/** Groups an agenda into consecutive day buckets, preserving order. */
export function groupByDay(items: readonly AgendaItem[]): [LocalDate, AgendaItem[]][] {
  const out: [LocalDate, AgendaItem[]][] = [];
  for (const item of items) {
    const last = out.at(-1);
    if (last && last[0] === item.date) last[1].push(item);
    else out.push([item.date, [item]]);
  }
  return out;
}

/** Kid filter applied consistently across grid and list. */
export function filterByKid(
  items: readonly AgendaItem[],
  kidId: Id | null,
): AgendaItem[] {
  if (!kidId) return [...items];
  return items.filter((item) =>
    isPlanItem(item)
      ? item.plan.kidIds.includes(kidId)
      : item.activity.kidIds.includes(kidId),
  );
}
