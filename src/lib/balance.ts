import type { Cents, ExpenseEntry, Id, Parent } from '../../shared/types';
import { formatCents } from './money';

/**
 * The running balance between the two parents.
 *
 * All arithmetic is on integer cents with exactly one rounding step per
 * expense — fractional cents are never accumulated, so the total always matches
 * what you'd get adding the displayed per-row shares by hand. That property
 * matters more here than in most ledgers, because two people who disagree will
 * check it by hand.
 */

export interface Balance {
  /** Positive → parents[1] owes parents[0]. Negative → the reverse. */
  netCents: Cents;
  debtorId: Id | null;
  creditorId: Id | null;
  /** Absolute value of netCents. */
  amountCents: Cents;
  /** "Jordan owes Sam $142.50" or "All square". */
  label: string;
  unreimbursedCount: number;
  /** Total of every unreimbursed expense, regardless of who owes what. */
  outstandingTotalCents: Cents;
}

/** The share the NON-paying parent owes, in whole cents. */
export function otherOwesCents(expense: ExpenseEntry): Cents {
  const pct =
    expense.split.type === 'even'
      ? 50
      : expense.split.type === 'all_mine'
        ? 0
        : Math.min(100, Math.max(0, expense.split.otherOwesPercent));

  // Round once, at the end, on integers.
  return Math.round((expense.amountCents * pct) / 100);
}

export function computeBalance(
  expenses: readonly ExpenseEntry[],
  parents: readonly [Parent, Parent],
): Balance {
  const [p0, p1] = parents;
  let net = 0; // positive => p1 owes p0
  let count = 0;
  let outstanding = 0;

  for (const e of expenses) {
    if (e.deletedAt || e.reimbursed) continue;

    const owed = otherOwesCents(e);
    if (e.paidByParentId === p0.id) {
      net += owed;
    } else if (e.paidByParentId === p1.id) {
      net -= owed;
    } else {
      // Paid by someone no longer in the household — ignore rather than
      // silently attributing it to a current parent.
      continue;
    }

    count++;
    outstanding += e.amountCents;
  }

  const amountCents = Math.abs(net);

  if (net === 0) {
    return {
      netCents: 0,
      debtorId: null,
      creditorId: null,
      amountCents: 0,
      label: count === 0 ? 'Nothing outstanding' : 'All square',
      unreimbursedCount: count,
      outstandingTotalCents: outstanding,
    };
  }

  const debtor = net > 0 ? p1 : p0;
  const creditor = net > 0 ? p0 : p1;

  return {
    netCents: net,
    debtorId: debtor.id,
    creditorId: creditor.id,
    amountCents,
    label: `${debtor.name} owes ${creditor.name} ${formatCents(amountCents)}`,
    unreimbursedCount: count,
    outstandingTotalCents: outstanding,
  };
}

/** Per-row helper: what this single expense contributes, from `viewerId`'s side. */
export function expenseImpact(
  expense: ExpenseEntry,
  viewerId: Id,
): { owedCents: Cents; direction: 'owed_to_you' | 'you_owe' | 'none' } {
  const owed = otherOwesCents(expense);
  if (owed === 0 || expense.reimbursed || expense.deletedAt) {
    return { owedCents: 0, direction: 'none' };
  }
  return {
    owedCents: owed,
    direction: expense.paidByParentId === viewerId ? 'owed_to_you' : 'you_owe',
  };
}
