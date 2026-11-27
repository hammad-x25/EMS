import type { ReactNode } from "react";

export function FormField({
  label,
  hint,
  error,
  required,
  htmlFor,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  const header = (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]">
      <span>{label}</span>
      {required ? (
        <span aria-hidden="true" className="text-[var(--status-danger-text)]">
          *
        </span>
      ) : null}
    </span>
  );

  const feedback = error ? (
    <p className="mt-1 text-xs font-medium text-[var(--status-danger-text)]" role="alert">
      {error}
    </p>
  ) : hint ? (
    <p className="mt-1 text-xs font-normal text-[var(--text-muted)]">{hint}</p>
  ) : null;

  if (htmlFor) {
    return (
      <div className={className}>
        <label className="block" htmlFor={htmlFor}>
          {header}
        </label>
        <div className="mt-1.5">{children}</div>
        {feedback}
      </div>
    );
  }

  return (
    <label className={`block text-sm font-semibold text-[var(--text-primary)] ${className}`}>
      {header}
      <div className="mt-1.5">{children}</div>
      {feedback}
    </label>
  );
}
