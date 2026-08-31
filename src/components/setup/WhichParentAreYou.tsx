import { PARENT_COLOR_CLASSES } from '../../../shared/constants';
import { useAppState } from '../../state/useAppState';

/**
 * Asked once per device, right after joining.
 *
 * This is self-asserted — nothing verifies it, and it's what "added by Sam"
 * throughout the app is based on. That limitation is stated in the README and
 * in Settings rather than hidden.
 */
export function WhichParentAreYou() {
  const { state, setDeviceParentId, leave } = useAppState();
  if (!state) return null;

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-8">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-center text-xl font-semibold text-slate-900">
          Which parent are you?
        </h1>
        <p className="mt-1.5 text-center text-sm text-slate-600">
          Entries you add on this device will be recorded under this name.
        </p>

        <div className="mt-7 space-y-3">
          {state.household.parents.map((p) => {
            const c = PARENT_COLOR_CLASSES[p.color];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setDeviceParentId(p.id)}
                className={[
                  'flex w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 py-4 text-left transition',
                  'hover:border-slate-300 hover:bg-slate-50',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
                  'border-slate-200',
                ].join(' ')}
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white ${c.bg}`}
                  aria-hidden="true"
                >
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-base font-medium text-slate-900">{p.name}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={leave}
            className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700"
          >
            Use a different family code
          </button>
        </div>
      </div>
    </div>
  );
}
