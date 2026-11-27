"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  searchLabel = "Search records",
  filters,
  actions,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  filters?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative min-w-60 flex-1">
        <span className="sr-only">{searchLabel}</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
        <input
          className="field pl-9 pr-8"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          value={search}
        />
        {search ? (
          <button
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
            onClick={() => onSearchChange("")}
            type="button"
          >
            <X size={14} />
          </button>
        ) : null}
      </label>
      {filters}
      {actions}
    </div>
  );
}

export function PaginationControls({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  loading = false,
  pageSizeOptions = [20, 50, 100],
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  onLimitChange?: (nextLimit: number) => void;
  loading?: boolean;
  pageSizeOptions?: number[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/50 px-4 py-3 text-sm text-[var(--text-secondary)]">
      <p className="tabular-nums">
        Showing <strong className="text-[var(--text-primary)]">{start}–{end}</strong> of{" "}
        <strong className="text-[var(--text-primary)]">{total}</strong>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {onLimitChange ? (
          <label className="inline-flex items-center gap-2 text-xs font-semibold">
            <span>Rows</span>
            <select
              aria-label="Rows per page"
              className="field h-9 w-auto py-1 text-xs"
              disabled={loading}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              value={limit}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary h-9 px-3 py-1 text-xs"
            disabled={loading || page <= 1}
            onClick={() => onPageChange(page - 1)}
            type="button"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="px-1 text-xs font-semibold tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            className="btn-secondary h-9 px-3 py-1 text-xs"
            disabled={loading || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            type="button"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
