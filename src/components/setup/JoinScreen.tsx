import { useState } from 'react';
import { ApiFailure, NetworkFailure, joinHousehold } from '../../state/api';
import { useAppState } from '../../state/useAppState';
import { Button } from '../ui/Button';
import { INPUT_CLASS } from '../ui/Field';

/** Same alphabet the server generates from — no 0/O, 1/I/L, or U. */
const ALPHABET = /[^23456789ABCDEFGHJKMNPQRSTVWXYZ]/g;
const CODE_LENGTH = 12;

function normalize(raw: string): string {
  return raw.toUpperCase().replace(ALPHABET, '').slice(0, CODE_LENGTH);
}

function group(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

export function JoinScreen({ onBack }: { onBack: () => void }) {
  const { adopt } = useAppState();
  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = normalize(raw);
  const complete = code.length === CODE_LENGTH;

  async function submit() {
    if (!complete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await joinHousehold(code);
      adopt({ familyCode: group(code), state: res.state, rev: res.rev });
      // Which parent this device is gets asked next, by OnboardingGate.
    } catch (err) {
      if (err instanceof NetworkFailure) {
        setError('Could not reach the server. Check your connection.');
      } else if (err instanceof ApiFailure && err.code === 'rate_limited') {
        setError('Too many attempts. Wait a minute and try again.');
      } else {
        // The server never distinguishes a wrong code from an unissued one, so
        // neither can this message.
        setError("That code didn't match a household. Check it and try again.");
      }
      setSubmitting(false);
    }
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
          Enter your family code
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          The other parent will have it from when they set things up.
        </p>

        <form
          className="mt-7"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="family-code" className="sr-only">
            Family code
          </label>
          <input
            id="family-code"
            value={group(code)}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="XKM7-9QRD-3FTW"
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className={`${INPUT_CLASS} text-center font-mono text-xl tracking-widest uppercase`}
          />

          <p className="mt-2 text-center text-xs text-slate-500">
            {code.length} of {CODE_LENGTH} characters
          </p>

          {error && (
            <p
              className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}

          <Button size="lg" full className="mt-5" type="submit" disabled={!complete || submitting}>
            {submitting ? 'Joining…' : 'Join household'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          Dashes, spaces and capitals don&rsquo;t matter — type it however
          it&rsquo;s written down.
        </p>
      </div>
    </div>
  );
}
