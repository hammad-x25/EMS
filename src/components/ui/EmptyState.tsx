import type { ElementType, ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ElementType;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="p-10 text-center">
      <Icon aria-hidden="true" className="mx-auto text-[var(--text-muted)]" size={32} />
      <p className="mt-3 text-base font-bold text-[var(--text-primary)]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
