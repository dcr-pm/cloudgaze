import { describe, expect, it } from 'vitest';
import { computeBalance, otherOwesCents, expenseImpact } from './balance';
import { parseCents, formatCents, centsToInput } from './money';
import type { ExpenseEntry, Parent } from '../../shared/types';

const SAM: Parent = { id: 'p0', name: 'Sam', color: 'indigo' };
const JORDAN: Parent = { id: 'p1', name: 'Jordan', color: 'teal' };
const PARENTS: [Parent, Parent] = [SAM, JORDAN];

let seq = 0;
function expense(over: Partial<ExpenseEntry> = {}): ExpenseEntry {
  return {
    kind: 'expense',
    id: `e${seq++}`,
    kidIds: ['kid'],
    createdAt: '2026-08-01T00:00:00.000Z',
    createdByParentId: 'p0',
    updatedAt: '2026-08-01T00:00:00.000Z',
    updatedByParentId: 'p0',
    description: 'Thing',
    amountCents: 10000,
    date: '2026-08-01',
    category: 'other',
    paidByParentId: SAM.id,
    split: { type: 'even' },
    reimbursed: false,
    ...over,
  };
}

describe('otherOwesCents', () => {
  it('splits evenly', () => {
    expect(otherOwesCents(expense({ amountCents: 6400 }))).toBe(3200);
  });

  it('bills nothing for "all mine"', () => {
    expect(
      otherOwesCents(expense({ amountCents: 6400, split: { type: 'all_mine' } })),
    ).toBe(0);
  });

  it('applies a custom percentage', () => {
    expect(
      otherOwesCents(
        expense({ amountCents: 10000, split: { type: 'custom', otherOwesPercent: 30 } }),
      ),
    ).toBe(3000);
  });

  it('rounds a half-cent to the nearest cent', () => {
    // 501 / 2 = 250.5 → 251
    expect(otherOwesCents(expense({ amountCents: 501 }))).toBe(251);
    // 33.333% of 10000 = 3333.3 → 3333
    expect(
      otherOwesCents(
        expense({
          amountCents: 10000,
          split: { type: 'custom', otherOwesPercent: 33.333 },
        }),
      ),
    ).toBe(3333);
  });

  it('clamps an out-of-range custom percentage', () => {
    expect(
      otherOwesCents(
        expense({ amountCents: 1000, split: { type: 'custom', otherOwesPercent: 150 } }),
      ),
    ).toBe(1000);
    expect(
      otherOwesCents(
        expense({ amountCents: 1000, split: { type: 'custom', otherOwesPercent: -10 } }),
      ),
    ).toBe(0);
  });
});

