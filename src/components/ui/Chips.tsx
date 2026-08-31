import { PARENT_COLOR_CLASSES } from '../../../shared/constants';
import type { Id, Kid, Parent } from '../../../shared/types';

interface ParentChipProps {
  parent: Parent;
  size?: 'sm' | 'md';
  /** Appends "(you)" so it's obvious which side of the record you're on. */
  isYou?: boolean;
}

export function ParentChip({ parent, size = 'md', isYou = false }: ParentChipProps) {
  const c = PARENT_COLOR_CLASSES[parent.color];
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        c.bgSoft,
        c.text,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      ].join(' ')}
    >
      <span className={`size-2 shrink-0 rounded-full ${c.dot}`} aria-hidden="true" />
      {parent.name}
      {isYou && <span className="opacity-60">(you)</span>}
    </span>
  );
}

export function ParentDot({ parent }: { parent: Parent }) {
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full ${PARENT_COLOR_CLASSES[parent.color].dot}`}
      title={parent.name}
      aria-label={parent.name}
    />
  );
}

export function KidChip({ kid, size = 'md' }: { kid: Kid; size?: 'sm' | 'md' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full bg-slate-100 font-medium text-slate-700',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      ].join(' ')}
    >
      {kid.emoji && <span aria-hidden="true">{kid.emoji}</span>}
      {kid.name}
    </span>
  );
}

interface KidPickerProps {
  kids: readonly Kid[];
  selected: readonly Id[];
  onChange: (ids: Id[]) => void;
  label?: string;
}

/** Multi-select: a camping weekend or a handoff covers every kid at once. */
export function KidPicker({
  kids,
  selected,
  onChange,
  label = 'Who is this for?',
}: KidPickerProps) {
  const active = kids.filter((k) => !k.archived);
  if (active.length === 0) return null;

  const toggle = (id: Id) => {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    );
  };

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-slate-700">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {active.map((kid) => {
          const on = selected.includes(kid.id);
          return (
            <button
              key={kid.id}
              type="button"
              onClick={() => toggle(kid.id)}
              aria-pressed={on}
              className={[
                'inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
                on
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/40'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              {kid.emoji && <span aria-hidden="true">{kid.emoji}</span>}
              {kid.name}
            </button>
          );
        })}
        {active.length > 1 && (
          <button
            type="button"
            onClick={() =>
              onChange(
                selected.length === active.length ? [] : active.map((k) => k.id),
              )
            }
            className="min-h-11 rounded-xl px-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            {selected.length === active.length ? 'Clear' : 'All kids'}
          </button>
        )}
      </div>
    </fieldset>
  );
}

interface ParentPickerProps {
  parents: readonly [Parent, Parent];
  value: Id | undefined;
  onChange: (id: Id | undefined) => void;
  label: string;
  allowNone?: boolean;
  deviceParentId?: Id;
}

export function ParentPicker({
  parents,
  value,
  onChange,
  label,
  allowNone = true,
  deviceParentId,
}: ParentPickerProps) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-slate-700">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {parents.map((p) => {
          const on = value === p.id;
          const c = PARENT_COLOR_CLASSES[p.color];
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(allowNone && on ? undefined : p.id)}
              aria-pressed={on}
              className={[
                'inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
                on
                  ? `${c.border} ${c.bgSoft} ${c.text} ring-2 ring-current/30`
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              <span className={`size-2.5 rounded-full ${c.dot}`} aria-hidden="true" />
              {p.name}
              {deviceParentId === p.id && <span className="opacity-60">(you)</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
