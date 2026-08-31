import { useState } from 'react';
import { PARENT_COLOR_CLASSES, PARENT_COLOR_LABELS, KID_EMOJI } from '../../../shared/constants';
import {
  PARENT_COLORS,
  type CreateHouseholdResponse,
  type ParentColor,
} from '../../../shared/types';
import { createHousehold } from '../../state/api';
import { ApiFailure, NetworkFailure } from '../../state/api';
import { useAppState } from '../../state/useAppState';
import { deviceTimezone } from '../../lib/dates';
import { Button } from '../ui/Button';
import { TextField, INPUT_CLASS } from '../ui/Field';
import { FamilyCodeCard } from './FamilyCodeCard';

interface KidDraft {
  name: string;
  emoji: string;
}

export function CreateHouseholdWizard({ onBack }: { onBack: () => void }) {
  const { adopt, setDeviceParentId } = useAppState();

  const [parentAName, setParentAName] = useState('');
  const [parentAColor, setParentAColor] = useState<ParentColor>('indigo');
  const [parentBName, setParentBName] = useState('');
  const [parentBColor, setParentBColor] = useState<ParentColor>('teal');
  const [kids, setKids] = useState<KidDraft[]>([{ name: '', emoji: '' }]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Held locally rather than adopted straight away. Calling adopt() sets the
   * family code on the provider, which immediately advances OnboardingGate past
   * this wizard — and the code screen would never render. Since the code is
   * unrecoverable, that screen is the one thing that must not be skippable, so
   * adoption waits until the user acknowledges it.
   */
  const [issued, setIssued] = useState<CreateHouseholdResponse | null>(null);

  const namedKids = kids.filter((k) => k.name.trim().length > 0);
  const canSubmit =
    parentAName.trim().length > 0 &&
    parentBName.trim().length > 0 &&
    parentAColor !== parentBColor &&
    namedKids.length > 0 &&
    !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createHousehold({
        parents: [
          { name: parentAName.trim(), color: parentAColor },
          { name: parentBName.trim(), color: parentBColor },
        ],
        kids: namedKids.map((k) => ({
          name: k.name.trim(),
          ...(k.emoji ? { emoji: k.emoji } : {}),
        })),
        timezone: deviceTimezone(),
      });
      setIssued(res);
    } catch (err) {
      if (err instanceof NetworkFailure) {
        setError('Could not reach the server. Check your connection and try again.');
      } else if (err instanceof ApiFailure) {
        setError(err.message ?? 'Something went wrong. Try again.');
      } else {
        setError('Something went wrong. Try again.');
      }
      setSubmitting(false);
    }
  }

  // The code is shown once, on a screen that can't be skipped past by accident.
  // There is no recovery if it's lost, so this moment matters.
  if (issued) {
    return (
      <FamilyCodeCard
        code={issued.familyCode}
        variant="issued"
        onDone={() => {
          adopt({
            familyCode: issued.familyCode,
            state: issued.state,
            rev: issued.rev,
          });
          // Whoever ran setup is the first parent listed.
          setDeviceParentId(issued.state.household.parents[0].id);
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          ← Back
        </button>

        <h1 className="mt-4 text-xl font-semibold text-slate-900">
          Set up your household
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          You can change any of this later.
        </p>

        <div className="mt-7 space-y-7">
          <section>
            <h2 className="text-sm font-semibold text-slate-900">The parents</h2>
            <div className="mt-3 space-y-4">
              <ParentFields
                label="You"
                name={parentAName}
                onName={setParentAName}
                color={parentAColor}
                onColor={setParentAColor}
                disabledColor={parentBColor}
                autoFocus
              />
              <ParentFields
                label="The other parent"
                name={parentBName}
                onName={setParentBName}
                color={parentBColor}
                onColor={setParentBColor}
                disabledColor={parentAColor}
              />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">The kids</h2>
            <div className="mt-3 space-y-3">
              {kids.map((kid, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1">
                    <TextField
                      label={i === 0 ? 'Name' : ''}
                      value={kid.name}
                      placeholder="Ellie"
                      onChange={(e) =>
                        setKids((prev) =>
                          prev.map((k, j) =>
                            j === i ? { ...k, name: e.target.value } : k,
                          ),
                        )
                      }
                    />
                  </div>
                  <select
                    aria-label={`Emoji for kid ${i + 1}`}
                    value={kid.emoji}
                    onChange={(e) =>
                      setKids((prev) =>
                        prev.map((k, j) =>
                          j === i ? { ...k, emoji: e.target.value } : k,
                        ),
                      )
                    }
                    // INPUT_CLASS carries w-full; !w-20 has to win or this
                    // select stretches and squeezes the name field to nothing.
                    className={`${INPUT_CLASS} !w-20 shrink-0 text-center text-xl`}
                  >
                    <option value="">—</option>
                    {KID_EMOJI.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                  {kids.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setKids((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Remove kid ${i + 1}`}
                      className="mb-0.5 flex size-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {kids.length < 20 && (
                <button
                  type="button"
                  onClick={() => setKids((prev) => [...prev, { name: '', emoji: '' }])}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  + Add another kid
                </button>
              )}
            </div>
          </section>

          {parentAColor === parentBColor && (
            <p className="text-sm text-amber-700" role="alert">
              Give each parent a different colour — it&rsquo;s how the calendar
              stays readable at a glance.
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <Button size="lg" full disabled={!canSubmit} onClick={submit}>
            {submitting ? 'Creating…' : 'Create household'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ParentFields({
  label,
  name,
  onName,
  color,
  onColor,
  disabledColor,
  autoFocus,
}: {
  label: string;
  name: string;
  onName: (v: string) => void;
  color: ParentColor;
  onColor: (c: ParentColor) => void;
  disabledColor: ParentColor;
  autoFocus?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <TextField
        label={label}
        value={name}
        placeholder="Name"
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => onName(e.target.value)}
      />
      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-slate-600">Colour</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {PARENT_COLORS.map((c) => {
            const taken = c === disabledColor;
            return (
              <button
                key={c}
                type="button"
                disabled={taken}
                onClick={() => onColor(c)}
                aria-label={PARENT_COLOR_LABELS[c]}
                aria-pressed={color === c}
                className={[
                  'size-9 rounded-full transition',
                  PARENT_COLOR_CLASSES[c].bg,
                  taken ? 'opacity-20' : 'hover:scale-105',
                  color === c ? 'ring-2 ring-slate-900 ring-offset-2' : '',
                ].join(' ')}
              />
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
