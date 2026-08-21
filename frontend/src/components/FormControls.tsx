import { InputHTMLAttributes, ButtonHTMLAttributes, SelectHTMLAttributes, forwardRef, useState } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

// forwardRef is required here: react-hook-form's register(...).ref must attach
// to the real <input> DOM node (RHF is uncontrolled by default and reads
// values directly off the DOM). Without forwardRef, React silently drops the
// ref on a plain function component and every field looks "empty" to validation.
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, id, ...rest },
  ref
) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        {...rest}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-100 ${
          error ? "border-red-400 dark:border-red-500" : "border-slate-300 dark:border-slate-600"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
});

// Password input with a show/hide toggle. Same forwardRef requirement as
// Field — react-hook-form needs the real input node.
export const PasswordField = forwardRef<HTMLInputElement, FieldProps>(function PasswordField(
  { label, error, id, ...rest },
  ref
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={ref}
          type={visible ? "text" : "password"}
          {...rest}
          className={`w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-100 ${
            error ? "border-red-400 dark:border-red-500" : "border-slate-300 dark:border-slate-600"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
});

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, id, options, placeholder, ...rest },
  ref
) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <select
        id={id}
        ref={ref}
        {...rest}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-100 ${
          error ? "border-red-400 dark:border-red-500" : "border-slate-300 dark:border-slate-600"
        }`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
});

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function PrimaryButton({ children, isLoading, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || isLoading}
      className="flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? "Please wait..." : children}
    </button>
  );
}

export function Alert({ variant = "error", children }: { variant?: "error" | "success"; children: React.ReactNode }) {
  const styles = variant === "error" ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
  return <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}