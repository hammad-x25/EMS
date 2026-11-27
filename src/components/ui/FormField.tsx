import type { ReactNode } from "react";

export function FormField({
  label,
  hint,
  error,
  required,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-sm font-semibold text-[var(--text-primary)] ${className}`}>
      <span className="inline-flex items-center gap-1">
        <span>{label}</span>
        {required ? (
          <span aria-hidden="true" className="text-[var(--status-danger-text)]">
            *
          </span>
        ) : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1 text-xs font-medium text-[var(--status-danger-text)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs font-normal text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </label>
  );
}
