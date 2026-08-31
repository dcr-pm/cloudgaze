import type { Cents } from '../../shared/types';

/**
 * Money is integer cents everywhere. `0.1 + 0.2 !== 0.3` is not acceptable in a
 * ledger two people are going to argue over, so floats exist only in the string
 * the user typed and never in stored or accumulated values.
 */

/**
 * Parse user input ("64", "64.5", "$64.50", "1,299.99") to cents.
 * Returns null for anything that isn't a usable amount.
 */
export function parseCents(input: string): Cents | null {
  const cleaned = input.replace(/[$£€\s,]/g, '').trim();
  if (!cleaned) return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;

  const [whole = '', frac = ''] = cleaned.split('.');
  if (whole === '' && frac === '') return null;
  if (frac.length > 2) return null;

  const dollars = whole === '' ? 0 : Number(whole);
  const cents = frac === '' ? 0 : Number(frac.padEnd(2, '0'));
  if (!Number.isFinite(dollars) || !Number.isFinite(cents)) return null;

  const total = dollars * 100 + cents;
  if (!Number.isSafeInteger(total) || total < 0) return null;
  return total;
}

/** "$142.50" — respects the viewer's locale. */
export function formatCents(cents: Cents, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/** "64.50" — for prefilling an edit field, without a currency symbol. */
export function centsToInput(cents: Cents): string {
  return (cents / 100).toFixed(2);
}
