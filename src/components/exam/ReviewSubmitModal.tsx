"use client";

import { AlertTriangle, CheckCircle2, Flag } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Modal } from "@/components/ui/Modal";
import type { AttemptQuestionDto } from "@/lib/attempts";

export function ReviewSubmitModal({
  open,
  questions,
  busy,
  queuedCount = 0,
  submitError,
  onClose,
  onSubmit,
}: {
  open: boolean;
  questions: AttemptQuestionDto[];
  busy: boolean;
  queuedCount?: number;
  submitError?: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const answered = questions.filter((question) =>
    Boolean(question.answer?.selectedIds?.length || question.answer?.writtenText?.trim()),
  ).length;
  const marked = questions.filter((question) => question.answer?.markedForReview).length;
  const unanswered = questions.length - answered;

  return (
    <Modal
      closeDisabled={busy}
      closeLabel="Close review"
      eyebrow="Final check"
      onClose={onClose}
      open={open}
      size="md"
      title="Review & submit"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4">
            <CheckCircle2 aria-hidden="true" className="mx-auto text-[var(--status-success-text)]" size={20} />
            <p className="font-mono-tabular mt-2 text-2xl font-extrabold text-[var(--status-success-text)]">
              {answered}
            </p>
            <p className="text-xs font-semibold text-[var(--status-success-text)]">Answered</p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4">
            <AlertTriangle aria-hidden="true" className="mx-auto text-[var(--text-secondary)]" size={20} />
            <p className="font-mono-tabular mt-2 text-2xl font-extrabold text-[var(--text-primary)]">
              {unanswered}
            </p>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Unanswered</p>
          </div>
          <div className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4">
            <Flag aria-hidden="true" className="mx-auto text-[var(--status-warning-text)]" size={20} />
            <p className="font-mono-tabular mt-2 text-2xl font-extrabold text-[var(--status-warning-text)]">
              {marked}
            </p>
            <p className="text-xs font-semibold text-[var(--status-warning-text)]">For review</p>
          </div>
        </div>

        {unanswered > 0 || marked > 0 ? (
          <AlertBanner variant="warning">
            You can still return to inspect flagged or unanswered questions before final submission.
          </AlertBanner>
        ) : null}

        {queuedCount > 0 ? (
          <AlertBanner variant="info">
            {queuedCount} local answer change{queuedCount === 1 ? "" : "s"} will be synchronized with the server before finalization.
          </AlertBanner>
        ) : null}

        {submitError ? <AlertBanner variant="error">{submitError}</AlertBanner> : null}

        <p className="text-sm text-[var(--text-secondary)]">
          Submission is final and cannot be undone once confirmed.
        </p>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
          <button className="btn-secondary" disabled={busy} onClick={onClose} type="button">
            Return to exam
          </button>
          <button className="btn-primary" disabled={busy} onClick={onSubmit} type="button">
            {busy ? "Submitting…" : "Confirm final submission"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
