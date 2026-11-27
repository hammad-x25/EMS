"use client";

import { ExamStatus } from "@prisma/client";
import { useState } from "react";
import { CheckCircle2, Play, Send, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { ExamDto } from "@/lib/exam-dto";

interface PendingTransition {
  target: ExamStatus;
  title: string;
  description: string;
  consequence: string;
  confirmLabel: string;
  variant: "default" | "danger";
}

export function PublishTab({
  exam,
  busy,
  marksReady,
  useStratifiedBlueprint,
  blueprintMarksTotal,
  assignedMarksTotal,
  enrollmentCount,
  onTransitionStatus,
}: {
  exam: ExamDto;
  busy: boolean;
  marksReady: boolean;
  useStratifiedBlueprint: boolean;
  blueprintMarksTotal: number;
  assignedMarksTotal: number;
  enrollmentCount: number;
  onTransitionStatus: (targetStatus: ExamStatus) => Promise<void>;
}) {
  const [pending, setPending] = useState<PendingTransition | null>(null);
  const validWindow = new Date(exam.scheduledEnd) > new Date(exam.scheduledStart);

  return (
    <section className="card space-y-5 p-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Pre-Publication Review &amp; Lifecycle Controls</h2>
        <p className="muted mt-1 text-sm">
          Verify schedule, paper marks, and enrollments before releasing this examination.
        </p>
      </div>

      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] p-3">
          <CheckCircle2
            className={validWindow ? "text-[var(--status-success-text)]" : "text-[var(--status-danger-text)]"}
            size={18}
          />
          <span className="font-mono-tabular">
            Schedule window: {new Date(exam.scheduledStart).toLocaleString()} →{" "}
            {new Date(exam.scheduledEnd).toLocaleString()} ({exam.durationMinutes} min)
          </span>
        </li>
        <li className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] p-3">
          <CheckCircle2
            className={marksReady ? "text-[var(--status-success-text)]" : "text-[var(--status-danger-text)]"}
            size={18}
          />
          <span className="font-mono-tabular">
            {useStratifiedBlueprint
              ? `Stratified Blueprint marks: ${blueprintMarksTotal} / ${exam.totalMarks}`
              : `Assigned question marks: ${assignedMarksTotal} / ${exam.totalMarks}`}
          </span>
        </li>
        <li className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] p-3">
          <Users className="text-[var(--accent-primary)]" size={18} />
          <span>
            Enrolled candidates: <strong className="font-mono-tabular">{enrollmentCount}</strong>
          </span>
        </li>
      </ul>

      <div className="flex flex-wrap gap-3 border-t border-[var(--border-subtle)] pt-4">
        {exam.status === ExamStatus.DRAFT ? (
          <button
            className="btn-primary"
            disabled={busy || !marksReady || !validWindow}
            onClick={() =>
              setPending({
                target: ExamStatus.PUBLISHED,
                title: "Publish examination",
                description: `Publish "${exam.title}" to ${enrollmentCount} enrolled candidate(s)?`,
                consequence: "Core settings, schedules, marks, and question rules will lock to protect integrity.",
                confirmLabel: "Publish examination",
                variant: "default",
              })
            }
            type="button"
          >
            <Send size={16} /> Publish examination
          </button>
        ) : null}

        {exam.status === ExamStatus.PUBLISHED ? (
          <>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                setPending({
                  target: ExamStatus.ONGOING,
                  title: "Open examination immediately",
                  description: `Transition "${exam.title}" to ONGOING right now?`,
                  consequence: "Enrolled candidates will immediately be allowed to enter and start their server timers.",
                  confirmLabel: "Open now (mark ONGOING)",
                  variant: "default",
                })
              }
              type="button"
            >
              <Play size={16} /> Open now (mark ONGOING)
            </button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() =>
                setPending({
                  target: ExamStatus.DRAFT,
                  title: "Revert examination to draft",
                  description: `Revert "${exam.title}" back to DRAFT status?`,
                  consequence: "Candidates will no longer see the scheduled exam until it is re-published.",
                  confirmLabel: "Revert to DRAFT",
                  variant: "default",
                })
              }
              type="button"
            >
              Revert to DRAFT
            </button>
          </>
        ) : null}

        {exam.status === ExamStatus.ONGOING ? (
          <button
            className="btn-danger"
            disabled={busy}
            onClick={() =>
              setPending({
                target: ExamStatus.COMPLETED,
                title: "Close & finalize examination",
                description: `Close "${exam.title}" and mark it COMPLETED?`,
                consequence: "No new attempts can start and ongoing submissions will be locked on closure.",
                confirmLabel: "Close & mark COMPLETED",
                variant: "danger",
              })
            }
            type="button"
          >
            Close &amp; mark COMPLETED
          </button>
        ) : null}

        {exam.status === ExamStatus.COMPLETED ? (
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            This examination is completed and sealed.
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        busy={busy}
        confirmLabel={pending?.confirmLabel ?? "Confirm"}
        consequence={pending?.consequence}
        description={pending?.description ?? ""}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) {
            void onTransitionStatus(pending.target).then(() => setPending(null));
          }
        }}
        open={Boolean(pending)}
        title={pending?.title ?? "Confirm action"}
        variant={pending?.variant ?? "default"}
      />
    </section>
  );
}
