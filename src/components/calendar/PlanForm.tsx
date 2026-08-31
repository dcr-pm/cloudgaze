import { useState } from 'react';
import { PLAN_CATEGORY_TILES } from '../../../shared/constants';
import type { LocalDate, PlanCategory, PlanEntry } from '../../../shared/types';
import { useHousehold } from '../../state/useAppState';
import { loadPrefs, savePrefs } from '../../state/localCache';
import { nowInstant, today } from '../../lib/dates';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { TextField, TextAreaField, Field, INPUT_CLASS } from '../ui/Field';
import { EmojiTilePicker } from '../ui/EmojiTilePicker';
import { KidPicker, ParentPicker } from '../ui/Chips';

interface PlanFormProps {
  /** Editing an existing plan, or null to create a new one. */
  existing: PlanEntry | null;
  /** Prefills the date, e.g. when opened from a tapped calendar day. */
  initialDate?: LocalDate;
  initialCategory?: PlanCategory;
  onClose: () => void;
}

/**
 * The fast path is deliberately short: category tile, kids, title, date. Nine
 * fields cannot be filled in fifteen seconds, so everything else lives behind
 * "More details" and stays out of the way until it's wanted.
 */
export function PlanForm({
  existing,
  initialDate,
  initialCategory,
  onClose,
}: PlanFormProps) {
  const { household, deviceParentId, upsert, dispatch } = useHousehold();
  const prefs = loadPrefs();

  const [category, setCategory] = useState<PlanCategory>(
    existing?.category ?? initialCategory ?? 'event',
  );
  const [title, setTitle] = useState(existing?.title ?? '');
  const [kidIds, setKidIds] = useState<string[]>(
    existing?.kidIds ??
      prefs.lastKidIds?.filter((id) => household.kids.some((k) => k.id === id)) ??
      household.kids.filter((k) => !k.archived).map((k) => k.id),
  );
  const [date, setDate] = useState<LocalDate>(
    existing?.date ?? initialDate ?? today(),
  );

  const [showMore, setShowMore] = useState(
    Boolean(
      existing?.endDate ||
        existing?.startTime ||
        existing?.location ||
        existing?.notes ||
        existing?.withParentId,
    ),
  );
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [startTime, setStartTime] = useState(existing?.startTime ?? '');
  const [endTime, setEndTime] = useState(existing?.endTime ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [withParentId, setWithParentId] = useState<string | undefined>(
    existing?.withParentId ?? (existing ? undefined : deviceParentId),
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const trimmedTitle = title.trim();
  const dateError = endDate && endDate < date ? 'End date is before the start' : '';
  const canSave = trimmedTitle.length > 0 && kidIds.length > 0 && !dateError;

  function save() {
    if (!canSave) return;
    const now = nowInstant();

    const entry: PlanEntry = {
      kind: 'plan',
      id: existing?.id ?? crypto.randomUUID(),
      kidIds,
      createdAt: existing?.createdAt ?? now,
      createdByParentId: existing?.createdByParentId ?? deviceParentId,
      updatedAt: now,
      updatedByParentId: deviceParentId,
      title: trimmedTitle,
      category,
      date,
      ...(endDate && endDate > date ? { endDate } : {}),
      ...(startTime ? { startTime } : {}),
      ...(endTime && startTime ? { endTime } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(withParentId ? { withParentId } : {}),
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

  return (
    <Sheet
      title={existing ? 'Edit plan' : 'Add a plan'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {existing && (
            <Button variant="ghost" onClick={remove} className="text-red-600">
              Delete
            </Button>
          )}
          <Button full disabled={!canSave} onClick={save}>
            {existing ? 'Save changes' : 'Add plan'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <EmojiTilePicker
          label="What is it?"
          tiles={PLAN_CATEGORY_TILES}
          value={category}
          onChange={setCategory}
        />

        <TextField
          label="Title"
          value={title}
          autoFocus={!existing}
          placeholder="Camping at Bear Lake"
          onChange={(e) => setTitle(e.target.value)}
        />

        <KidPicker
          kids={household.kids}
          selected={kidIds}
          onChange={setKidIds}
        />

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

        {!showMore ? (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            + More details (time, location, who has them)
          </button>
        ) : (
          <div className="space-y-5 border-t border-slate-200 pt-5">
            <ParentPicker
              parents={household.parents}
              value={withParentId}
              onChange={setWithParentId}
              deviceParentId={deviceParentId}
              label={
                category === 'handoff'
                  ? 'Handing over to'
                  : 'Who has the kids for this?'
              }
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts">
                {(id) => (
                  <input
                    id={id}
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={INPUT_CLASS}
                  />
                )}
              </Field>
              <Field label="Ends">
                {(id) => (
                  <input
                    id={id}
                    type="time"
                    value={endTime}
                    disabled={!startTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={`${INPUT_CLASS} disabled:bg-slate-50 disabled:text-slate-400`}
                  />
                )}
              </Field>
            </div>

            <Field
              label="Last day"
              hint="For anything spanning several days, like a trip."
              error={dateError}
            >
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={endDate}
                  min={date}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={INPUT_CLASS}
                />
              )}
            </Field>

            <TextField
              label="Location"
              value={location}
              placeholder="Bear Lake State Park"
              hint="Tap it later to open in Maps."
              onChange={(e) => setLocation(e.target.value)}
            />

            <TextAreaField
              label="Notes"
              value={notes}
              placeholder="Bring the blue sleeping bag"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}
