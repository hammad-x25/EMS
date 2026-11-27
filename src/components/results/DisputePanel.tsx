"use client";

import { DisputeStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { CheckCircle2, Clock, MessageSquareWarning, Plus, X } from "lucide-react";
import { DISPUTE_CATEGORIES, type DisputeCategory, type DisputeDto } from "@/lib/disputes";

const CATEGORY_LABELS: Record<DisputeCategory, string> = {
  GRADING_ERROR: "Grading Error",
  AMBIGUOUS_QUESTION: "Ambiguous Question",
  TECHNICAL_INCIDENT: "Technical / Connectivity Incident",
  INCIDENT_APPEAL: "Monitoring Incident Appeal",
};

const STATUS_STYLE: Record<DisputeStatus, string> = {
  OPEN: "bg-amber-50 text-amber-800",
  UNDER_REVIEW: "bg-indigo-50 text-indigo-700",
  RESOLVED_UPHELD: "bg-slate-100 text-slate-700",
  RESOLVED_ADJUSTED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submitDispute(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
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
      const body = (await response.json()) as {
        dispute?: DisputeDto;
        error?: { message?: string };
      };
      if (!response.ok || !body.dispute) {
        throw new Error(body.error?.message ?? "Unable to submit dispute");
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
          <h2 className="mt-1 text-xl font-black" id="disputes-heading">
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
          {showForm ? "Cancel" : "Raise a dispute"}
        </button>
      </div>

      {message ? (
        <div
          aria-live="polite"
          className={`rounded-xl border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {showForm ? (
        <form
          className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
          onSubmit={submitDispute}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold">
              Dispute category
              <select
                className="field mt-1.5"
                onChange={(e) => setCategory(e.target.value as DisputeCategory)}
                value={category}
              >
                {DISPUTE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {CATEGORY_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Related question <span className="font-normal text-slate-400">(optional)</span>
              <select
                className="field mt-1.5"
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
            </label>
          </div>
          <label className="block text-sm font-bold">
            Detailed explanation
            <textarea
              className="field mt-1.5 min-h-24"
              minLength={10}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the grading discrepancy, ambiguous phrasing, or technical interruption..."
              required
              value={description}
            />
          </label>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={busy} type="submit">
              <MessageSquareWarning size={16} />
              {busy ? "Submitting…" : "Submit dispute"}
            </button>
          </div>
        </form>
      ) : null}

      {disputes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No disputes filed for this attempt.
        </p>
      ) : (
        <div className="space-y-3">
          {disputes.map((item) => (
            <article className="rounded-2xl border border-slate-200 p-4" key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`status-pill ${STATUS_STYLE[item.status]}`}>
                    {item.status === "RESOLVED_ADJUSTED" ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <Clock size={13} />
                    )}
                    {item.status.replaceAll("_", " ")}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {CATEGORY_LABELS[item.category as DisputeCategory] ?? item.category}
                  </span>
                  {item.question ? (
                    <span className="text-xs text-slate-500">
                      · Question {item.question.displayOrder} ({item.question.topic})
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-slate-500">
                  Filed {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>

              <p className="mt-3 text-sm text-slate-800">{item.description}</p>

              {item.resolutionNote ? (
                <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
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
