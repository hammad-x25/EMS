"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { MessageSquareWarning, Plus, X } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { FormField } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DISPUTE_CATEGORIES, type DisputeCategory, type DisputeDto } from "@/lib/dispute-types";
import { parseApiError, readApiJson } from "@/lib/form-errors";

const CATEGORY_LABELS: Record<DisputeCategory, string> = {
  GRADING_ERROR: "Grading Error",
  AMBIGUOUS_QUESTION: "Ambiguous Question",
  TECHNICAL_INCIDENT: "Technical / Connectivity Incident",
  INCIDENT_APPEAL: "Monitoring Incident Appeal",
};

export function DisputePanel({
  attemptId,
  questions,
  initialDisputes,
}: {
  attemptId: string;
  questions: Array<{
    snapshotId: string;
    displayOrder: number;
    topic: string;
    maxMarks: number;
  }>;
  initialDisputes: DisputeDto[];
}) {
  const router = useRouter();
  const [disputes, setDisputes] = useState<DisputeDto[]>(initialDisputes);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<DisputeCategory>("GRADING_ERROR");
  const [snapshotId, setSnapshotId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submitDispute(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/disputes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptId,
          snapshotId: snapshotId || null,
          category,
          description,
        }),
      });
      const body = await readApiJson<{ dispute?: DisputeDto; error?: { message?: string; details?: unknown } }>(response);
      if (!response.ok || !body?.dispute) {
        const parsed = parseApiError(body, "Unable to submit dispute");
        setFieldErrors(parsed.fieldErrors);
        throw new Error(parsed.formErrors[0] ?? parsed.message);
      }
      setDisputes((current) => [body.dispute!, ...current]);
      setDescription("");
      setSnapshotId("");
      setShowForm(false);
      setMessage({
        type: "success",
        text: "Dispute submitted and logged in the audit trail for examiner review.",
      });
      router.refresh();
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to file dispute",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="disputes-heading" className="card space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Trust &amp; dispute resolution</p>
          <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]" id="disputes-heading">
            Result Appeals &amp; Disputes ({disputes.length})
          </h2>
          <p className="muted mt-1 text-sm">
            Request a transparent review of grading, ambiguous questions, or technical disruptions.
          </p>
        </div>
        <button
          className={showForm ? "btn-secondary" : "btn-primary"}
          onClick={() => setShowForm((v) => !v)}
          type="button"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          <span>{showForm ? "Cancel" : "Raise a dispute"}</span>
        </button>
      </div>

      {message ? (
        <AlertBanner onDismiss={() => setMessage(null)} variant={message.type}>
          {message.text}
        </AlertBanner>
      ) : null}

      {showForm ? (
        <form
          className="space-y-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-5"
          onSubmit={submitDispute}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Dispute category" required>
              <select
                className="field"
                onChange={(e) => setCategory(e.target.value as DisputeCategory)}
                value={category}
              >
                {DISPUTE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {CATEGORY_LABELS[item]}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField hint="Optional" label="Related question">
              <select
                className="field"
                onChange={(e) => setSnapshotId(e.target.value)}
                value={snapshotId}
              >
                <option value="">Entire attempt / general technical incident</option>
                {questions.map((q) => (
                  <option key={q.snapshotId} value={q.snapshotId}>
                    Question {q.displayOrder} · {q.topic} ({q.maxMarks}m)
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField error={fieldErrors.description} label="Detailed explanation" required>
            <textarea
              aria-invalid={Boolean(fieldErrors.description)}
              className="field min-h-24"
              minLength={10}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the grading discrepancy, ambiguous phrasing, or technical interruption..."
              required
              value={description}
            />
          </FormField>

          <div className="flex justify-end">
            <button className="btn-primary" disabled={busy} type="submit">
              <MessageSquareWarning size={16} />
              <span>{busy ? "Submitting…" : "Submit dispute"}</span>
            </button>
          </div>
        </form>
      ) : null}

      {disputes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-6 text-center text-sm text-[var(--text-secondary)]">
          No disputes filed for this attempt.
        </p>
      ) : (
        <div className="space-y-3">
          {disputes.map((item) => (
            <article className="rounded-lg border border-[var(--border-subtle)] p-4" key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.status} />
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    {CATEGORY_LABELS[item.category as DisputeCategory] ?? item.category}
                  </span>
                  {item.question ? (
                    <span className="text-xs text-[var(--text-muted)]">
                      · Question {item.question.displayOrder} ({item.question.topic})
                    </span>
                  ) : null}
                </div>
                <span className="font-mono-tabular text-xs text-[var(--text-muted)]">
                  Filed {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>

              <p className="mt-3 text-sm text-[var(--text-primary)]">{item.description}</p>

              {item.resolutionNote ? (
                <div className="mt-3 rounded-lg border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-3 text-sm text-[var(--status-info-text)]">
                  <p className="font-bold">
                    Examiner resolution
                    {item.scoreDelta !== null
                      ? ` (${item.scoreDelta >= 0 ? "+" : ""}${item.scoreDelta} marks)`
                      : ""}
                    :
                  </p>
                  <p className="mt-1">{item.resolutionNote}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
