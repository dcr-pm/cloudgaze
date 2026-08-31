import type { CategoryTile } from '../../../shared/constants';

interface EmojiTilePickerProps<T extends string> {
  label: string;
  tiles: readonly CategoryTile<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Big tappable tiles instead of a dropdown. This is the first interaction in
 * every entry form — picking "🏕️ Camping" is one tap, and it's what makes the
 * form feel fast rather than like a database record.
 */
export function EmojiTilePicker<T extends string>({
  label,
  tiles,
  value,
  onChange,
}: EmojiTilePickerProps<T>) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-slate-700">{label}</legend>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {tiles.map((tile) => {
          const selected = tile.value === value;
          return (
            <button
              key={tile.value}
              type="button"
              onClick={() => onChange(tile.value)}
              aria-pressed={selected}
              className={[
                'flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 transition',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
                selected
                  ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/40'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {tile.emoji}
              </span>
              <span
                className={[
                  'text-center text-[11px] leading-tight',
                  selected ? 'font-medium text-indigo-700' : 'text-slate-600',
                ].join(' ')}
              >
                {tile.label}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface EmojiChoiceProps {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}

/** Compact emoji-only grid, for activity and kid avatars. */
export function EmojiChoice({ label, options, value, onChange }: EmojiChoiceProps) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-slate-700">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((emoji) => {
          const selected = emoji === value;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange(emoji)}
              aria-pressed={selected}
              aria-label={emoji}
              className={[
                'flex size-11 items-center justify-center rounded-xl border text-xl transition',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
                selected
                  ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/40'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              ].join(' ')}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
