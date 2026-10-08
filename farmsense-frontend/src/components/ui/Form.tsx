import { useId, type ReactNode } from "react";

/**
 * Form controls.
 *
 * Every field is labelled - not placeholder-labelled. A placeholder disappears
 * the moment someone starts typing, which is precisely when they most need to
 * remember whether this box wanted kilograms or sacks. Hints stay visible, and
 * errors are wired through aria-describedby rather than just coloured red.
 */

const CONTROL =
  "w-full rounded-xl border border-clay-300 bg-white px-4 py-3 text-base " +
  "text-clay-900 placeholder:text-clay-400 transition-colors " +
  "focus:border-field-500 focus:outline-none focus:ring-4 focus:ring-field-500/15 " +
  "disabled:bg-clay-100 disabled:text-clay-500 read-only:bg-clay-100 read-only:text-clay-500";

const INVALID = "border-alert-400 focus:border-alert-500 focus:ring-alert-500/15";

function Shell({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-clay-800"
      >
        {label}
        {required && <span className="ml-1 text-alert-600">*</span>}
      </label>

      {children}

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-alert-700">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-clay-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
};

export function TextField({
  label,
  hint,
  error,
  className = "",
  id,
  ...rest
}: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <Shell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={rest.required}
    >
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
        }
        className={`${CONTROL} ${error ? INVALID : ""} ${className}`}
        {...rest}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className = "",
  id,
  children,
  ...rest
}: FieldProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <Shell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={rest.required}
    >
      <div className="relative">
        <select
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
          }
          className={`${CONTROL} appearance-none pr-11 ${error ? INVALID : ""} ${className}`}
          {...rest}
        >
          {children}
        </select>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-clay-500"
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </Shell>
  );
}

/** Groups related inputs under one heading inside a form. */
export function Fieldset({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-t border-clay-200 pt-5">
      <legend className="-mt-8 mb-0 bg-white pr-3 text-sm font-bold uppercase tracking-wide text-clay-500">
        {legend}
      </legend>
      {description && (
        <p className="mb-4 -mt-2 text-sm text-clay-500">{description}</p>
      )}
      <div className="space-y-5">{children}</div>
    </fieldset>
  );
}
