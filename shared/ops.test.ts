import { describe, expect, it } from 'vitest';
import { applyOps, emptyState } from './ops';
import type {
  ExpenseEntry,
  FamilyState,
  Household,
  PlanEntry,
} from './types';

const P0 = 'parent-0';
const P1 = 'parent-1';
const KID = 'kid-0';

const T0 = '2026-08-01T10:00:00.000Z';
const T1 = '2026-08-02T10:00:00.000Z';
const T2 = '2026-08-03T10:00:00.000Z';

const household: Household = {
  id: 'hh',
  createdAt: T0,
  timezone: 'America/Denver',
  parents: [
    { id: P0, name: 'Sam', color: 'indigo' },
    { id: P1, name: 'Jordan', color: 'teal' },
  ],
  kids: [{ id: KID, name: 'Ellie' }],
};

const base = () => emptyState(household, T0);

function plan(over: Partial<PlanEntry> = {}): PlanEntry {
  return {
    kind: 'plan',
    id: 'p1',
    kidIds: [KID],
    createdAt: T0,
    createdByParentId: P0,
    updatedAt: T0,
    updatedByParentId: P0,
    title: 'Camping',
    category: 'camping',
    date: '2026-09-04',
    ...over,
  };
}

function expense(over: Partial<ExpenseEntry> = {}): ExpenseEntry {
  return {
    kind: 'expense',
    id: 'e1',
    kidIds: [KID],
    createdAt: T0,
    createdByParentId: P0,
    updatedAt: T0,
    updatedByParentId: P0,
    description: 'Cleats',
    amountCents: 6400,
    date: '2026-09-01',
    category: 'clothes',
    paidByParentId: P0,
    split: { type: 'even' },
    reimbursed: false,
    ...over,
  };
}

const ctx = (actor = P0, now = T1) => ({ actorParentId: actor, now });

describe('applyOps — purity and re-runnability', () => {
  it('is deterministic: the same inputs produce a deeply equal result', () => {
    // This is the property the CAS loop depends on — apply() is re-invoked from
    // scratch on every retry and must not drift.
    const ops = [{ type: 'upsertEntry' as const, entry: plan() }];
    const a = applyOps(base(), ops, ctx());
    const b = applyOps(base(), ops, ctx());
    expect(a).toEqual(b);
  });

  it('does not mutate the input state', () => {
    const state = base();
    const snapshot = structuredClone(state);
    applyOps(state, [{ type: 'upsertEntry', entry: plan() }], ctx());
    expect(state).toEqual(snapshot);
  });

  it('returns the identical object when nothing changed', () => {
    const state = base();
    const next = applyOps(state, [{ type: 'deleteEntry', id: 'nope' }], ctx());
    expect(next).toBe(state);
  });
});

describe('applyOps — upsertEntry', () => {
  it('adds a new entry and records an audit line', () => {
    const next = applyOps(base(), [{ type: 'upsertEntry', entry: plan() }], ctx());
    expect(next.entries).toHaveLength(1);
    expect(next.audit.at(-1)).toMatchObject({
      action: 'create',
      byParentId: P0,
      entryId: 'p1',
    });
    expect(next.audit.at(-1)!.summary).toContain('Camping');
  });

  it('preserves original authorship when the other parent edits', () => {
    const created = applyOps(
      base(),
      [{ type: 'upsertEntry', entry: plan() }],
      ctx(P0, T0),
    );
    const edited = applyOps(
      created,
      [{ type: 'upsertEntry', entry: plan({ title: 'Camping (moved)' }) }],
      ctx(P1, T1),
    );
    const e = edited.entries[0]!;
    // Who created it must survive an edit by the other parent — the record is
    // the point of the app.
    expect(e.createdByParentId).toBe(P0);
    expect(e.createdAt).toBe(T0);
    expect(e.updatedByParentId).toBe(P1);
    expect(e.updatedAt).toBe(T1);
    expect((e as PlanEntry).title).toBe('Camping (moved)');
  });

  it('is idempotent — replaying the same op does not duplicate', () => {
    // Offline queue replay depends on this.
    const op = { type: 'upsertEntry' as const, entry: plan() };
    const once = applyOps(base(), [op], ctx());
    const twice = applyOps(once, [op], ctx());
    expect(twice.entries).toHaveLength(1);
  });

  it('stamps the actor as creator even if the client claims otherwise', () => {
    const next = applyOps(
      base(),
      [{ type: 'upsertEntry', entry: plan({ createdByParentId: 'someone-else' }) }],
      ctx(P1),
    );
    expect(next.entries[0]!.createdByParentId).toBe(P1);
  });
});

