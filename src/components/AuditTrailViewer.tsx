"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollText } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { DataTableToolbar, PaginationControls } from "@/components/ui/DataTableControls";
import { EmptyState } from "@/components/ui/EmptyState";
import { parseApiError, readApiJson } from "@/lib/form-errors";
import type { PaginationMeta } from "@/lib/pagination";

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor: { id: string; name: string; email: string };
}

interface AuditResponse {
  logs?: AuditLogItem[];
  actions?: string[];
  pagination?: PaginationMeta;
  error?: { message?: string };
}

export function AuditTrailViewer({
  initialLogs,
  initialTotal,
  initialLimit = 25,
  actions,
}: {
  initialLogs: AuditLogItem[];
  initialTotal: number;
  initialLimit?: number;
  actions: string[];
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [actionOptions, setActionOptions] = useState(actions);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didMountRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchLogs = useCallback(
    async (targetPage: number, targetLimit: number, searchText: string, action: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(targetLimit),
        });
        if (searchText) params.set("search", searchText);
        if (action !== "ALL") params.set("action", action);

        const response = await fetch(`/api/admin/audit?${params.toString()}`);
        const body = await readApiJson<AuditResponse>(response);
        if (!response.ok || !body?.logs) {
          throw new Error(parseApiError(body, "Unable to load audit logs").message);
        }
        setLogs(body.logs);
        if (body.actions) setActionOptions(body.actions);
        setTotal(body.pagination?.total ?? body.logs.length);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unable to load audit logs");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    void fetchLogs(page, limit, debouncedSearch, actionFilter);
  }, [page, limit, debouncedSearch, actionFilter, fetchLogs]);

  return (
    <div className="space-y-5">
      <DataTableToolbar
        filters={
          <select
            aria-label="Filter by audit action"
            className="field w-auto min-w-44"
            onChange={(event) => {
              setActionFilter(event.target.value);
              setPage(1);
            }}
            value={actionFilter}
          >
            <option value="ALL">All actions</option>
            {actionOptions.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        }
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        search={search}
        searchLabel="Search audit logs"
        searchPlaceholder="Search actor, email, entity, or ID"
      />

      {error ? (
        <AlertBanner onDismiss={() => setError(null)} variant="error">
          {error}
        </AlertBanner>
      ) : null}

      <section className="card overflow-hidden">
        {logs.length === 0 ? (
          <EmptyState
            description={
              loading
                ? "Loading matching audit events…"
                : "Events appear after sign-ins, administration, and examination actions."
            }
            icon={ScrollText}
            title={loading ? "Loading audit events" : "No matching audit events"}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-surface-subtle)] text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                  <tr>
                    <th className="p-4">Time</th>
                    <th className="p-4">Actor</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr className="border-t border-[var(--border-subtle)]" key={log.id}>
                      <td className="font-mono-tabular whitespace-nowrap p-4 text-xs text-[var(--text-secondary)]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-[var(--text-primary)]">{log.actor.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{log.actor.email}</p>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-primary)]">
                          {log.action.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="font-mono-tabular p-4 text-xs text-[var(--text-secondary)]">
                        {log.entityType} · {log.entityId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[var(--border-subtle)] md:hidden">
              {logs.map((log) => (
                <article className="space-y-1.5 p-4" key={log.id}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-primary)]">
                      {log.action.replaceAll("_", " ")}
                    </span>
                    <span className="font-mono-tabular text-xs text-[var(--text-muted)]">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{log.actor.name}</p>
                  <p className="font-mono-tabular text-xs text-[var(--text-secondary)]">
                    {log.entityType} · {log.entityId}
                  </p>
                </article>
              ))}
            </div>
          </>
        )}

        <PaginationControls
          limit={limit}
          loading={loading}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          onPageChange={(nextPage) => setPage(nextPage)}
          page={page}
          total={total}
        />
      </section>
    </div>
  );
}
