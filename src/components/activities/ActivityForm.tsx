import { useState } from 'react';
import { ACTIVITY_EMOJI, WEEKDAYS } from '../../../shared/constants';
import type { ActivityEntry, Weekday } from '../../../shared/types';
import { useHousehold } from '../../state/useAppState';
import { nowInstant, today } from '../../lib/dates';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { TextField, TextAreaField, Field, INPUT_CLASS } from '../ui/Field';
import { EmojiChoice } from '../ui/EmojiTilePicker';
import { KidPicker, ParentPicker } from '../ui/Chips';

interface ActivityFormProps {
  existing: ActivityEntry | null;
  onClose: () => void;
}

const DURATIONS = [30, 45, 60, 75, 90, 120, 180];

export function ActivityForm({ existing, onClose }: ActivityFormProps) {
  const { household, deviceParentId, upsert, dispatch } = useHousehold();

  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '⚽');
  const [kidIds, setKidIds] = useState<string[]>(
    existing?.kidIds ?? household.kids.filter((k) => !k.archived).map((k) => k.id),
  );
  const [weekdays, setWeekdays] = useState<Weekday[]>(existing?.weekdays ?? []);
  const [startTime, setStartTime] = useState(existing?.startTime ?? '17:00');
  const [durationMinutes, setDuration] = useState(existing?.durationMinutes ?? 60);
  const [seasonStart, setSeasonStart] = useState(existing?.seasonStart ?? today());
  const [seasonEnd, setSeasonEnd] = useState(existing?.seasonEnd ?? '');
  const [openEnded, setOpenEnded] = useState(
    existing ? existing.seasonEnd === null : false,
  );

  const [showMore, setShowMore] = useState(
    Boolean(
      existing?.location ||
        existing?.contactName ||
        existing?.dropoffParentId ||
        existing?.notes,
    ),
  );
  const [location, setLocation] = useState(existing?.location ?? '');
  const [contactName, setContactName] = useState(existing?.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(existing?.contactPhone ?? '');
  const [dropoffParentId, setDropoff] = useState<string | undefined>(
    existing?.dropoffParentId,
  );
  const [pickupParentId, setPickup] = useState<string | undefined>(
    existing?.pickupParentId,
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const trimmedName = name.trim();
  const seasonError =
    !openEnded && seasonEnd && seasonEnd < seasonStart
      ? 'The season ends before it starts'
      : '';
  const canSave =
    trimmedName.length > 0 && kidIds.length > 0 && weekdays.length > 0 && !seasonError;

  function toggleDay(day: Weekday) {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function save() {
    if (!canSave) return;
    const now = nowInstant();

    const entry: ActivityEntry = {
      kind: 'activity',
      id: existing?.id ?? crypto.randomUUID(),
      kidIds,
      createdAt: existing?.createdAt ?? now,
      createdByParentId: existing?.createdByParentId ?? deviceParentId,
      updatedAt: now,
      updatedByParentId: deviceParentId,
      name: trimmedName,
      emoji,
      weekdays,
      startTime,
      durationMinutes,
      seasonStart,
      seasonEnd: openEnded || !seasonEnd ? null : seasonEnd,
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
      ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
      ...(dropoffParentId ? { dropoffParentId } : {}),
      ...(pickupParentId ? { pickupParentId } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(existing?.exceptions ? { exceptions: existing.exceptions } : {}),
    };

    upsert(entry);
    onClose();
  }

  function endSeason() {
    if (!existing) return;
    // Ending a season is kinder than deleting: the history of where the kid was
    // every Tuesday stays in the record.
    upsert({ ...existing, seasonEnd: today(), updatedAt: nowInstant() });
    onClose();
  }

  function remove() {
    if (!existing) return;
    dispatch([{ type: 'deleteEntry', id: existing.id }]);
    onClose();
  }

  return (
    <Sheet
      title={existing ? 'Edit activity' : 'Add an activity'}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <Button full disabled={!canSave} onClick={save}>
            {existing ? 'Save changes' : 'Add activity'}
          </Button>
          {existing && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" full onClick={endSeason}>
                End season today
              </Button>
              <Button variant="ghost" size="sm" full onClick={remove} className="text-red-600">
                Delete
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <TextField
          label="Activity"
          value={name}
          autoFocus={!existing}
          placeholder="Soccer practice"
          onChange={(e) => setName(e.target.value)}
        />

        <EmojiChoice
          label="Icon"
          options={ACTIVITY_EMOJI}
          value={emoji}
          onChange={setEmoji}
        />

        <KidPicker kids={household.kids} selected={kidIds} onChange={setKidIds} />

        <fieldset>
          <legend className="block text-sm font-medium text-slate-700">
            Which days?
          </legend>
          <div className="mt-2 flex gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = weekdays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  aria-pressed={on}
                  aria-label={d.long}
                  className={[
                    'flex size-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition',
                    on
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts at">
            {(id) => (
              <input
                id={id}
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value || '17:00')}
                className={INPUT_CLASS}
              />
            )}
          </Field>
          <Field label="For how long">
            {(id) => (
              <select
                id={id}
                value={durationMinutes}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={INPUT_CLASS}
              >
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? 's' : ''}`}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <Field label="Season starts">
            {(id) => (
              <input
                id={id}
                type="date"
                value={seasonStart}
                onChange={(e) => setSeasonStart(e.target.value || today())}
                className={INPUT_CLASS}
              />
            )}
          </Field>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={openEnded}
              onChange={(e) => setOpenEnded(e.target.checked)}
              className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            No end date — this runs indefinitely
          </label>

          {!openEnded && (
            <div className="mt-3">
              <Field label="Season ends" error={seasonError}>
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    value={seasonEnd}
                    min={seasonStart}
                    onChange={(e) => setSeasonEnd(e.target.value)}
                    className={INPUT_CLASS}
                  />
                )}
              </Field>
              <p className="mt-1 text-xs text-slate-500">
                Once the season ends it stops filling up the calendar.
              </p>
            </div>
          )}
        </div>

        {!showMore ? (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            + More details (location, coach, who drives)
          </button>
        ) : (
          <div className="space-y-5 border-t border-slate-200 pt-5">
            <TextField
              label="Location"
              value={location}
              placeholder="Riverside Fields, Pitch 3"
              onChange={(e) => setLocation(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Coach"
                value={contactName}
                placeholder="Coach Dana"
                onChange={(e) => setContactName(e.target.value)}
              />
              <TextField
                label="Phone"
                type="tel"
                inputMode="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <ParentPicker
              parents={household.parents}
              value={dropoffParentId}
              onChange={setDropoff}
              deviceParentId={deviceParentId}
              label="Usually drops off"
            />
            <ParentPicker
              parents={household.parents}
              value={pickupParentId}
              onChange={setPickup}
              deviceParentId={deviceParentId}
              label="Usually picks up"
            />
            <TextAreaField
              label="Notes"
              value={notes}
              placeholder="Shin pads and a full water bottle"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}