describe('applyOps — delete and restore', () => {
  it('soft-deletes rather than dropping the row', () => {
    const created = applyOps(base(), [{ type: 'upsertEntry', entry: plan() }], ctx());
    const deleted = applyOps(created, [{ type: 'deleteEntry', id: 'p1' }], ctx(P1, T1));
    expect(deleted.entries).toHaveLength(1);
    expect(deleted.entries[0]!.deletedAt).toBe(T1);
    expect(deleted.audit.at(-1)).toMatchObject({ action: 'delete', byParentId: P1 });
  });

  it('restores a soft-deleted entry and clears deletedAt', () => {
    let s = applyOps(base(), [{ type: 'upsertEntry', entry: plan() }], ctx());
    s = applyOps(s, [{ type: 'deleteEntry', id: 'p1' }], ctx(P0, T1));
    s = applyOps(s, [{ type: 'restoreEntry', id: 'p1' }], ctx(P0, T2));
    expect(s.entries[0]!.deletedAt).toBeUndefined();
    expect(s.audit.at(-1)!.action).toBe('restore');
  });

  it('ignores a delete of an already-deleted entry', () => {
    let s = applyOps(base(), [{ type: 'upsertEntry', entry: plan() }], ctx());
    s = applyOps(s, [{ type: 'deleteEntry', id: 'p1' }], ctx(P0, T1));
    const auditLen = s.audit.length;
    const again = applyOps(s, [{ type: 'deleteEntry', id: 'p1' }], ctx(P0, T2));
    expect(again.audit).toHaveLength(auditLen);
  });

  it('purges soft-deleted entries past the 90-day window', () => {
    let s = applyOps(base(), [{ type: 'upsertEntry', entry: plan() }], ctx(P0, T0));
    s = applyOps(s, [{ type: 'deleteEntry', id: 'p1' }], ctx(P0, T0));
    expect(s.entries).toHaveLength(1);

    // Any later write sweeps expired tombstones.
    const muchLater = '2027-01-01T00:00:00.000Z';
    const swept = applyOps(
      s,
      [{ type: 'upsertEntry', entry: plan({ id: 'p2' }) }],
      ctx(P0, muchLater),
    );
    expect(swept.entries.map((e) => e.id)).toEqual(['p2']);
  });
});

describe('applyOps — setReimbursed', () => {
  const withExpenses = (): FamilyState =>
    applyOps(
      base(),
      [
        { type: 'upsertEntry', entry: expense({ id: 'e1' }) },
        { type: 'upsertEntry', entry: expense({ id: 'e2', description: 'Shoes' }) },
      ],
      ctx(P0, T0),
    );

  it('settles several expenses in one commit with a single audit line', () => {
    const next = applyOps(
      withExpenses(),
      [{ type: 'setReimbursed', ids: ['e1', 'e2'], reimbursed: true }],
      ctx(P1, T1),
    );
    const expenses = next.entries.filter(
      (e): e is ExpenseEntry => e.kind === 'expense',
    );
    expect(expenses.every((e) => e.reimbursed)).toBe(true);
    expect(expenses.every((e) => e.reimbursedAt === T1)).toBe(true);
    expect(next.audit.at(-1)).toMatchObject({ action: 'settle' });
    expect(next.audit.at(-1)!.summary).toContain('2 expenses');
  });

  it('clears reimbursedAt when reopening', () => {
    let s = applyOps(
      withExpenses(),
      [{ type: 'setReimbursed', ids: ['e1'], reimbursed: true }],
      ctx(P0, T1),
    );
    s = applyOps(s, [{ type: 'setReimbursed', ids: ['e1'], reimbursed: false }], ctx(P0, T2));
    const e = s.entries.find((x) => x.id === 'e1') as ExpenseEntry;
    expect(e.reimbursed).toBe(false);
    expect(e.reimbursedAt).toBeUndefined();
  });

  it('writes no audit line when nothing actually changed', () => {
    const s = withExpenses();
    const len = s.audit.length;
    const next = applyOps(
      s,
      [{ type: 'setReimbursed', ids: ['e1'], reimbursed: false }],
      ctx(P0, T1),
    );
    expect(next.audit).toHaveLength(len);
  });

  it('does not touch non-expense entries that share an id list', () => {
    let s = applyOps(base(), [{ type: 'upsertEntry', entry: plan({ id: 'x' }) }], ctx());
    s = applyOps(s, [{ type: 'setReimbursed', ids: ['x'], reimbursed: true }], ctx());
    expect(s.entries[0]!.kind).toBe('plan');
  });
});

describe('applyOps — household and audit', () => {
  it('applies a partial household patch without clobbering the rest', () => {
    const next = applyOps(
      base(),
      [{ type: 'updateHousehold', patch: { timezone: 'Europe/London' } }],
      ctx(),
    );
    expect(next.household.timezone).toBe('Europe/London');
    expect(next.household.parents).toEqual(household.parents);
    expect(next.household.kids).toEqual(household.kids);
  });

  it('caps the audit log so the document cannot grow without bound', () => {
    let s = base();
    for (let i = 0; i < 600; i++) {
      s = applyOps(
        s,
        [{ type: 'upsertEntry', entry: plan({ id: `p${i}` }) }],
        ctx(P0, T1),
      );
    }
    expect(s.audit.length).toBeLessThanOrEqual(500);
    // The most recent activity is what survives.
    expect(s.audit.at(-1)!.entryId).toBe('p599');
  });

  it('applies a batch of ops in order', () => {
    const next = applyOps(
      base(),
      [
        { type: 'upsertEntry', entry: plan({ id: 'a' }) },
        { type: 'upsertEntry', entry: plan({ id: 'b' }) },
        { type: 'deleteEntry', id: 'a' },
      ],
      ctx(),
    );
    expect(next.entries.find((e) => e.id === 'a')!.deletedAt).toBe(T1);
    expect(next.entries.find((e) => e.id === 'b')!.deletedAt).toBeUndefined();
  });
});
