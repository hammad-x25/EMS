"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, Clock, FileText, Lock, PlayCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { CandidateExamCardDto } from "@/app/api/candidate/exams/route";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function CandidateExamsBoard({
  initialServerNow,
  initialAvailable,
  initialUpcoming,
  initialCompleted,
}: {
  initialServerNow: string;
  initialAvailable: CandidateExamCardDto[];
  initialUpcoming: CandidateExamCardDto[];
  initialCompleted: CandidateExamCardDto[];
}) {
  const [serverNow, setServerNow] = useState(initialServerNow);
  const [available, setAvailable] = useState(initialAvailable);
  const [upcoming, setUpcoming] = useState(initialUpcoming);
  const [completed, setCompleted] = useState(initialCompleted);
  const [activeExam, setActiveExam] = useState<CandidateExamCardDto | null>(null);
  const [readyConfirmed, setReadyConfirmed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function refreshBoard() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/candidate/exams");
      if (!response.ok) return;
      const body = (await response.json()) as {
        serverNow: string;
        available: CandidateExamCardDto[];
        upcoming: CandidateExamCardDto[];
        completed: CandidateExamCardDto[];
      };
      setServerNow(body.serverNow);
      setAvailable(body.available);
      setUpcoming(body.upcoming);
      setCompleted(body.completed);
    } finally {
      setRefreshing(false);
    }
  }

  function openBriefing(exam: CandidateExamCardDto) {
    setReadyConfirmed(exam.accessState !== "AVAILABLE");
    setActiveExam(exam);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono-tabular text-xs font-semibold text-[var(--text-secondary)]">
          Server clock reference: {new Date(serverNow).toLocaleString()}
        </p>
        <button
          className="btn-secondary h-9 px-3 text-xs"
          disabled={refreshing}
          onClick={() => void refreshBoard()}
          type="button"
        >
          <RefreshCw aria-hidden="true" className={refreshing ? "animate-spin" : ""} size={14} />
          <span>Refresh availability</span>
        </button>
      </div>

      <section aria-labelledby="available-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <PlayCircle aria-hidden="true" className="text-[var(--status-success-text)]" size={20} />
          <h2 className="text-xl font-bold text-[var(--text-primary)]" id="available-heading">
            Available Now ({available.length})
          </h2>
        </div>

        {available.length === 0 ? (
          <p className="card p-6 text-sm text-[var(--text-secondary)]">
            No examinations are currently open for entry.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {available.map((exam) => (
              <article className="card flex flex-col justify-between gap-4 p-5" key={exam.examId}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge
                      label={exam.accessState === "RESUME" ? "In Progress" : "Open for Entry"}
                      status={exam.accessState}
                    />
                    <span className="font-mono-tabular text-xs font-bold text-[var(--text-secondary)]">
                      {exam.durationMinutes} min · {exam.totalMarks} marks
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">{exam.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{exam.instructions}</p>
                  </div>
                  <p className="font-mono-tabular text-xs text-[var(--text-muted)]">
                    Closes: {new Date(exam.scheduledEnd).toLocaleString()}
                  </p>
                </div>
                <div className="flex justify-end border-t border-[var(--border-subtle)] pt-3">
                  <button
                    className="btn-primary text-sm"
                    onClick={() => openBriefing(exam)}
                    type="button"
                  >
                    <FileText size={16} /> View instructions &amp; status
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="upcoming-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarClock aria-hidden="true" className="text-[var(--accent-primary)]" size={20} />
          <h2 className="text-xl font-bold text-[var(--text-primary)]" id="upcoming-heading">
            Upcoming ({upcoming.length})
          </h2>
        </div>

        {upcoming.length === 0 ? (
          <p className="card p-6 text-sm text-[var(--text-secondary)]">No upcoming scheduled examinations.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((exam) => (
              <article className="card flex flex-col justify-between gap-4 p-5" key={exam.examId}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge label="Scheduled" status="UPCOMING" />
                    <span className="font-mono-tabular text-xs font-bold text-[var(--text-secondary)]">
                      {exam.durationMinutes} min · {exam.totalMarks} marks
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">{exam.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{exam.instructions}</p>
                  </div>
                  <p className="font-mono-tabular flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)]">
                    <Clock aria-hidden="true" size={14} /> Opens: {new Date(exam.scheduledStart).toLocaleString()}
                  </p>
                </div>
                <div className="flex justify-end border-t border-[var(--border-subtle)] pt-3">
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => openBriefing(exam)}
                    type="button"
                  >
                    <FileText size={16} /> View instructions
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="completed-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 aria-hidden="true" className="text-[var(--text-secondary)]" size={20} />
          <h2 className="text-xl font-bold text-[var(--text-primary)]" id="completed-heading">
            Completed ({completed.length})
          </h2>
        </div>

        {completed.length === 0 ? (
          <p className="card p-6 text-sm text-[var(--text-secondary)]">No completed examinations yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {completed.map((exam) => (
              <article className="card space-y-3 p-5" key={exam.examId}>
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge
                    label={exam.attempt?.resultsPublished ? "Results Published" : "Closed / Pending"}
                    status={exam.attempt?.resultsPublished ? "PUBLISHED" : "COMPLETED"}
                  />
                  <span className="font-mono-tabular text-xs font-bold text-[var(--text-secondary)]">
                    {exam.totalMarks} marks
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">{exam.title}</h3>
                <div className="font-mono-tabular space-y-0.5 text-xs text-[var(--text-muted)]">
                  <p>Window closed: {new Date(exam.scheduledEnd).toLocaleString()}</p>
                  {exam.attempt?.submittedAt ? (
                    <p>Submitted: {new Date(exam.attempt.submittedAt).toLocaleString()}</p>
                  ) : null}
                </div>
                {exam.attempt?.resultsPublished && exam.attempt.totalScore !== null ? (
                  <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
                    <p className="font-mono-tabular text-sm font-bold text-[var(--status-success-text)]">
                      Published score: {exam.attempt.totalScore} / {exam.attempt.maxScore}
                    </p>
                    <Link className="btn-primary h-9 px-3 text-xs" href={`/candidate/results/${exam.attempt.id}`}>
                      View result
                    </Link>
                  </div>
                ) : (
                  <p className="border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-secondary)]">
                    {exam.attempt
                      ? `Attempt status: ${exam.attempt.status} (awaiting publication)`
                      : "No submission recorded"}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal
        closeLabel="Close instructions"
        eyebrow={activeExam ? `${activeExam.accessState} examination` : undefined}
        onClose={() => setActiveExam(null)}
        open={Boolean(activeExam)}
        size="lg"
        title={activeExam?.title ?? "Examination instructions"}
      >
        {activeExam ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 text-sm text-[var(--text-primary)]">
              <p className="font-bold">Instructions</p>
              <p className="mt-1 whitespace-pre-wrap leading-6 text-[var(--text-secondary)]">
                {activeExam.instructions}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <dt className="text-[var(--text-muted)]">Duration</dt>
                <dd className="font-mono-tabular mt-0.5 font-bold">{activeExam.durationMinutes} minutes</dd>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <dt className="text-[var(--text-muted)]">Marks</dt>
                <dd className="font-mono-tabular mt-0.5 font-bold">
                  {activeExam.totalMarks} total (pass {activeExam.passingMarks})
                </dd>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <dt className="text-[var(--text-muted)]">Availability Opens</dt>
                <dd className="font-mono-tabular mt-0.5 font-bold">
                  {new Date(activeExam.scheduledStart).toLocaleString()}
                </dd>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <dt className="text-[var(--text-muted)]">Availability Closes</dt>
                <dd className="font-mono-tabular mt-0.5 font-bold">
                  {new Date(activeExam.scheduledEnd).toLocaleString()}
                </dd>
              </div>
            </dl>

            {activeExam.accessState === "UPCOMING" ? (
              <AlertBanner variant="info">
                <Lock aria-hidden="true" className="mr-1 inline" size={14} /> Entry is locked on the backend until the scheduled start window opens.
              </AlertBanner>
            ) : (
              <AlertBanner variant="info">
                One timed attempt is permitted. Once entered, the server deadline cannot be paused, and answers queue safely offline if your connection drops.
              </AlertBanner>
            )}

            {activeExam.accessState === "AVAILABLE" ? (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-sm font-semibold text-[var(--text-primary)]">
                <input
                  checked={readyConfirmed}
                  className="mt-1"
                  onChange={(event) => setReadyConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  I am ready to begin my timed examination attempt and understand the server clock starts upon entry.
                </span>
              </label>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
              <button className="btn-secondary" onClick={() => setActiveExam(null)} type="button">
                Close
              </button>
              {activeExam.accessState === "RESUME" ? (
                <Link className="btn-primary" href={`/candidate/exams/${activeExam.examId}/take`}>
                  <PlayCircle size={16} /> Resume attempt
                </Link>
              ) : activeExam.accessState === "AVAILABLE" ? (
                readyConfirmed ? (
                  <Link className="btn-primary" href={`/candidate/exams/${activeExam.examId}/take`}>
                    <PlayCircle size={16} /> Start examination
                  </Link>
                ) : (
                  <button className="btn-primary" disabled type="button">
                    <PlayCircle size={16} /> Start examination
                  </button>
                )
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
