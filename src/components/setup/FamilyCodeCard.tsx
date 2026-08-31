import { useState } from 'react';
import { Button } from '../ui/Button';

interface FamilyCodeCardProps {
  code: string;
  /** "issued" is the one-time screen right after setup; "settings" is the
   *  quieter version shown later. */
  variant: 'issued' | 'settings';
  onDone?: () => void;
}

export function FamilyCodeCard({ code, variant, onDone }: FamilyCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(variant === 'settings');

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked (insecure context, permission denied). The code is
      // on screen in large type, so there's still a way through.
      setCopied(false);
    }
  }

  const body = (
    <>
      <div className="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 px-4 py-5 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">
          Your family code
        </p>
        <p className="mt-2 font-mono text-2xl font-bold tracking-widest text-indigo-900 break-all sm:text-3xl">
          {code}
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" full onClick={copy}>
          {copied ? '✓ Copied' : 'Copy code'}
        </Button>
      </div>
    </>
  );

  if (variant === 'settings') {
    return (
      <div>
        {body}
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Anyone with this code can read and edit everything in this household.
          Share it with the other parent and no one else.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">
            ✅
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            Household created
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Send this code to the other parent. It&rsquo;s how they get in.
          </p>
        </div>

        <div className="mt-6">{body}</div>

        {/* There is genuinely no recovery path — no email, no account, no reset.
            Saying so plainly here is the only thing standing between a family
            and losing years of records. */}
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">
            Save this somewhere safe
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-amber-800">
            <li>
              <strong>There is no way to recover it.</strong> No password reset,
              no email, no account. If both of you lose the code, the records are
              gone.
            </li>
            <li>
              Anyone who has it can read and edit everything — your kids&rsquo;
              schedules and locations included. Treat it like a house key.
            </li>
          </ul>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          I&rsquo;ve saved the code somewhere I won&rsquo;t lose it.
        </label>

        <Button
          size="lg"
          full
          className="mt-5"
          disabled={!acknowledged}
          onClick={onDone ?? (() => window.location.reload())}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
