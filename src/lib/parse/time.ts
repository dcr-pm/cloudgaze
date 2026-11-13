const pad = (n: number) => String(n).padStart(2, "0");
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "2026-11-13T16:42" in the user's local time, for an instant and a UTC offset. */
export function toLocalString(instantIso: string, utcOffsetMinutes: number): string {
  const d = new Date(new Date(instantIso).getTime() + utcOffsetMinutes * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function localWeekday(instantIso: string, utcOffsetMinutes: number): string {
  const d = new Date(new Date(instantIso).getTime() + utcOffsetMinutes * 60_000);
  return DAYS[d.getUTCDay()];
}

/**
 * Converts "YYYY-MM-DDTHH:mm" (or "YYYY-MM-DD", read as noon) in the user's
 * local time to an ISO instant. Returns null if it isn't a real date.
 */
export function localToInstant(local: string | null | undefined, utcOffsetMinutes: number): string | null {
  if (!local) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(local.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [h, mi] = m[4] ? [Number(m[4]), Number(m[5])] : [12, 0];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const utc = Date.UTC(y, mo - 1, d, h, mi);
  // Reject dates that rolled over, like Feb 31.
  if (new Date(utc).getUTCDate() !== d) return null;
  return new Date(utc - utcOffsetMinutes * 60_000).toISOString();
}
