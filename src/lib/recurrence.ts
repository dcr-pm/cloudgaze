import type { ActivityEntry, Id, LocalDate, LocalTime, Weekday } from '../../shared/types';
import { addMinutesToTime, atNoon, toLocalDate } from './dates';

/**
 * Recurring activities are expanded on the fly for whatever window is visible,
 * never materialised as stored rows. That keeps the document small, makes
 * "change the time of soccer" a one-field edit rather than a bulk rewrite, and
 * means an open-ended season doesn't have to guess how far into the future to
 * generate.
 */

export interface ActivityOccurrence {
  kind: 'occurrence';
  /** `${activityId}@${date}` — stable and derivable, but never stored. */
  id: string;
  activityId: Id;
  activity: ActivityEntry;
  date: LocalDate;
  startTime: LocalTime;
  endTime: LocalTime;
}

/**
 * Every occurrence of every activity within [rangeStart, rangeEnd] inclusive,
 * sorted by date then start time.
 */
export function expandActivities(
  activities: readonly ActivityEntry[],
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
): ActivityOccurrence[] {
  const out: ActivityOccurrence[] = [];
  if (rangeEnd < rangeStart) return out;

  for (const activity of activities) {
    if (activity.deletedAt) continue;
    if (activity.weekdays.length === 0) continue;

    // Intersect the requested window with the season. YYYY-MM-DD compares
    // lexicographically in calendar order, so no Date objects are needed here.
    const from =
      activity.seasonStart > rangeStart ? activity.seasonStart : rangeStart;
    const to =
      activity.seasonEnd && activity.seasonEnd < rangeEnd
        ? activity.seasonEnd
        : rangeEnd;
    if (from > to) continue; // season doesn't overlap this window at all

    const days = new Set<Weekday>(activity.weekdays);
    const skip = new Set(activity.exceptions ?? []);
    const endTime = addMinutesToTime(activity.startTime, activity.durationMinutes);

    const cursor = atNoon(from);
    const stop = atNoon(to);
    while (cursor <= stop) {
      if (days.has(cursor.getDay() as Weekday)) {
        const date = toLocalDate(cursor);
        if (!skip.has(date)) {
          out.push({
            kind: 'occurrence',
            id: `${activity.id}@${date}`,
            activityId: activity.id,
            activity,
            date,
            startTime: activity.startTime,
            endTime,
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return out.sort((a, b) =>
    a.date === b.date
      ? a.startTime.localeCompare(b.startTime)
      : a.date.localeCompare(b.date),
  );
}

/** True when the activity's season covers `date` and it runs that weekday. */
export function activityRunsOn(activity: ActivityEntry, date: LocalDate): boolean {
  if (activity.deletedAt) return false;
  if (date < activity.seasonStart) return false;
  if (activity.seasonEnd && date > activity.seasonEnd) return false;
  if (activity.exceptions?.includes(date)) return false;
  return activity.weekdays.includes(atNoon(date).getDay() as Weekday);
}

/** "In season", "Ended 3 Jun", "Starts 1 Sep" — for the activity list. */
export function seasonStatus(
  activity: ActivityEntry,
  todayDate: LocalDate,
): 'upcoming' | 'active' | 'ended' {
  if (todayDate < activity.seasonStart) return 'upcoming';
  if (activity.seasonEnd && todayDate > activity.seasonEnd) return 'ended';
  return 'active';
}
