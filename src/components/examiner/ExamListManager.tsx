"use client";

import { ExamStatus, MultiSelectScoring } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, ClipboardList, Plus, Trash2 } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTableToolbar } from "@/components/ui/DataTableControls";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ExamDto } from "@/lib/exam-dto";
import { parseApiError, readApiJson } from "@/lib/form-errors";

function toLocalDateTimeInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function ExamListManager({ initialExams }: { initialExams: ExamDto[] }) {
  const router = useRouter();
  const [exams, setExams] = useState<ExamDto[]>(initialExams);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ExamStatus>("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExamDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const now = new Date();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState(
    "Read each question carefully. Answers auto-save continuously and are strictly enforced by the server clock.",
  );
  const [scheduledStart, setScheduledStart] = useState(
    toLocalDateTimeInput(new Date(now.getTime() + 5 * 60_000)),
  );
  const [scheduledEnd, setScheduledEnd] = useState(
    toLocalDateTimeInput(new Date(now.getTime() + 125 * 60_000)),
  );
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [totalMarks, setTotalMarks] = useState("20");
  const [passingMarks, setPassingMarks] = useState("10");
  const [useStratifiedBlueprint, setUseStratifiedBlueprint] = useState(true);
  const [multiSelectRule, setMultiSelectRule] = useState<MultiSelectScoring>(
    MultiSelectScoring.PARTIAL_NO_NEGATIVE,
  );

  const filteredExams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams.filter(
      (exam) =>
        (statusFilter === "ALL" || exam.status === statusFilter) &&
        (!q || `${exam.title} ${exam.instructions}`.toLowerCase().includes(q)),
    );
  }, [exams, search, statusFilter]);

  async function createExam(event: FormEvent) {
    event.preventDefault();
    setCreateError(null);
    setFieldErrors({});

    const nextFieldErrors: Record<string, string> = {};
    if (new Date(scheduledEnd) <= new Date(scheduledStart)) {
      nextFieldErrors.scheduledEnd = "Scheduled end must be after scheduled start.";
    }
    if (Number(passingMarks) > Number(totalMarks)) {
      nextFieldErrors.passingMarks = "Passing marks cannot exceed total marks.";
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setCreateError("Please resolve the highlighted validation errors.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          instructions,
          scheduledStart: new Date(scheduledStart).toISOString(),
          scheduledEnd: new Date(scheduledEnd).toISOString(),
          durationMinutes: Number(durationMinutes),
          totalMarks: Number(totalMarks),
          passingMarks: Number(passingMarks),
          shuffleQuestions: true,
          shuffleOptions: true,
          useStratifiedBlueprint,
          multiSelectRule,
          negativeMarkRatio: 0,
          revealAnswersAfterPublish: false,
        }),
      });
      const body = await readApiJson<{ exam?: ExamDto; error?: { message?: string; details?: unknown } }>(response);
      if (!response.ok || !body?.exam) {
        const parsed = parseApiError(body, "Failed to create examination");
        setFieldErrors(parsed.fieldErrors);
        setCreateError(parsed.formErrors[0] ?? parsed.message);
        setBusy(false);
        return;
      }
      router.push(`/examiner/exams/${body.exam.id}`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create examination");
      setBusy(false);
    }
  }

  async function confirmDeleteDraft() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/exams/${deleteTarget.id}`, { method: "DELETE" });
      const body = await readApiJson<{ error?: { message?: string } }>(response);
      if (!response.ok) {
        throw new Error(parseApiError(body, "Failed to delete examination").message);
      }
      setExams((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <DataTableToolbar
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setCreateError(null);
              setFieldErrors({});
              setShowCreate(true);
            }}
            type="button"
          >
            <Plus size={16} /> Create examination
          </button>
        }
        filters={
          <select
            aria-label="Filter examinations by status"
            className="field w-auto min-w-40"
            onChange={(event) => setStatusFilter(event.target.value as "ALL" | ExamStatus)}
            value={statusFilter}
          >
            <option value="ALL">All statuses ({exams.length})</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ONGOING">Ongoing</option>
            <option value="COMPLETED">Completed</option>
          </select>
        }
        onSearchChange={setSearch}
        search={search}
        searchLabel="Search examinations"
        searchPlaceholder="Search title or instructions"
      />

      {error ? (
        <AlertBanner onDismiss={() => setError(null)} variant="error">
          {error}
        </AlertBanner>
      ) : null}

      {filteredExams.length === 0 ? (
        <section className="card">
          <EmptyState
            action={
              exams.length === 0 ? (
                <button className="btn-primary" onClick={() => setShowCreate(true)} type="button">
                  <Plus size={16} /> Create examination
                </button>
              ) : undefined
            }
            description={
              exams.length === 0
                ? "Create your first draft examination to configure schedules, fairness rules, and enrollments."
                : "No examinations match the current search or status filter."
            }
            icon={ClipboardList}
            title={exams.length === 0 ? "No examinations created yet" : "No matching examinations"}
          />
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {filteredExams.map((exam) => (
            <article className="card flex flex-col justify-between gap-4 p-5" key={exam.id}>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={exam.status} />
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    {exam.useStratifiedBlueprint ? "Stratified Blueprint" : "Fixed Questions"}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-bold text-[var(--text-primary)]">{exam.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{exam.instructions}</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-xs">
                  <div>
                    <dt className="text-[var(--text-muted)]">Duration</dt>
                    <dd className="font-mono-tabular mt-0.5 font-bold">{exam.durationMinutes} min</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">Marks</dt>
                    <dd className="font-mono-tabular mt-0.5 font-bold">
                      {exam.totalMarks} (pass {exam.passingMarks})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">Enrolled</dt>
                    <dd className="font-mono-tabular mt-0.5 font-bold">{exam.counts.enrollments}</dd>
                  </div>
                </dl>
                <p className="font-mono-tabular mt-3 text-xs text-[var(--text-muted)]">
                  Window: {new Date(exam.scheduledStart).toLocaleString()} —{" "}
                  {new Date(exam.scheduledEnd).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                {exam.status === "DRAFT" && exam.counts.attempts === 0 ? (
                  <button
                    aria-label={`Delete ${exam.title}`}
                    className="btn-danger h-9 px-3 text-xs"
                    disabled={busy}
                    onClick={() => setDeleteTarget(exam)}
                    type="button"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                ) : (
                  <span className="font-mono-tabular text-xs text-[var(--text-muted)]">
                    {exam.counts.attempts} attempt{exam.counts.attempts === 1 ? "" : "s"}
                  </span>
                )}
                <Link className="btn-primary h-9 px-3.5 text-sm" href={`/examiner/exams/${exam.id}`}>
                  Open builder <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}

      <Modal
        closeDisabled={busy}
        description="Configure initial schedule and grading rules, then customize questions and enrollments in the builder."
        eyebrow="New assessment"
        onClose={() => setShowCreate(false)}
        open={showCreate}
        size="lg"
        title="Create examination draft"
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={createExam}>
          {createError ? (
            <div className="md:col-span-2">
              <AlertBanner variant="error">{createError}</AlertBanner>
            </div>
          ) : null}

          <FormField className="md:col-span-2" error={fieldErrors.title} label="Examination Title" required>
            <input
              aria-invalid={Boolean(fieldErrors.title)}
              className="field"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., CS301 Distributed Systems Mid-Term"
              required
              value={title}
            />
          </FormField>

          <FormField className="md:col-span-2" error={fieldErrors.instructions} label="Candidate Instructions" required>
            <textarea
              aria-invalid={Boolean(fieldErrors.instructions)}
              className="field min-h-20"
              onChange={(e) => setInstructions(e.target.value)}
              required
              value={instructions}
            />
          </FormField>

          <FormField error={fieldErrors.scheduledStart} label="Scheduled Start" required>
            <input
              aria-invalid={Boolean(fieldErrors.scheduledStart)}
              className="field"
              onChange={(e) => setScheduledStart(e.target.value)}
              required
              type="datetime-local"
              value={scheduledStart}
            />
          </FormField>

          <FormField error={fieldErrors.scheduledEnd} label="Scheduled End" required>
            <input
              aria-invalid={Boolean(fieldErrors.scheduledEnd)}
              className="field"
              onChange={(e) => setScheduledEnd(e.target.value)}
              required
              type="datetime-local"
              value={scheduledEnd}
            />
          </FormField>

          <FormField error={fieldErrors.durationMinutes} label="Duration (minutes)" required>
            <input
              aria-invalid={Boolean(fieldErrors.durationMinutes)}
              className="field font-mono-tabular"
              min={1}
              onChange={(e) => setDurationMinutes(e.target.value)}
              required
              type="number"
              value={durationMinutes}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField error={fieldErrors.totalMarks} label="Total Marks" required>
              <input
                aria-invalid={Boolean(fieldErrors.totalMarks)}
                className="field font-mono-tabular"
                min={1}
                onChange={(e) => setTotalMarks(e.target.value)}
                required
                step="0.5"
                type="number"
                value={totalMarks}
              />
            </FormField>
            <FormField error={fieldErrors.passingMarks} label="Passing Marks" required>
              <input
                aria-invalid={Boolean(fieldErrors.passingMarks)}
                className="field font-mono-tabular"
                min={0}
                onChange={(e) => setPassingMarks(e.target.value)}
                required
                step="0.5"
                type="number"
                value={passingMarks}
              />
            </FormField>
          </div>

          <FormField label="Multi-select scoring rule">
            <select
              className="field"
              onChange={(e) => setMultiSelectRule(e.target.value as MultiSelectScoring)}
              value={multiSelectRule}
            >
              <option value="PARTIAL_NO_NEGATIVE">Partial credit (no negative)</option>
              <option value="ALL_OR_NOTHING">All or nothing</option>
              <option value="PARTIAL_WITH_NEGATIVE">Partial credit with negative penalty</option>
            </select>
          </FormField>

          <label className="flex items-center gap-3 self-end rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)]">
            <input
              checked={useStratifiedBlueprint}
              onChange={(e) => setUseStratifiedBlueprint(e.target.checked)}
              type="checkbox"
            />
            <span>Use Stratified Fairness Blueprint (5.2)</span>
          </label>

          <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4 md:col-span-2">
            <button className="btn-secondary" disabled={busy} onClick={() => setShowCreate(false)} type="button">
              Cancel
            </button>
            <button className="btn-primary" disabled={busy} type="submit">
              {busy ? "Creating…" : "Create draft & open builder"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        busy={busy}
        confirmLabel="Delete draft"
        consequence="Draft metadata, blueprint rules, and enrollments for this exam will be permanently removed."
        description={deleteTarget ? `Delete draft examination "${deleteTarget.title}"?` : ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteDraft()}
        open={Boolean(deleteTarget)}
        title="Delete draft examination"
        variant="danger"
      />
    </div>
  );
}
