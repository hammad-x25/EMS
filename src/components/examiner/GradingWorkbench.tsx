"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, Send, UserRoundCheck } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { DataTableToolbar } from "@/components/ui/DataTableControls";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { parseApiError, readApiJson } from "@/lib/form-errors";

interface GradingResponse {
  snapshotId: string;
  displayOrder: number;
  type: string;
  topic: string;
  prompt: string;
  maxMarks: number;
  writtenText: string | null;
  autoScore: number;
  manualScore: number | null;
  graderFeedback: string | null;
}

interface GradingAttempt {
  id: string;
  candidate: { id: string; name: string; studentId: string | null };
  status: string;
  totalScore: number | null;
  maxScore: number;
  responses: GradingResponse[];
}

interface GradingPayload {
  exam: { id: string; title: string; totalMarks: number; resultsPublishedAt: string | null };
  attempts: GradingAttempt[];
}

export function GradingWorkbench({ examId }: { examId: string }) {
  const [data, setData] = useState<GradingPayload | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "info" | "success" | "error"; text: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/exams/${examId}/grading`);
    const body = await readApiJson<GradingPayload & { error?: { message?: string } }>(response);
    if (!response.ok || !body) {
      setNotice({ type: "error", text: parseApiError(body, "Unable to load grading data").message });
      return;
    }
    setData(body);
    setActiveAttemptId((current) => current ?? body.attempts[0]?.id ?? null);
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  const gradedCount = data?.attempts.filter((attempt) => ["GRADED", "PUBLISHED"].includes(attempt.status)).length ?? 0;
  const pendingWritten = useMemo(
    () =>
      data?.attempts.reduce(
        (sum, attempt) =>
          sum + attempt.responses.filter((response) => response.type === "WRITTEN" && response.manualScore === null).length,
        0,
      ) ?? 0,
    [data],
  );

  const visibleAttempts = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.attempts.filter((attempt) => {
      const matchesSearch =
        !q || `${attempt.candidate.name} ${attempt.candidate.studentId ?? ""}`.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (onlyPending) {
        return attempt.responses.some((r) => r.type === "WRITTEN" && r.manualScore === null);
      }
      return true;
    });
  }, [data, search, onlyPending]);

  const active =
    visibleAttempts.find((attempt) => attempt.id === activeAttemptId) ??
    data?.attempts.find((attempt) => attempt.id === activeAttemptId) ??
    null;

  async function saveGrade(event: FormEvent<HTMLFormElement>, attemptId: string, response: GradingResponse) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyKey(response.snapshotId);
    setNotice(null);
    const request = await fetch(`/api/exams/${examId}/grading`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId,
        snapshotId: response.snapshotId,
        manualScore: Number(form.get("manualScore")),
        graderFeedback: String(form.get("feedback") ?? "") || null,
      }),
    });
    const body = await readApiJson<GradingPayload & { error?: { message?: string } }>(request);
    setBusyKey(null);
    if (!request.ok || !body) {
      setNotice({ type: "error", text: parseApiError(body, "Grade could not be saved").message });
      return;
    }
    setData({ exam: body.exam, attempts: body.attempts });
    setNotice({ type: "success", text: "Manual grade saved and attempt totals recomputed." });
  }

  async function publish() {
    setBusyKey("publish");
    setNotice(null);
    const response = await fetch(`/api/exams/${examId}/publish-results`, { method: "POST" });
    const body = await readApiJson<{ error?: { message?: string }; publishedAttempts?: number }>(response);
    setBusyKey(null);
    if (!response.ok) {
      setNotice({ type: "error", text: parseApiError(body, "Results could not be published").message });
      return;
    }
    setNotice({
      type: "success",
      text: `${body?.publishedAttempts ?? 0} results published to candidates.`,
    });
    setPreviewOpen(false);
    await load();
  }

  if (!data) {
    return (
      <div className="card p-8 text-center">
        <p className="font-bold text-[var(--text-primary)]">Preparing objective scores and written responses…</p>
        {notice ? <div className="mt-4"><AlertBanner variant={notice.type}>{notice.text}</AlertBanner></div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Examinations", href: "/examiner/exams" },
          { label: data.exam.title, href: `/examiner/exams/${examId}` },
          { label: "Grading" },
        ]}
      />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Evaluation &amp; grading</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-3xl">
            {data.exam.title}
          </h1>
          <p className="muted mt-1 text-sm">
            Objective answers are scored automatically; written marks remain examiner-controlled.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono-tabular rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold">
            {gradedCount}/{data.attempts.length} graded · {pendingWritten} written pending
          </span>
          <button
            className="btn-primary"
            disabled={data.attempts.length === 0}
            onClick={() => setPreviewOpen(true)}
            type="button"
          >
            <Eye size={16} /> Preview result summary
          </button>
        </div>
      </header>

      {notice ? (
        <AlertBanner onDismiss={() => setNotice(null)} variant={notice.type}>
          {notice.text}
        </AlertBanner>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="card h-fit space-y-3 p-4">
          <h2 className="text-base font-bold text-[var(--text-primary)]">Candidates ({visibleAttempts.length})</h2>
          <DataTableToolbar
            onSearchChange={setSearch}
            search={search}
            searchLabel="Search grading candidates"
            searchPlaceholder="Search name or ID…"
          />
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
            <input
              checked={onlyPending}
              onChange={(event) => setOnlyPending(event.target.checked)}
              type="checkbox"
            />
            <span>Needs written grading only</span>
          </label>
          <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-0.5">
            {visibleAttempts.map((attempt) => (
              <button
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  activeAttemptId === attempt.id
                    ? "border-[var(--accent-primary)] bg-[var(--accent-soft)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)]"
                }`}
                key={attempt.id}
                onClick={() => setActiveAttemptId(attempt.id)}
                type="button"
              >
                <div className="flex justify-between gap-2">
                  <strong className="text-sm text-[var(--text-primary)]">{attempt.candidate.name}</strong>
                  <span className="font-mono-tabular text-xs font-bold">
                    {attempt.totalScore ?? 0}/{attempt.maxScore}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {attempt.status} · {attempt.candidate.studentId ?? "No ID"}
                </p>
              </button>
            ))}
            {visibleAttempts.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--text-secondary)]">
                {data.attempts.length === 0 ? "No finalized real attempts." : "No matching candidates."}
              </p>
            ) : null}
          </div>
        </aside>

        <section className="space-y-4">
          {active ? (
            <>
              <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">{active.candidate.name}</h2>
                  <p className="font-mono-tabular text-sm text-[var(--text-secondary)]">
                    Current total {active.totalScore ?? 0} / {active.maxScore}
                  </p>
                </div>
                <StatusBadge label={active.status} status={active.status} />
              </div>

              {active.responses
                .filter((response) => response.type === "WRITTEN")
                .map((response) => (
                  <form
                    className="card p-5"
                    key={response.snapshotId}
                    onSubmit={(event) => void saveGrade(event, active.id, response)}
                  >
                    <p className="eyebrow">
                      Question {response.displayOrder} · {response.topic}
                    </p>
                    <h3 className="mt-1.5 font-bold text-[var(--text-primary)]">{response.prompt}</h3>
                    <div className="mt-3 whitespace-pre-wrap rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 text-sm">
                      {response.writtenText?.trim() || (
                        <em className="text-[var(--text-muted)]">No written response submitted.</em>
                      )}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr]">
                      <label className="text-sm font-semibold">
                        Score / {response.maxMarks}
                        <input
                          className="field font-mono-tabular mt-1"
                          defaultValue={response.manualScore ?? ""}
                          max={response.maxMarks}
                          min={0}
                          name="manualScore"
                          required
                          step="0.25"
                          type="number"
                        />
                      </label>
                      <label className="text-sm font-semibold">
                        Feedback
                        <textarea
                          className="field mt-1 min-h-20"
                          defaultValue={response.graderFeedback ?? ""}
                          name="feedback"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        className="btn-primary"
                        disabled={busyKey === response.snapshotId || data.exam.resultsPublishedAt !== null}
                        type="submit"
                      >
                        <CheckCircle2 size={16} />{" "}
                        {busyKey === response.snapshotId ? "Saving…" : "Save grade"}
                      </button>
                    </div>
                  </form>
                ))}

              {active.responses.every((response) => response.type !== "WRITTEN") ? (
                <div className="card p-8 text-center text-sm text-[var(--text-secondary)]">
                  <UserRoundCheck aria-hidden="true" className="mx-auto mb-2 text-[var(--accent-primary)]" size={24} />
                  This paper contains no written questions. Objective grading is complete.
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>

      <Modal
        closeDisabled={busyKey === "publish"}
        eyebrow="Pre-publication checkpoint"
        onClose={() => setPreviewOpen(false)}
        open={previewOpen}
        size="md"
        title="Result summary"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4">
              <p className="font-mono-tabular text-2xl font-extrabold">{data.attempts.length}</p>
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Attempts</p>
            </div>
            <div className="rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4">
              <p className="font-mono-tabular text-2xl font-extrabold text-[var(--status-success-text)]">
                {gradedCount}
              </p>
              <p className="text-xs font-semibold text-[var(--status-success-text)]">Fully graded</p>
            </div>
            <div className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4">
              <p className="font-mono-tabular text-2xl font-extrabold text-[var(--status-warning-text)]">
                {pendingWritten}
              </p>
              <p className="text-xs font-semibold text-[var(--status-warning-text)]">Written pending</p>
            </div>
          </div>

          {pendingWritten > 0 ? (
            <AlertBanner variant="warning">
              Grade all {pendingWritten} pending written response(s) before publishing results.
            </AlertBanner>
          ) : null}

          <p className="text-sm text-[var(--text-secondary)]">
            Publishing makes scores and PDF reports visible to candidates. Correct answers remain hidden unless enabled in exam settings.
          </p>

          <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
            <button className="btn-secondary" disabled={busyKey === "publish"} onClick={() => setPreviewOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={pendingWritten > 0 || busyKey === "publish" || data.exam.resultsPublishedAt !== null}
              onClick={() => void publish()}
              type="button"
            >
              <Send size={16} />{" "}
              {data.exam.resultsPublishedAt
                ? "Already published"
                : busyKey === "publish"
                  ? "Publishing…"
                  : "Publish results"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
