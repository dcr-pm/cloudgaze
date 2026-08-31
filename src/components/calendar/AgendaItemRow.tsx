import { PARENT_COLOR_CLASSES, planCategoryTile } from '../../../shared/constants';
import type { Id, Kid, Parent } from '../../../shared/types';
import { formatTime, formatTimeRange, formatDateShort } from '../../lib/dates';
import { mapsUrl } from '../../lib/maps';
import { isPlanItem, type AgendaItem } from '../../lib/agenda';

interface AgendaItemRowProps {
  item: AgendaItem;
  parentById: Map<Id, Parent>;
  kidById: Map<Id, Kid>;
  onOpen: (item: AgendaItem) => void;
}

export function AgendaItemRow({ item, parentById, kidById, onOpen }: AgendaItemRowProps) {
  const isPlan = isPlanItem(item);

  const emoji = isPlan
    ? planCategoryTile(item.plan.category).emoji
    : item.activity.emoji;
  const title = isPlan ? item.plan.title : item.activity.name;
  const kidIds = isPlan ? item.plan.kidIds : item.activity.kidIds;
  const location = isPlan ? item.plan.location : item.activity.location;

  const time = isPlan
    ? item.plan.allDay
      ? 'All day'
      : formatTimeRange(item.plan.startTime, item.plan.endTime)
    : `${formatTime(item.startTime)} – ${formatTime(item.endTime)}`;

  const parent = isPlan && item.plan.withParentId
    ? parentById.get(item.plan.withParentId)
    : undefined;

  const kids = kidIds.map((id) => kidById.get(id)).filter((k): k is Kid => Boolean(k));

  const spanLabel =
    isPlan && item.spanLength > 1 && item.plan.endDate
      ? `${item.spanLength} days · through ${formatDateShort(item.plan.endDate)}`
      : null;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={[
          'flex w-full items-start gap-3 rounded-xl border bg-white px-3 py-3 text-left transition',
          'hover:border-slate-300 hover:bg-slate-50',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
          isPlan ? 'border-slate-200' : 'border-slate-200/70 bg-slate-50/50',
        ].join(' ')}
      >
        <span
          className={[
            'flex size-10 shrink-0 items-center justify-center rounded-xl text-xl',
            isPlan ? 'bg-slate-100' : 'bg-white',
          ].join(' ')}
          aria-hidden="true"
        >
          {emoji}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-medium text-slate-900">
              {title}
            </span>
            {time && (
              <span className="shrink-0 text-xs tabular-nums text-slate-500">
                {time}
              </span>
            )}
          </span>

          {spanLabel && (
            <span className="mt-0.5 block text-xs text-slate-500">{spanLabel}</span>
          )}

          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {kids.map((kid) => (
              <span key={kid.id} className="text-xs text-slate-500">
                {kid.emoji ? `${kid.emoji} ` : ''}
                {kid.name}
              </span>
            ))}

            {parent && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                  PARENT_COLOR_CLASSES[parent.color].bgSoft
                } ${PARENT_COLOR_CLASSES[parent.color].text}`}
              >
                <span
                  className={`size-1.5 rounded-full ${PARENT_COLOR_CLASSES[parent.color].dot}`}
                  aria-hidden="true"
                />
                {parent.name}
              </span>
            )}

            {!isPlan && (
              <span className="text-[11px] text-slate-400">recurring</span>
            )}
          </span>

          {location && (
            <span
              className="mt-1 flex items-center gap-1 text-xs text-slate-500"
              onClick={(e) => e.stopPropagation()}
            >
              <span aria-hidden="true">📍</span>
              <a
                href={mapsUrl(location)}
                target="_blank"
                rel="noreferrer"
                className="truncate underline decoration-slate-300 underline-offset-2 hover:text-indigo-600"
              >
                {location}
              </a>
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