describe('computeBalance', () => {
  it('reports nothing outstanding for an empty ledger', () => {
    const b = computeBalance([], PARENTS);
    expect(b).toMatchObject({ netCents: 0, label: 'Nothing outstanding' });
  });

  it('names the debtor and creditor correctly when Sam paid', () => {
    // Sam paid $100, split evenly → Jordan owes Sam $50.
    const b = computeBalance([expense({ amountCents: 10000 })], PARENTS);
    expect(b.debtorId).toBe(JORDAN.id);
    expect(b.creditorId).toBe(SAM.id);
    expect(b.amountCents).toBe(5000);
    expect(b.label).toBe('Jordan owes Sam $50.00');
  });

  it('reverses when Jordan paid', () => {
    const b = computeBalance(
      [expense({ amountCents: 10000, paidByParentId: JORDAN.id })],
      PARENTS,
    );
    expect(b.debtorId).toBe(SAM.id);
    expect(b.label).toBe('Sam owes Jordan $50.00');
  });

  it('nets opposing expenses against each other', () => {
    // Sam paid $100 (Jordan owes 50); Jordan paid $60 (Sam owes 30). Net: 20 to Sam.
    const b = computeBalance(
      [
        expense({ amountCents: 10000, paidByParentId: SAM.id }),
        expense({ amountCents: 6000, paidByParentId: JORDAN.id }),
      ],
      PARENTS,
    );
    expect(b.netCents).toBe(2000);
    expect(b.label).toBe('Jordan owes Sam $20.00');
  });

  it('reports "All square" when equal and opposite', () => {
    const b = computeBalance(
      [
        expense({ amountCents: 10000, paidByParentId: SAM.id }),
        expense({ amountCents: 10000, paidByParentId: JORDAN.id }),
      ],
      PARENTS,
    );
    expect(b.netCents).toBe(0);
    expect(b.label).toBe('All square');
    expect(b.unreimbursedCount).toBe(2);
  });

  it('excludes reimbursed and deleted expenses', () => {
    const b = computeBalance(
      [
        expense({ amountCents: 10000, reimbursed: true }),
        expense({ amountCents: 10000, deletedAt: '2026-08-05T00:00:00.000Z' }),
        expense({ amountCents: 4000 }),
      ],
      PARENTS,
    );
    expect(b.amountCents).toBe(2000);
    expect(b.unreimbursedCount).toBe(1);
  });

  it('counts an "all mine" expense as outstanding but not owed', () => {
    // It happened and belongs in the record; it just isn't billed.
    const b = computeBalance(
      [expense({ amountCents: 6400, split: { type: 'all_mine' } })],
      PARENTS,
    );
    expect(b.netCents).toBe(0);
    expect(b.unreimbursedCount).toBe(1);
    expect(b.outstandingTotalCents).toBe(6400);
    expect(b.label).toBe('All square');
  });

  it('ignores an expense paid by an unknown parent', () => {
    const b = computeBalance(
      [expense({ amountCents: 10000, paidByParentId: 'ghost' })],
      PARENTS,
    );
    expect(b.netCents).toBe(0);
    expect(b.unreimbursedCount).toBe(0);
  });

  it('matches a hand-computed mixed ledger', () => {
    // Sam:    $64.00 even            → Jordan owes 32.00
    // Sam:    $120.00 @ 25% custom   → Jordan owes 30.00
    // Jordan: $45.50 even            → Sam owes    22.75
    // Jordan: $80.00 all mine        → nobody owes  0.00
    // Sam:    $200.00 even, settled  → excluded
    // Net to Sam: 32.00 + 30.00 - 22.75 = 39.25
    const b = computeBalance(
      [
        expense({ amountCents: 6400, paidByParentId: SAM.id }),
        expense({
          amountCents: 12000,
          paidByParentId: SAM.id,
          split: { type: 'custom', otherOwesPercent: 25 },
        }),
        expense({ amountCents: 4550, paidByParentId: JORDAN.id }),
        expense({
          amountCents: 8000,
          paidByParentId: JORDAN.id,
          split: { type: 'all_mine' },
        }),
        expense({ amountCents: 20000, paidByParentId: SAM.id, reimbursed: true }),
      ],
      PARENTS,
    );
    expect(b.netCents).toBe(3925);
    expect(b.label).toBe('Jordan owes Sam $39.25');
    expect(b.unreimbursedCount).toBe(4);
    expect(b.outstandingTotalCents).toBe(6400 + 12000 + 4550 + 8000);
  });

  it('stays exact across many odd amounts', () => {
    // Floats would drift here; integers must not.
    const many = Array.from({ length: 300 }, (_, i) =>
      expense({ amountCents: 1 + (i % 7), paidByParentId: SAM.id }),
    );
    const b = computeBalance(many, PARENTS);
    const expected = many.reduce((sum, e) => sum + otherOwesCents(e), 0);
    expect(b.netCents).toBe(expected);
    expect(Number.isInteger(b.netCents)).toBe(true);
  });
});

describe('expenseImpact', () => {
  it('reports direction from the viewer’s side', () => {
    const e = expense({ amountCents: 10000, paidByParentId: SAM.id });
    expect(expenseImpact(e, SAM.id)).toEqual({
      owedCents: 5000,
      direction: 'owed_to_you',
    });
    expect(expenseImpact(e, JORDAN.id)).toEqual({
      owedCents: 5000,
      direction: 'you_owe',
    });
  });

  it('reports none for settled or unbilled expenses', () => {
    expect(expenseImpact(expense({ reimbursed: true }), SAM.id).direction).toBe('none');
    expect(
      expenseImpact(expense({ split: { type: 'all_mine' } }), SAM.id).direction,
    ).toBe('none');
  });
});

describe('money', () => {
  it('parses the shapes people actually type', () => {
    expect(parseCents('64')).toBe(6400);
    expect(parseCents('64.5')).toBe(6450);
    expect(parseCents('64.50')).toBe(6450);
    expect(parseCents('$64.50')).toBe(6450);
    expect(parseCents('1,299.99')).toBe(129999);
    expect(parseCents('.99')).toBe(99);
    expect(parseCents('0')).toBe(0);
  });

  it('rejects what it cannot represent exactly', () => {
    expect(parseCents('')).toBeNull();
    expect(parseCents('abc')).toBeNull();
    expect(parseCents('64.505')).toBeNull(); // sub-cent precision
    expect(parseCents('-5')).toBeNull();
    expect(parseCents('1.2.3')).toBeNull();
  });

  it('round-trips through the edit field', () => {
    for (const cents of [0, 1, 99, 100, 6450, 129999]) {
      expect(parseCents(centsToInput(cents))).toBe(cents);
    }
  });

  it('formats as currency', () => {
    expect(formatCents(6450)).toBe('$64.50');
    expect(formatCents(0)).toBe('$0.00');
  });
});
