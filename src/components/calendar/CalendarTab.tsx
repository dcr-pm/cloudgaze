import { useMemo, useState } from 'react';
import type { LocalDate, PlanCategory, PlanEntry } from '../../../shared/types';
import { useHousehold } from '../../state/useAppState';
import { useNavigation } from '../../state/useHashRoute';
import {
  addDays,
  firstOfMonth,
  formatMonth,
  lastOfMonth,
  relativeDayLabel,
  shiftMonth,
  today,
} from '../../lib/dates';
import {
  buildAgenda,
  buildDayMap,
  filterByKid,
  groupByDay,
  isPlanItem,
  type AgendaItem,
} from '../../lib/agenda';
import { PageHeader, Fab, EmptyState } from '../shell/AppShell';
import { Button } from '../ui/Button';
import { MonthGrid } from './MonthGrid';
import { AgendaItemRow } from './AgendaItemRow';
import { CustodyBanner } from './CustodyBanner';
import { PlanForm } from './PlanForm';
import { ActivityForm } from '../activities/ActivityForm';
import { KidFilter } from '../shell/KidFilter';

const UPCOMING_DAYS = 60;

export function CalendarTab() {
  const { household, entries } = useHousehold();
  const { route, setMonth, openSheet, closeSheet } = useNavigation();

  const [kidFilter, setKidFilter] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<LocalDate | null>(null);

  const todayDate = today();
  const month = route.month;

  // The grid renders six weeks, so the window has to cover the leading and
  // trailing days from the neighbouring months too.
  const gridStart = addDays(firstOfMonth(month), -7);
  const gridEnd = addDays(lastOfMonth(month), 7);

  const dayMap = useMemo(() => {
    const raw = buildDayMap(entries, gridStart, gridEnd);
    if (!kidFilter) return raw;
    const filtered = new Map<LocalDate, AgendaItem[]>();
    for (const [date, items] of raw) {
      const kept = filterByKid(items, kidFilter);
      if (kept.length > 0) filtered.set(date, kept);
    }
    return filtered;
  }, [entries, gridStart, gridEnd, kidFilter]);

  const upcoming = useMemo(
    () =>
      groupByDay(
        filterByKid(
          buildAgenda(entries, todayDate, addDays(todayDate, UPCOMING_DAYS)),
          kidFilter,
        ),
      ),
    [entries, todayDate, kidFilter],
  );

  const selectedItems = selectedDay ? (dayMap.get(selectedDay) ?? []) : [];

  const parentById = useMemo(
    () => new Map(household.parents.map((p) => [p.id, p])),
    [household.parents],
  );
  const kidById = useMemo(
    () => new Map(household.kids.map((k) => [k.id, k])),
    [household.kids],
  );

  function openItem(item: AgendaItem) {
    openSheet(
      isPlanItem(item) ? `plan/${item.plan.id}` : `activity/${item.activityId}`,
    );
  }

  return (
    <>
      <PageHeader
        title={formatMonth(month)}
        actions={
          <div className="flex items-center gap-1">
            <NavButton label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
              ‹
            </NavButton>
            <button
              type="button"
              onClick={() => setMonth(today().slice(0, 7))}
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Today
            </button>
            <NavButton label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
              ›
            </NavButton>
          </div>
        }
      />

      <div className="mx-auto max-w-lg space-y-4 px-2 py-3">
        <div className="px-2">
          <CustodyBanner
            entries={entries}
            kids={household.kids}
            parents={household.parents}
            onLogHandoff={() => openSheet('new-plan/handoff')}
          />
        </div>

        <KidFilter
          kids={household.kids}
          value={kidFilter}
          onChange={(id) => {
            setKidFilter(id);
            setSelectedDay(null);
          }}
        />

        <MonthGrid
          month={month}
          dayMap={dayMap}
          parents={household.parents}
          selected={selectedDay}
          onSelect={(date) => setSelectedDay((cur) => (cur === date ? null : date))}
        />

        {selectedDay && (
          <section className="px-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {relativeDayLabel(selectedDay, todayDate)}
              </h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openSheet(`new-plan/on/${selectedDay}`)}
              >
                + Add
              </Button>
            </div>
            {selectedItems.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400">
                Nothing planned
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {selectedItems.map((item) => (
                  <AgendaItemRow
                    key={item.id}
                    item={item}
                    parentById={parentById}
                    kidById={kidById}
                    onOpen={openItem}
                  />
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="px-2">
          <h2 className="text-sm font-semibold text-slate-900">Upcoming</h2>
          {upcoming.length === 0 ? (
            <EmptyState
              emoji="📅"
              title="Nothing coming up"
              body="Add a plan and it'll show here — and on the other parent's phone."
            />
          ) : (
            <div className="mt-2 space-y-4">
              {upcoming.map(([date, items]) => (
                <div key={date}>
                  <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {relativeDayLabel(date, todayDate)}
                  </h3>
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <AgendaItemRow
                        key={item.id}
                        item={item}
                        parentById={parentById}
                        kidById={kidById}
                        onOpen={openItem}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Fab label="Add a plan" onClick={() => openSheet('new-plan')} />

      <CalendarSheets
        sheet={route.sheet}
        selectedDay={selectedDay}
        onClose={closeSheet}
      />
    </>
  );
}

function NavButton({
  children,
  label,
  onClick,
}: {
  children: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    >
      {children}
    </button>
  );
}

/** Decodes the hash segment into whichever sheet it names. */
function CalendarSheets({
  sheet,
  selectedDay,
  onClose,
}: {
  sheet: string | null;
  selectedDay: LocalDate | null;
  onClose: () => void;
}) {
  const { entries } = useHousehold();
  if (!sheet) return null;

  const parts = sheet.split('/');

  if (parts[0] === 'new-plan') {
    // new-plan | new-plan/<category> | new-plan/on/<date>
    const category =
      parts[1] && parts[1] !== 'on' ? (parts[1] as PlanCategory) : undefined;
    const date = parts[1] === 'on' ? parts[2] : (selectedDay ?? undefined);
    return (
      <PlanForm
        existing={null}
        {...(date ? { initialDate: date } : {})}
        {...(category ? { initialCategory: category } : {})}
        onClose={onClose}
      />
    );
  }

  if (parts[0] === 'plan' && parts[1]) {
    const plan = entries.find(
      (e): e is PlanEntry => e.kind === 'plan' && e.id === parts[1] && !e.deletedAt,
    );
    if (!plan) return null;
    return <PlanForm existing={plan} onClose={onClose} />;
  }

  if (parts[0] === 'activity' && parts[1]) {
    const activity = entries.find(
      (e) => e.kind === 'activity' && e.id === parts[1] && !e.deletedAt,
    );
    if (!activity || activity.kind !== 'activity') return null;
    return <ActivityForm existing={activity} onClose={onClose} />;
  }

  return null;
}
