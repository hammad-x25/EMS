"use client";

import { useRef } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  badge?: string | number;
  dirty?: boolean;
}

export function Tabs<T extends string>({
  items,
  activeId,
  onSelect,
  ariaLabel,
  idPrefix = "tabs",
}: {
  items: Array<TabItem<T>>;
  activeId: T;
  onSelect: (id: T) => void;
  ariaLabel: string;
  idPrefix?: string;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (index: number, key: string) => {
    let nextIndex: number | null = null;
    if (key === "ArrowRight") nextIndex = (index + 1) % items.length;
    if (key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    if (key === "Home") nextIndex = 0;
    if (key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;
    tabRefs.current[nextIndex]?.focus();
    onSelect(items[nextIndex].id);
  };

  return (
    <div
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5"
      role="tablist"
    >
      {items.map((item, index) => {
        const selected = item.id === activeId;
        return (
          <button
            aria-controls={`${idPrefix}-panel-${item.id}`}
            aria-selected={selected}
            className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              selected
                ? "bg-[var(--accent-primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
            }`}
            id={`${idPrefix}-tab-${item.id}`}
            key={item.id}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => handleKeyDown(index, event.key)}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <span>{item.label}</span>
            {item.dirty ? (
              <span
                aria-label="unsaved changes"
                className={`h-2 w-2 rounded-full ${selected ? "bg-amber-300" : "bg-amber-500"}`}
                title="Unsaved changes"
              />
            ) : null}
            {item.badge !== undefined ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                  selected ? "bg-white/20 text-white" : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"
                }`}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
