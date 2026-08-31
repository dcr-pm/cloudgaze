import type { Id, Kid } from '../../../shared/types';

interface KidFilterProps {
  kids: readonly Kid[];
  value: Id | null;
  onChange: (id: Id | null) => void;
}

/** Hidden entirely for a one-kid household, where it would be pure noise. */
export function KidFilter({ kids, value, onChange }: KidFilterProps) {
  const active = kids.filter((k) => !k.archived);
  if (active.length < 2) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto px-2 pb-1"
      role="group"
      aria-label="Filter by kid"
    >
      <FilterPill selected={value === null} onClick={() => onChange(null)}>
        Everyone
      </FilterPill>
      {active.map((kid) => (
        <FilterPill
          key={kid.id}
          selected={value === kid.id}
          onClick={() => onChange(value === kid.id ? null : kid.id)}
        >
          {kid.emoji && <span aria-hidden="true">{kid.emoji}</span>}
          {kid.name}
        </FilterPill>
      ))}
    </div>
  );
}

function FilterPill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition',
        selected
          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
