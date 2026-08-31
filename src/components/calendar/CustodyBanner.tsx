import { PARENT_COLOR_CLASSES } from '../../../shared/constants';
import type { Entry, Kid, Parent } from '../../../shared/types';
import { custodyForAll, allWithSameParent } from '../../lib/custody';
import { formatDateShort, toLocalDate } from '../../lib/dates';

interface CustodyBannerProps {
  entries: readonly Entry[];
  kids: readonly Kid[];
  parents: readonly [Parent, Parent];
  onLogHandoff: () => void;
}

/**
 * Derived from 🏠 Handoff entries: whoever received the kid at the most recent
 * handoff has them now. There is no custody-schedule model in v1, so when
 * nothing has been logged this says so rather than guessing — a confidently
 * wrong answer about where a child is would be worse than none.
 */
export function CustodyBanner({
  entries,
  kids,
  parents,
  onLogHandoff,
}: CustodyBannerProps) {
  const active = kids.filter((k) => !k.archived);
  if (active.length === 0) return null;

  const statuses = custodyForAll(entries, active.map((k) => k.id));
  const parentById = new Map(parents.map((p) => [p.id, p]));
  const unified = allWithSameParent(statuses);
  const anyKnown = statuses.some((s) => s.parentId);

  if (!anyKnown) {
    return (
      <button
        type="button"
        onClick={onLogHandoff}
        className="mx-auto flex w-full max-w-lg items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-3.5 py-3 text-left transition hover:border-slate-400 hover:bg-slate-50"
      >
        <span className="text-xl" aria-hidden="true">
          🏠
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-700">
            Custody not logged
          </span>
          <span className="block text-xs text-slate-500">
            Record a handoff to track who has the kids
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium text-indigo-600">Add</span>
      </button>
    );
  }

  if (unified) {
    const parent = parentById.get(unified)!;
    const c = PARENT_COLOR_CLASSES[parent.color];
    const next = statuses[0]!.nextHandoffAt;
    const nextParent = statuses[0]!.nextParentId
      ? parentById.get(statuses[0]!.nextParentId)
      : null;

    return (
      <div
        className={`mx-auto w-full max-w-lg rounded-xl border px-3.5 py-3 ${c.bgSoft} border-transparent`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`size-2.5 shrink-0 rounded-full ${c.dot}`} aria-hidden="true" />
          <p className={`text-sm font-medium ${c.text}`}>
            {active.length === 1
              ? `${active[0]!.name} is with ${parent.name}`
              : `The kids are with ${parent.name}`}
          </p>
        </div>
        {next && nextParent && (
          <p className="mt-1 pl-5 text-xs text-slate-600">
            Next handoff to {nextParent.name} on {formatDateShort(toLocalDate(next))}
          </p>
        )}
      </div>
    );
  }

  // Kids are split between parents — one line each.
  return (
    <div className="mx-auto w-full max-w-lg space-y-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      {statuses.map((status) => {
        const kid = active.find((k) => k.id === status.kidId)!;
        const parent = status.parentId ? parentById.get(status.parentId) : null;
        return (
          <div key={status.kidId} className="flex items-center gap-2.5 text-sm">
            {parent ? (
              <span
                className={`size-2.5 shrink-0 rounded-full ${PARENT_COLOR_CLASSES[parent.color].dot}`}
                aria-hidden="true"
              />
            ) : (
              <span className="size-2.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
            )}
            <span className="text-slate-700">
              {kid.emoji ? `${kid.emoji} ` : ''}
              {kid.name}
              {parent ? (
                <span className="text-slate-500"> is with {parent.name}</span>
              ) : (
                <span className="text-slate-400"> — not logged</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
