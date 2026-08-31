import { PARENT_COLOR_CLASSES, planCategoryTile } from '../../../shared/constants';
import type { Id, LocalDate, Parent } from '../../../shared/types';
import { buildMonthGrid, type MonthKey } from '../../lib/dates';
import { isPlanItem, type AgendaItem } from '../../lib/agenda';

interface MonthGridProps {
  month: MonthKey;
  dayMap: Map<LocalDate, AgendaItem[]>;
  parents: readonly [Parent, Parent];
  selected: LocalDate | null;
  onSelect: (date: LocalDate) => void;
}

const WEEKDAY_HEADS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A 390px-wide phone gives each day cell about 48px. Text chips truncate to
 *  a single letter and an ellipsis at that size, so the grid shows emoji only
 *  and the day's detail list carries the words. */
const MAX_CHIPS = 4;

export function MonthGrid({
  month,
  dayMap,
  parents,
  selected,
  onSelect,
}: MonthGridProps) {
  const days = buildMonthGrid(month);
  const parentById = new Map<Id, Parent>(parents.map((p) => [p.id, p]));

  return (
    <div className="px-2">
      {/* Same gap as the cell grid below, or the headers drift out of column. */}
      <div className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAY_HEADS.map((d, i) => (
          <div
            key={i}
            className="py-1 text-center text-[11px] font-medium text-slate-400"
            aria-hidden="true"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const items = dayMap.get(day.date) ?? [];
          const isSelected = selected === day.date;

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelect(day.date)}
              aria-label={`${day.date}, ${items.length} item${items.length === 1 ? '' : 's'}`}
              aria-pressed={isSelected}
              className={[
                'flex min-h-16 flex-col items-center rounded-lg border p-1 transition',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-600',
                day.inMonth ? 'bg-white' : 'bg-slate-50/60',
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                  : 'border-slate-200 hover:border-slate-300',
              ].join(' ')}
            >
              <span
                className={[
                  'flex size-5 items-center justify-center rounded-full text-[11px] font-medium',
                  day.isToday
                    ? 'bg-indigo-600 text-white'
                    : day.inMonth
                      ? 'text-slate-700'
                      : 'text-slate-300',
                ].join(' ')}
              >
                {day.dayOfMonth}
              </span>

              <span className="mt-0.5 flex flex-wrap items-center justify-center gap-px">
                {items.slice(0, MAX_CHIPS).map((item) => (
                  <Chip key={item.id} item={item} parentById={parentById} />
                ))}
                {items.length > MAX_CHIPS && (
                  <span className="text-[9px] font-semibold leading-3 text-slate-400">
                    +{items.length - MAX_CHIPS}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chip({
  item,
  parentById,
}: {
  item: AgendaItem;
  parentById: Map<Id, Parent>;
}) {
  if (isPlanItem(item)) {
    const { plan } = item;
    const tile = planCategoryTile(plan.category);
    const parent = plan.withParentId ? parentById.get(plan.withParentId) : undefined;

    return (
      <span
        className="relative flex size-[15px] items-center justify-center text-[11px] leading-none"
        title={plan.title}
      >
        <span aria-hidden="true">{tile.emoji}</span>
        {/* The parent's colour rides underneath as a dot, so a glance at the
            month still answers "whose week is this?" without any text. */}
        {parent && (
          <span
            className={`absolute -bottom-px size-1 rounded-full ${PARENT_COLOR_CLASSES[parent.color].dot}`}
            aria-hidden="true"
          />
        )}
      </span>
    );
  }

  // Recurring occurrences are deliberately subordinate to one-off plans.
  return (
    <span
      className="flex size-[15px] items-center justify-center text-[11px] leading-none opacity-45"
      title={`${item.activity.name} (recurring)`}
    >
      <span aria-hidden="true">{item.activity.emoji}</span>
    </span>
  );
}
