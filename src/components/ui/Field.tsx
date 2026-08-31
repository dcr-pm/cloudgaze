import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldShellProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-1.5">{children(id)}</div>
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const INPUT_CLASS =
  'w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 ' +
  'text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, hint, error, className = '', ...rest }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => <input id={id} className={`${INPUT_CLASS} ${className}`} {...rest} />}
    </Field>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextAreaField({
  label,
  hint,
  error,
  className = '',
  ...rest
}: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => (
        <textarea
          id={id}
          rows={3}
          className={`${INPUT_CLASS} resize-y ${className}`}
          {...rest}
        />
      )}
    </Field>
  );
}

/** Money input. `inputmode="decimal"` gets the numeric keypad with a decimal point. */
export function AmountField({
  label = 'Amount',
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <Field label={label} error={error}>
      {(id) => (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            $
          </span>
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            className={`${INPUT_CLASS} pl-7 text-lg tabular-nums`}
            {...rest}
          />
        </div>
      )}
    </Field>
  );
}

export { INPUT_CLASS };
