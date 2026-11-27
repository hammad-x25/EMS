import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
          <p className="font-mono-tabular mt-2 text-2xl font-extrabold text-[var(--text-primary)]">{value}</p>
        </div>
        <span className="rounded-lg border border-[var(--accent-soft-border)] bg-[var(--accent-soft)] p-2.5 text-[var(--accent-soft-text)]">
          <Icon aria-hidden="true" size={18} />
        </span>
      </div>
      <p className="mt-3 text-xs text-[var(--text-muted)]">{detail}</p>
    </article>
  );
}
