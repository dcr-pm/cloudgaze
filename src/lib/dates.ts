import type { LocalDate, LocalTime, Weekday } from '../../shared/types';

/**
 * Local-date helpers.
 *
 * Two rules run through all of this:
 *
 *  1. Never call `new Date("2026-08-31")`. Bare date strings are parsed as UTC,
 *     which lands on the previous day for anyone west of Greenwich.
 *
 *  2. Anchor at local NOON, never midnight. Midnight does not exist on
 *     DST spring-forward days in some zones (America/Santiago, Asia/Beirut),
 *     where the clock jumps 23:59 → 01:00, so a midnight-anchored date can
 *     silently shift or vanish. Noon is safe in every IANA zone.
 *
 * `YYYY-MM-DD` sorts lexicographically in calendar order, so plain string
 * comparison is a correct date comparison and most of this file never needs a
 * Date object at all.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function atNoon(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function toLocalDate(d: Date): LocalDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): LocalDate {
  return toLocalDate(new Date());
}

export function nowInstant(): string {
  return new Date().toISOString();
}

export function currentTime(): LocalTime {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = atNoon(date);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

export function addMonths(date: LocalDate, months: number): LocalDate {
  const d = atNoon(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return toLocalDate(d);
}

export function weekdayOf(date: LocalDate): Weekday {
  return atNoon(date).getDay() as Weekday;
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((atNoon(b).getTime() - atNoon(a).getTime()) / 86_400_000);
}

/** Inclusive list of dates from `start` to `end`. */
export function datesInRange(start: LocalDate, end: LocalDate): LocalDate[] {
  if (end < start) return [];
  const out: LocalDate[] = [];
  const cur = atNoon(start);
  const stop = atNoon(end);
  while (cur <= stop) {
    out.push(toLocalDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ── Month helpers ───────────────────────────────────────────────────────────

/** "2026-08" */
export type MonthKey = string;

export function monthKeyOf(date: LocalDate): MonthKey {
  return date.slice(0, 7);
}

export function currentMonthKey(): MonthKey {
  return monthKeyOf(today());
}

export function isValidMonthKey(s: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return false;
  const year = Number(s.slice(0, 4));
  return year >= 1970 && year <= 2999;
}

export function firstOfMonth(month: MonthKey): LocalDate {
  return `${month}-01`;
}

export function lastOfMonth(month: MonthKey): LocalDate {
  const [y, m] = month.split('-').map(Number) as [number, number];
  // Day 0 of the next month is the last day of this one.
  return toLocalDate(new Date(y, m, 0, 12));
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 + delta, 1, 12);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/**
 * The six-week grid a month calendar renders, always 42 days so the layout
 * doesn't jump between months.
 */
export interface MonthGridDay {
  date: LocalDate;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  weekday: Weekday;
}

export function buildMonthGrid(month: MonthKey, todayDate = today()): MonthGridDay[] {
  const first = firstOfMonth(month);
  const leading = weekdayOf(first); // days of the previous month to show
  const start = addDays(first, -leading);
  return datesInRange(start, addDays(start, 41)).map((date) => ({
    date,
    dayOfMonth: Number(date.slice(8)),
    inMonth: date.slice(0, 7) === month,
    isToday: date === todayDate,
    weekday: weekdayOf(date),
  }));
}

// ── Formatting ──────────────────────────────────────────────────────────────

/** "Mon 31 Aug" */
export function formatDateShort(date: LocalDate, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(atNoon(date));
}

/** "Monday, 31 August 2026" */
export function formatDateLong(date: LocalDate): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(atNoon(date));
}

/** "August 2026" */
export function formatMonth(month: MonthKey): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(atNoon(firstOfMonth(month)));
}

/** "5:00pm" — respects the viewer's 12/24h locale preference. */
export function formatTime(time: LocalTime): string {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const d = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

/** "5:00 – 6:00pm" or just the start when there is no end. */
export function formatTimeRange(start?: LocalTime, end?: LocalTime): string {
  if (!start) return '';
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

export function addMinutesToTime(time: LocalTime, minutes: number): LocalTime {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const total = h * 60 + m + minutes;
  // Clamp rather than wrap: an activity that would run past midnight ends at
  // 23:59 instead of appearing to start the previous morning.
  const clamped = Math.min(total, 23 * 60 + 59);
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

/** "Today", "Tomorrow", "Yesterday", else a short date. */
export function relativeDayLabel(date: LocalDate, todayDate = today()): string {
  const diff = daysBetween(todayDate, date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDateShort(date);
}

/** Combines a local date and time into a real instant, for ordering. */
export function atLocal(date: LocalDate, time: LocalTime = '00:00'): Date {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

/** The device's IANA zone, used to seed household setup. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
