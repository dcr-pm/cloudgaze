export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function isToday(iso: string): boolean {
  return startOfDay(new Date(iso)) === startOfDay(new Date());
}

/** "Today", "Yesterday", "Monday" or "Mon, Nov 2". */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

/** "Today 4:42 PM" or "Mon, Nov 2, 4:42 PM". */
export function when(iso: string): string {
  return `${dayLabel(iso)} ${clock(iso)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO instant -> value for <input type="datetime-local">, in the device's time zone. */
export function toInputValue(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromInputValue(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
export const initial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

export const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || "USD";
