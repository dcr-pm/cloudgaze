import { useState } from 'react';
import { EXPENSE_CATEGORY_TILES, SPLIT_LABELS } from '../../../shared/constants';
import type { ExpenseCategory, ExpenseEntry, SplitRule } from '../../../shared/types';
import { useHousehold } from '../../state/useAppState';
import { loadPrefs, savePrefs } from '../../state/localCache';
import { nowInstant, today } from '../../lib/dates';
import { centsToInput, formatCents, parseCents } from '../../lib/money';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { AmountField, TextField, TextAreaField, Field, INPUT_CLASS } from '../ui/Field';
import { EmojiTilePicker } from '../ui/EmojiTilePicker';
import { KidPicker, ParentPicker } from '../ui/Chips';

interface ExpenseFormProps {
  existing: ExpenseEntry | null;
  onClose: () => void;
}

type SplitKind = SplitRule['type'];

export function ExpenseForm({ existing, onClose }: ExpenseFormProps) {
  const { household, deviceParentId, otherParent, upsert, dispatch } = useHousehold();
  const prefs = loadPrefs();

  const [category, setCategory] = useState<ExpenseCategory>(
    existing?.category ?? 'other',
  );
  const [description, setDescription] = useState(existing?.description ?? '');
  const [amount, setAmount] = useState(
    existing ? centsToInput(existing.amountCents) : '',
  );
  const [date, setDate] = useState(existing?.date ?? today());
  const [kidIds, setKidIds] = useState<string[]>(
    existing?.kidIds ??
      prefs.lastKidIds?.filter((id) => household.kids.some((k) => k.id === id)) ??
      household.kids.filter((k) => !k.archived).map((k) => k.id),
  );
  // Defaults to this device's parent — you're almost always logging your own
  // spending.
  const [paidByParentId, setPaidBy] = useState(
    existing?.paidByParentId ?? deviceParentId,
  );

  const [splitKind, setSplitKind] = useState<SplitKind>(
    existing?.split.type ?? 'even',
  );
  const [customPercent, setCustomPercent] = useState(
    existing?.split.type === 'custom' ? String(existing.split.otherOwesPercent) : '50',
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const amountCents = parseCents(amount);
  const amountError =
    amount.trim() !== '' && amountCents === null
      ? 'Enter an amount like 64.50'
      : '';
  const trimmedDescription = description.trim();
  const canSave =
    trimmedDescription.length > 0 && amountCents !== null && amountCents > 0 && kidIds.length > 0;

  const split: SplitRule =
    splitKind === 'custom'
      ? {
          type: 'custom',
          otherOwesPercent: Math.min(100, Math.max(0, Number(customPercent) || 0)),
        }
      : { type: splitKind };

  const previewOwed =
    amountCents !== null
      ? Math.round(
          (amountCents *
            (split.type === 'even' ? 50 : split.type === 'all_mine' ? 0 : split.otherOwesPercent)) /
            100,
        )
      : 0;

  function save() {
    if (!canSave || amountCents === null) return;
    const now = nowInstant();

    const entry: ExpenseEntry = {
      kind: 'expense',
      id: existing?.id ?? crypto.randomUUID(),
      kidIds,
      createdAt: existing?.createdAt ?? now,
      createdByParentId: existing?.createdByParentId ?? deviceParentId,
      updatedAt: now,
      updatedByParentId: deviceParentId,
      description: trimmedDescription,
      amountCents,
      date,
      category,
      paidByParentId,
      split,
      reimbursed: existing?.reimbursed ?? false,
      ...(existing?.reimbursedAt ? { reimbursedAt: existing.reimbursedAt } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    savePrefs({ ...prefs, lastKidIds: kidIds });
    upsert(entry);
    onClose();
  }

  function remove() {
    if (!existing) return;
    dispatch([{ type: 'deleteEntry', id: existing.id }]);
    onClose();
  }

  const payer = household.parents.find((p) => p.id === paidByParentId);
  const nonPayer = household.parents.find((p) => p.id !== paidByParentId);

  return (
    <Sheet
      title={existing ? 'Edit expense' : 'Add an expense'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {existing && (
            <Button variant="ghost" onClick={remove} className="text-red-600">
              Delete
            </Button>
          )}
          <Button full disabled={!canSave} onClick={save}>
            {existing ? 'Save changes' : 'Add expense'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <AmountField
          value={amount}
          autoFocus={!existing}
          error={amountError}
          onChange={(e) => setAmount(e.target.value)}
        />

        <TextField
          label="What was it?"
          value={description}
          placeholder="Soccer cleats"
          onChange={(e) => setDescription(e.target.value)}
        />

        <EmojiTilePicker
          label="Category"
          tiles={EXPENSE_CATEGORY_TILES}
          value={category}
          onChange={setCategory}
        />

        <KidPicker kids={household.kids} selected={kidIds} onChange={setKidIds} />

        <Field label="Date">
          {(id) => (
            <input
              id={id}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || today())}
              className={INPUT_CLASS}
            />
          )}
        </Field>

        <ParentPicker
          parents={household.parents}
          value={paidByParentId}
          onChange={(id) => id && setPaidBy(id)}
          allowNone={false}
          deviceParentId={deviceParentId}
          label="Who paid?"
        />

        <fieldset>
          <legend className="block text-sm font-medium text-slate-700">
            How is it split?
          </legend>
          <div className="mt-2 space-y-2">
            {(['even', 'all_mine', 'custom'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setSplitKind(kind)}
                aria-pressed={splitKind === kind}
                className={[
                  'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-medium transition',
                  splitKind === kind
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/30'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                    splitKind === kind
                      ? 'border-indigo-600 bg-indigo-600'
                      : 'border-slate-300',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {splitKind === kind && (
                    <span className="size-1.5 rounded-full bg-white" />
                  )}
                </span>
                {SPLIT_LABELS[kind]}
              </button>
            ))}
          </div>

          {splitKind === 'custom' && (
            <div className="mt-3">
              {/* Labelled from the non-payer's side, always. An ambiguous
                  label here guarantees the two of them eventually disagree
                  about what a past entry meant. */}
              <Field
                label={`Percentage ${nonPayer?.name ?? 'the other parent'} owes`}
              >
                {(id) => (
                  <div className="relative">
                    <input
                      id={id}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={customPercent}
                      onChange={(e) => setCustomPercent(e.target.value)}
                      className={`${INPUT_CLASS} pr-8`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      %
                    </span>
                  </div>
                )}
              </Field>
            </div>
          )}
        </fieldset>

        {amountCents !== null && amountCents > 0 && payer && nonPayer && (
          <p className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-700">
            {previewOwed === 0 ? (
              <>
                <strong>{payer.name}</strong> covers this. Nothing billed to{' '}
                {nonPayer.name}.
              </>
            ) : (
              <>
                <strong>{nonPayer.name}</strong> owes {payer.name}{' '}
                <strong>{formatCents(previewOwed)}</strong>
                {paidByParentId === deviceParentId ? '' : ' — that’s you'}
              </>
            )}
          </p>
        )}

        <TextAreaField
          label="Notes"
          value={notes}
          placeholder="Size 4, replaced the outgrown pair"
          onChange={(e) => setNotes(e.target.value)}
        />

        {otherParent && !existing && (
          <p className="text-xs text-slate-500">
            {otherParent.name} will see this the next time they open the app.
          </p>
        )}
      </div>
    </Sheet>
  );
}
