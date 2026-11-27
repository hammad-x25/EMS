"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, Clock, FileText, Lock, PlayCircle, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import type { CandidateExamCardDto } from "@/app/api/candidate/exams/route";

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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500">
          Server clock reference: {new Date(serverNow).toLocaleString()}
        </p>
        <button
          className="btn-secondary px-3 py-1.5 text-xs"
          disabled={refreshing}
          onClick={() => void refreshBoard()}
          type="button"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh availability
        </button>
      </div>

      <section aria-labelledby="available-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <PlayCircle className="text-emerald-600" size={20} />
          <h2 className="text-xl font-black" id="available-heading">
            Available Now ({available.length})
          </h2>
        </div>
        {available.length === 0 ? (
          <p className="card p-6 text-sm text-slate-500">
            No examinations are currently open for entry.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {available.map((exam) => (
              <article className="card space-y-4 p-5" key={exam.examId}>
                <div className="flex items-center justify-between">
                  <span className="status-pill status-active">
                    {exam.accessState === "RESUME" ? "In Progress" : "Open for Entry"}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {exam.durationMinutes} min · {exam.totalMarks} marks
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black">{exam.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{exam.instructions}</p>
                </div>
                <p className="text-xs text-slate-500">
                  Closes: {new Date(exam.scheduledEnd).toLocaleString()}
                </p>
                <div className="flex justify-end">
                  <button
                    className="btn-primary text-sm"
                    onClick={() => setActiveExam(exam)}
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
          <CalendarClock className="text-indigo-600" size={20} />
          <h2 className="text-xl font-black" id="upcoming-heading">
            Upcoming ({upcoming.length})
          </h2>
        </div>
        {upcoming.length === 0 ? (
          <p className="card p-6 text-sm text-slate-500">No upcoming scheduled examinations.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((exam) => (
              <article className="card space-y-4 p-5" key={exam.examId}>
                <div className="flex items-center justify-between">
                  <span className="status-pill bg-indigo-50 text-indigo-700">
                    <Lock size={12} /> Scheduled
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {exam.durationMinutes} min · {exam.totalMarks} marks
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black">{exam.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{exam.instructions}</p>
                </div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                  <Clock size={14} /> Opens: {new Date(exam.scheduledStart).toLocaleString()}
                </p>
                <div className="flex justify-end">
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => setActiveExam(exam)}
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
          <CheckCircle2 className="text-slate-600" size={20} />
          <h2 className="text-xl font-black" id="completed-heading">
            Completed ({completed.length})
          </h2>
        </div>
        {completed.length === 0 ? (
          <p className="card p-6 text-sm text-slate-500">No completed examinations yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {completed.map((exam) => (
              <article className="card space-y-3 p-5" key={exam.examId}>
                <div className="flex items-center justify-between">
                  <span className="status-pill bg-slate-100 text-slate-700">
                    {exam.attempt?.resultsPublished ? "Results Published" : "Closed / Pending"}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {exam.totalMarks} marks
                  </span>
                </div>
                <h3 className="text-lg font-black">{exam.title}</h3>
                <p className="text-xs text-slate-500">
                  Ended: {new Date(exam.scheduledEnd).toLocaleString()}
                </p>
                {exam.attempt?.resultsPublished && exam.attempt.totalScore !== null ? (
                  <p className="text-sm font-bold text-emerald-700">
                    Published score: {exam.attempt.totalScore} / {exam.attempt.maxScore}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
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

      {activeExam ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="candidate-exam-modal-title"
        >
          <div className="card w-full max-w-xl space-y-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">{activeExam.accessState} examination</p>
                <h2 className="mt-1 text-xl font-black" id="candidate-exam-modal-title">
                  {activeExam.title}
                </h2>
              </div>
              <button
                aria-label="Close instructions"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setActiveExam(null)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-bold text-slate-900">Instructions</p>
              <p className="mt-1 whitespace-pre-wrap">{activeExam.instructions}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 p-3">
                <dt className="text-slate-500">Duration</dt>
                <dd className="mt-0.5 font-bold">{activeExam.durationMinutes} minutes</dd>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <dt className="text-slate-500">Marks</dt>
                <dd className="mt-0.5 font-bold">
                  {activeExam.totalMarks} total (pass {activeExam.passingMarks})
                </dd>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <dt className="text-slate-500">Availability Opens</dt>
                <dd className="mt-0.5 font-bold">
                  {new Date(activeExam.scheduledStart).toLocaleString()}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <dt className="text-slate-500">Availability Closes</dt>
                <dd className="mt-0.5 font-bold">
                  {new Date(activeExam.scheduledEnd).toLocaleString()}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span>
                {activeExam.accessState === "UPCOMING"
                  ? "Entry is locked on the backend until the scheduled start window opens."
                  : "Eligibility verified. The server timer starts only after you enter the workspace."}
              </span>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => setActiveExam(null)} type="button">Close</button>
                {activeExam.accessState === "AVAILABLE" || activeExam.accessState === "RESUME" ? (
                  <Link className="btn-primary" href={`/candidate/exams/${activeExam.examId}/take`}>
                    <PlayCircle size={16} /> {activeExam.accessState === "RESUME" ? "Resume attempt" : "Start examination"}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
