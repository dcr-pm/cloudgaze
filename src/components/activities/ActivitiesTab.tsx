import { useMemo, useState } from 'react';
import { PARENT_COLOR_CLASSES, formatWeekdays } from '../../../shared/constants';
import type { ActivityEntry, Id } from '../../../shared/types';
import { useHousehold } from '../../state/useAppState';
import { useNavigation } from '../../state/useHashRoute';
import { formatDateShort, formatTime, addMinutesToTime, today } from '../../lib/dates';
import { seasonStatus } from '../../lib/recurrence';
import { mapsUrl, telUrl } from '../../lib/maps';
import { PageHeader, Fab, EmptyState } from '../shell/AppShell';
import { Button } from '../ui/Button';
import { KidFilter } from '../shell/KidFilter';
import { ActivityForm } from './ActivityForm';

export function ActivitiesTab() {
  const { entries, household } = useHousehold();
  const { route, openSheet, closeSheet } = useNavigation();
  const [kidFilter, setKidFilter] = useState<Id | null>(null);
  const [showEnded, setShowEnded] = useState(false);

  const todayDate = today();

  const { active, ended } = useMemo(() => {
    const all = entries
      .filter((e): e is ActivityEntry => e.kind === 'activity' && !e.deletedAt)
      .filter((a) => !kidFilter || a.kidIds.includes(kidFilter))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      active: all.filter((a) => seasonStatus(a, todayDate) !== 'ended'),
      ended: all.filter((a) => seasonStatus(a, todayDate) === 'ended'),
    };
  }, [entries, kidFilter, todayDate]);

  return (
    <>
      <PageHeader
        title="Activities"
        subtitle="Recurring commitments"
      />

      <div className="mx-auto max-w-lg space-y-4 py-3">
        <KidFilter kids={household.kids} value={kidFilter} onChange={setKidFilter} />

        {active.length === 0 && ended.length === 0 ? (
          <EmptyState
            emoji="🔁"
            title="No activities yet"
            body="Soccer on Tuesdays, swimming on Saturdays — add the regular things so both parents know the schedule."
            action={
              <Button onClick={() => openSheet('new-activity')}>Add an activity</Button>
            }
          />
        ) : (
          <div className="space-y-3 px-3">
            {active.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                todayDate={todayDate}
                onOpen={() => openSheet(`activity/${a.id}`)}
              />
            ))}

            {ended.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowEnded((v) => !v)}
                  className="text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  {showEnded ? '▾' : '▸'} Past seasons ({ended.length})
                </button>
                {showEnded && (
                  <div className="mt-3 space-y-3">
                    {ended.map((a) => (
                      <ActivityCard
                        key={a.id}
                        activity={a}
                        todayDate={todayDate}
                        onOpen={() => openSheet(`activity/${a.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Fab label="Add an activity" onClick={() => openSheet('new-activity')} />

      <ActivitySheets sheet={route.sheet} onClose={closeSheet} />
    </>
  );
}

function ActivityCard({
  activity,
  todayDate,
  onOpen,
}: {
  activity: ActivityEntry;
  todayDate: string;
  onOpen: () => void;
}) {
  const { household } = useHousehold();
  const status = seasonStatus(activity, todayDate);
  const kids = activity.kidIds
    .map((id) => household.kids.find((k) => k.id === id))
    .filter(Boolean);

  const dropoff = household.parents.find((p) => p.id === activity.dropoffParentId);
  const pickup = household.parents.find((p) => p.id === activity.pickupParentId);

  const endTime = addMinutesToTime(activity.startTime, activity.durationMinutes);

  return (
    <div
      className={[
        'rounded-2xl border bg-white p-4',
        status === 'ended' ? 'border-slate-200 opacity-60' : 'border-slate-200',
      ].join(' ')}
    >
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 text-left">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl"
          aria-hidden="true"
        >
          {activity.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-slate-900">
            {activity.name}
          </span>
          <span className="mt-0.5 block text-sm text-slate-600">
            {formatWeekdays(activity.weekdays)} · {formatTime(activity.startTime)} –{' '}
            {formatTime(endTime)}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
            {kids.map((k) => (
              <span key={k!.id}>
                {k!.emoji ? `${k!.emoji} ` : ''}
                {k!.name}
              </span>
            ))}
          </span>
        </span>
        {status === 'upcoming' && (
          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            Upcoming
          </span>
        )}
        {status === 'ended' && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            Ended
          </span>
        )}
      </button>

      <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <p>
          {status === 'upcoming'
            ? `Starts ${formatDateShort(activity.seasonStart)}`
            : activity.seasonEnd
              ? `Until ${formatDateShort(activity.seasonEnd)}`
              : 'No end date'}
        </p>

        {activity.location && (
          <p className="flex items-center gap-1">
            <span aria-hidden="true">📍</span>
            <a
              href={mapsUrl(activity.location)}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-slate-300 underline-offset-2 hover:text-indigo-600"
            >
              {activity.location}
            </a>
          </p>
        )}

        {activity.contactName && (
          <p className="flex items-center gap-1">
            <span aria-hidden="true">👤</span>
            {activity.contactPhone ? (
              <a
                href={telUrl(activity.contactPhone)}
                className="underline decoration-slate-300 underline-offset-2 hover:text-indigo-600"
              >
                {activity.contactName} · {activity.contactPhone}
              </a>
            ) : (
              <span>{activity.contactName}</span>
            )}
          </p>
        )}

        {(dropoff || pickup) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {dropoff && (
              <span className="inline-flex items-center gap-1">
                <span
                  className={`size-1.5 rounded-full ${PARENT_COLOR_CLASSES[dropoff.color].dot}`}
                  aria-hidden="true"
                />
                {dropoff.name} drops off
              </span>
            )}
            {pickup && (
              <span className="inline-flex items-center gap-1">
                <span
                  className={`size-1.5 rounded-full ${PARENT_COLOR_CLASSES[pickup.color].dot}`}
                  aria-hidden="true"
                />
                {pickup.name} picks up
              </span>
            )}
          </p>
        )}

        {activity.notes && <p className="text-slate-600">{activity.notes}</p>}
      </div>
    </div>
  );
}

function ActivitySheets({
  sheet,
  onClose,
}: {
  sheet: string | null;
  onClose: () => void;
}) {
  const { entries } = useHousehold();
  if (!sheet) return null;

  const parts = sheet.split('/');

  if (parts[0] === 'new-activity') {
    return <ActivityForm existing={null} onClose={onClose} />;
  }

  if (parts[0] === 'activity' && parts[1]) {
    const activity = entries.find(
      (e): e is ActivityEntry =>
        e.kind === 'activity' && e.id === parts[1] && !e.deletedAt,
    );
    if (!activity) return null;
    return <ActivityForm existing={activity} onClose={onClose} />;
  }

  return null;
}
