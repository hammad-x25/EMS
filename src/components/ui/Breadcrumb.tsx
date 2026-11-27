import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--text-secondary)]">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span className="inline-flex items-center gap-1.5" key={`${item.label}-${index}`}>
            {index > 0 ? <ChevronRight aria-hidden="true" className="text-[var(--text-muted)]" size={15} /> : null}
            {item.href && !isLast ? (
              <Link
                className="font-medium text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--accent-primary)] hover:underline"
                href={item.href}
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current={isLast ? "page" : undefined} className={isLast ? "font-semibold text-[var(--text-primary)]" : ""}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
