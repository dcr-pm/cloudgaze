import { useMemo, useState } from 'react';
import {
  EXPENSE_CATEGORY_TILES,
  PARENT_COLOR_CLASSES,
  expenseCategoryTile,
} from '../../../shared/constants';
import type { ExpenseEntry, Id } from '../../../shared/types';
import { useHousehold } from '../../state/useAppState';
import { useNavigation } from '../../state/useHashRoute';
import { formatDateShort } from '../../lib/dates';
import { formatCents } from '../../lib/money';
import { computeBalance, otherOwesCents } from '../../lib/balance';
import { downloadFile, expensesToCsv } from '../../lib/csv';
import { PageHeader, Fab, EmptyState } from '../shell/AppShell';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { KidFilter } from '../shell/KidFilter';
import { ExpenseForm } from './ExpenseForm';

type Scope = 'outstanding' | 'all';

export function ExpensesTab() {
  const { entries, household, deviceParentId } = useHousehold();
  const { route, openSheet, closeSheet } = useNavigation();

  const [kidFilter, setKidFilter] = useState<Id | null>(null);
  const [scope, setScope] = useState<Scope>('outstanding');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const allExpenses = useMemo(
    () =>
      entries
        .filter((e): e is ExpenseEntry => e.kind === 'expense' && !e.deletedAt)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  );

  // The balance always reflects the whole household, never the current filter —
  // a number that silently changed with a filter would be actively misleading.
  const balance = useMemo(
    () => computeBalance(allExpenses, household.parents),
    [allExpenses, household.parents],
  );

  const visible = useMemo(
    () =>
      allExpenses
        .filter((e) => (scope === 'outstanding' ? !e.reimbursed : true))
        .filter((e) => !kidFilter || e.kidIds.includes(kidFilter))
        .filter((e) => !categoryFilter || e.category === categoryFilter),
    [allExpenses, scope, kidFilter, categoryFilter],
  );

  function exportCsv() {
    downloadFile(
      `expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      expensesToCsv(allExpenses, household.parents, household.kids),
    );
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        actions={
          allExpenses.length > 0 && (
            <Button size="sm" variant="secondary" onClick={exportCsv}>
              Export
            </Button>
          )
        }
      />

      <div className="mx-auto max-w-lg space-y-4 py-3">
        <div className="px-3">
          <BalanceHeader
            balance={balance}
            deviceParentId={deviceParentId}
            parents={household.parents}
            onSettle={() => openSheet('settle')}
          />
        </div>

        <KidFilter kids={household.kids} value={kidFilter} onChange={setKidFilter} />

        <div className="flex gap-2 px-3">
          <SegButton active={scope === 'outstanding'} onClick={() => setScope('outstanding')}>
            Outstanding
          </SegButton>
          <SegButton active={scope === 'all'} onClick={() => setScope('all')}>
            All
          </SegButton>
        </div>

        <div className="flex gap-2 overflow-x-auto px-3 pb-1">
          <CatPill active={!categoryFilter} onClick={() => setCategoryFilter(null)}>
            All categories
          </CatPill>
          {EXPENSE_CATEGORY_TILES.map((t) => (
            <CatPill
              key={t.value}
              active={categoryFilter === t.value}
              onClick={() =>
                setCategoryFilter(categoryFilter === t.value ? null : t.value)
              }
            >
              <span aria-hidden="true">{t.emoji}</span> {t.label}
            </CatPill>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            emoji="💰"
            title={
              allExpenses.length === 0 ? 'No expenses yet' : 'Nothing matches those filters'
            }
            body={
              allExpenses.length === 0
                ? 'Log what you spend on the kids and the running balance keeps itself up to date.'
                : 'Try widening the filters.'
            }
            {...(allExpenses.length === 0
              ? {
                  action: (
                    <Button onClick={() => openSheet('new-expense')}>
                      Add an expense
                    </Button>
                  ),
                }
              : {})}
          />
        ) : (
          <ul className="space-y-2 px-3">
            {visible.map((e) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                onOpen={() => openSheet(`expense/${e.id}`)}
              />
            ))}
          </ul>
        )}
      </div>

      <Fab label="Add an expense" onClick={() => openSheet('new-expense')} />

      <ExpenseSheets sheet={route.sheet} onClose={closeSheet} />
    </>
  );
}

function BalanceHeader({
  balance,
  deviceParentId,
  parents,
  onSettle,
}: {
  balance: ReturnType<typeof computeBalance>;
  deviceParentId: Id;
  parents: readonly [{ id: Id; name: string; color: string }, ...unknown[]];
  onSettle: () => void;
}) {
  void parents;
  const square = balance.netCents === 0;
  const youOwe = balance.debtorId === deviceParentId;

  return (
    <div
      className={[
        'rounded-2xl border p-4',
        square
          ? 'border-slate-200 bg-white'
          : youOwe
            ? 'border-amber-200 bg-amber-50'
            : 'border-emerald-200 bg-emerald-50',
      ].join(' ')}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Running balance
      </p>
      <p
        className={[
          'mt-1 text-2xl font-semibold tabular-nums',
          square ? 'text-slate-700' : youOwe ? 'text-amber-900' : 'text-emerald-900',
        ].join(' ')}
      >
        {square ? balance.label : formatCents(balance.amountCents)}
      </p>
      {!square && <p className="mt-0.5 text-sm text-slate-600">{balance.label}</p>}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {balance.unreimbursedCount === 0
            ? 'Nothing outstanding'
            : `${balance.unreimbursedCount} unsettled · ${formatCents(balance.outstandingTotalCents)} total spend`}
        </p>
        {balance.unreimbursedCount > 0 && (
          <Button size="sm" variant="secondary" onClick={onSettle}>
            Settle up
          </Button>
        )}
      </div>
    </div>
  );
}

function ExpenseRow({
  expense,
  onOpen,
}: {
  expense: ExpenseEntry;
  onOpen: () => void;
}) {
  const { household, deviceParentId } = useHousehold();
  const tile = expenseCategoryTile(expense.category);
  const payer = household.parents.find((p) => p.id === expense.paidByParentId);
  const owed = otherOwesCents(expense);
  const youPaid = expense.paidByParentId === deviceParentId;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={[
          'flex w-full items-start gap-3 rounded-xl border bg-white px-3 py-3 text-left transition',
          'hover:border-slate-300 hover:bg-slate-50',
          expense.reimbursed ? 'border-slate-200 opacity-60' : 'border-slate-200',
        ].join(' ')}
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl"
          aria-hidden="true"
        >
          {tile.emoji}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-medium text-slate-900">
              {expense.description}
            </span>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums text-slate-900">
              {formatCents(expense.amountCents)}
            </span>
          </span>

          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span>{formatDateShort(expense.date)}</span>
            {payer && (
              <span className="inline-flex items-center gap-1">
                <span
                  className={`size-1.5 rounded-full ${PARENT_COLOR_CLASSES[payer.color].dot}`}
                  aria-hidden="true"
                />
                {youPaid ? 'You paid' : `${payer.name} paid`}
              </span>
            )}
            {expense.reimbursed ? (
              <span className="font-medium text-emerald-600">✓ Settled</span>
            ) : owed === 0 ? (
              <span>not billed</span>
            ) : (
              <span>
                {youPaid ? 'owed to you' : 'you owe'} {formatCents(owed)}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function SettleUpSheet({ onClose }: { onClose: () => void }) {
  const { entries, household, dispatch } = useHousehold();

  const outstanding = entries.filter(
    (e): e is ExpenseEntry => e.kind === 'expense' && !e.deletedAt && !e.reimbursed,
  );
  const balance = computeBalance(outstanding, household.parents);

  function settle() {
    // One batch, so it lands as a single atomic commit and a single audit line.
    dispatch([
      {
        type: 'setReimbursed',
        ids: outstanding.map((e) => e.id),
        reimbursed: true,
      },
    ]);
    onClose();
  }

  return (
    <Sheet
      title="Settle up"
      onClose={onClose}
      footer={
        <Button full disabled={outstanding.length === 0} onClick={settle}>
          Mark all {outstanding.length} as settled
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-100 p-4 text-center">
          <p className="text-sm text-slate-600">{balance.label}</p>
          {balance.netCents !== 0 && (
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {formatCents(balance.amountCents)}
            </p>
          )}
        </div>

        <p className="text-sm leading-relaxed text-slate-600">
          This marks every outstanding expense as settled and resets the balance
          to zero. It doesn&rsquo;t move any money — do that however you normally
          would, then record it here.
        </p>

        <ul className="space-y-1.5">
          {outstanding.map((e) => (
            <li
              key={e.id}
              className="flex justify-between gap-3 text-sm text-slate-600"
            >
              <span className="truncate">{e.description}</span>
              <span className="shrink-0 tabular-nums">
                {formatCents(e.amountCents)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition',
        active
          ? 'bg-slate-900 text-white'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function CatPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition',
        active
          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function ExpenseSheets({
  sheet,
  onClose,
}: {
  sheet: string | null;
  onClose: () => void;
}) {
  const { entries } = useHousehold();
  if (!sheet) return null;

  const parts = sheet.split('/');

  if (parts[0] === 'new-expense') {
    return <ExpenseForm existing={null} onClose={onClose} />;
  }

  if (parts[0] === 'settle') {
    return <SettleUpSheet onClose={onClose} />;
  }

  if (parts[0] === 'expense' && parts[1]) {
    const expense = entries.find(
      (e): e is ExpenseEntry =>
        e.kind === 'expense' && e.id === parts[1] && !e.deletedAt,
    );
    if (!expense) return null;
    return <ExpenseForm existing={expense} onClose={onClose} />;
  }

  return null;
}
