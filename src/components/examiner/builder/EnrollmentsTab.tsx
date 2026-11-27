"use client";

import { useMemo, useState } from "react";
import { FileUp, Trash2, UserPlus, Users } from "lucide-react";
import type { EnrollmentEntry } from "@/components/examiner/builder/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTableToolbar, PaginationControls } from "@/components/ui/DataTableControls";
import { EmptyState } from "@/components/ui/EmptyState";
import type { UserDto } from "@/lib/user-dto";

const PAGE_SIZE = 20;

export function EnrollmentsTab({
  busy,
  enrollments,
  availableCandidates,
  selectedCandidateIds,
  onSelectedCandidateIdsChange,
  onEnrollSelected,
  onRemoveEnrollment,
  onOpenImport,
}: {
  busy: boolean;
  enrollments: EnrollmentEntry[];
  availableCandidates: UserDto[];
  selectedCandidateIds: string[];
  onSelectedCandidateIdsChange: (next: string[]) => void;
  onEnrollSelected: () => void;
  onRemoveEnrollment: (userId: string) => Promise<void>;
  onOpenImport: () => void;
}) {
  const [poolSearch, setPoolSearch] = useState("");
  const [enrolledSearch, setEnrolledSearch] = useState("");
  const [page, setPage] = useState(1);
  const [removeTarget, setRemoveTarget] = useState<EnrollmentEntry | null>(null);

  const filteredPool = useMemo(() => {
    const q = poolSearch.trim().toLowerCase();
    return availableCandidates.filter(
      (c) => !q || `${c.name} ${c.email} ${c.studentId ?? ""}`.toLowerCase().includes(q),
    );
  }, [availableCandidates, poolSearch]);

  const filteredEnrollments = useMemo(() => {
    const q = enrolledSearch.trim().toLowerCase();
    return enrollments.filter(
      (e) => !q || `${e.candidate.name} ${e.candidate.email} ${e.candidate.studentId ?? ""}`.toLowerCase().includes(q),
    );
  }, [enrollments, enrolledSearch]);

  const pagedEnrollments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEnrollments.slice(start, start + PAGE_SIZE);
  }, [filteredEnrollments, page]);

  return (
    <section className="space-y-5">
      <div className="card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Candidate Enrollment</h2>
            <p className="muted mt-1 text-sm">
              Only enrolled candidates can view and start this examination inside its scheduled window.
            </p>
          </div>
          <button className="btn-secondary" onClick={onOpenImport} type="button">
            <FileUp size={16} /> Bulk CSV/JSON import &amp; enroll
          </button>
        </div>

        {availableCandidates.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Available active candidates ({filteredPool.length} shown of {availableCandidates.length})
              </p>
              <input
                aria-label="Filter available candidates"
                className="field h-9 max-w-xs text-xs"
                onChange={(e) => setPoolSearch(e.target.value)}
                placeholder="Filter available candidates…"
                value={poolSearch}
              />
            </div>

            <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
              {filteredPool.map((candidate) => (
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                  key={candidate.id}
                >
                  <input
                    checked={selectedCandidateIds.includes(candidate.id)}
                    onChange={(e) => {
                      onSelectedCandidateIdsChange(
                        e.target.checked
                          ? [...selectedCandidateIds, candidate.id]
                          : selectedCandidateIds.filter((id) => id !== candidate.id),
                      );
                    }}
                    type="checkbox"
                  />
                  <span className="truncate font-semibold text-[var(--text-primary)]">{candidate.name}</span>
                  <span className="truncate text-[var(--text-muted)]">({candidate.email})</span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="btn-secondary h-9 px-3 text-xs"
                onClick={() => onSelectedCandidateIdsChange(filteredPool.map((c) => c.id))}
                type="button"
              >
                Select filtered ({filteredPool.length})
              </button>
              <button
                className="btn-primary h-9 px-3.5 text-xs"
                disabled={busy || selectedCandidateIds.length === 0}
                onClick={onEnrollSelected}
                type="button"
              >
                <UserPlus size={14} /> Enroll selected ({selectedCandidateIds.length})
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] p-4">
          <DataTableToolbar
            onSearchChange={(val) => {
              setEnrolledSearch(val);
              setPage(1);
            }}
            search={enrolledSearch}
            searchLabel="Search enrolled candidates"
            searchPlaceholder="Search enrolled name, email, or student ID"
          />
        </div>

        {pagedEnrollments.length === 0 ? (
          <EmptyState
            description={
              enrollments.length === 0
                ? "Select active candidates above or use Bulk Import to enroll a cohort."
                : "No enrolled candidates match your search."
            }
            icon={Users}
            title={enrollments.length === 0 ? "No candidates enrolled yet" : "No matching enrollments"}
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="hidden bg-[var(--bg-surface-subtle)] text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] md:table-header-group">
              <tr>
                <th className="p-4">Candidate</th>
                <th className="p-4">Student ID</th>
                <th className="p-4">Enrolled At</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] md:divide-y-0">
              {pagedEnrollments.map((entry) => (
                <tr className="block space-y-2 p-4 md:table-row md:space-y-0 md:border-t md:border-[var(--border-subtle)] md:p-0" key={entry.id}>
                  <td className="block md:table-cell md:p-4">
                    <p className="truncate font-semibold text-[var(--text-primary)]">{entry.candidate.name}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">{entry.candidate.email}</p>
                  </td>
                  <td className="font-mono-tabular block text-xs md:table-cell md:p-4">{entry.candidate.studentId ?? "—"}</td>
                  <td className="font-mono-tabular block text-xs text-[var(--text-secondary)] md:table-cell md:p-4">
                    {new Date(entry.enrolledAt).toLocaleString()}
                  </td>
                  <td className="block text-right md:table-cell md:p-4">
                    <button
                      className="btn-danger h-9 px-3 text-xs"
                      disabled={busy}
                      onClick={() => setRemoveTarget(entry)}
                      type="button"
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <PaginationControls
          limit={PAGE_SIZE}
          onPageChange={setPage}
          page={page}
          total={filteredEnrollments.length}
        />
      </section>

      <ConfirmDialog
        busy={busy}
        confirmLabel="Unenroll candidate"
        consequence="The candidate will no longer see or access this examination."
        description={
          removeTarget
            ? `Remove ${removeTarget.candidate.name} (${removeTarget.candidate.email}) from this examination?`
            : ""
        }
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            void onRemoveEnrollment(removeTarget.candidate.id).then(() => setRemoveTarget(null));
          }
        }}
        open={Boolean(removeTarget)}
        title="Unenroll candidate"
        variant="danger"
      />
    </section>
  );
}
