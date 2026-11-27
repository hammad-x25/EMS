"use client";

import { ExamStatus, MultiSelectScoring } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Plus, Trash2, X } from "lucide-react";
import type { ExamDto } from "@/lib/exam-dto";

const statusStyle: Record<ExamStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PUBLISHED: "bg-indigo-50 text-indigo-700",
  ONGOING: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-amber-50 text-amber-800",
};

function toLocalDateTimeInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function ExamListManager({ initialExams }: { initialExams: ExamDto[] }) {
  const router = useRouter();
  const [exams, setExams] = useState<ExamDto[]>(initialExams);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function createExam(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
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
      const body = (await response.json()) as {
        exam?: ExamDto;
        error?: { message?: string };
      };
      if (!response.ok || !body.exam) {
        throw new Error(body.error?.message ?? "Failed to create examination");
      }
      router.push(`/examiner/exams/${body.exam.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create examination");
      setBusy(false);
    }
  }

  async function deleteDraft(examId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/exams/${examId}`, { method: "DELETE" });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Failed to delete examination");
      }
      setExams((current) => current.filter((item) => item.id !== examId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {exams.length} examination{exams.length === 1 ? "" : "s"} managed by your account
        </p>
        <button
          className="btn-primary"
          onClick={() => setShowCreate((v) => !v)}
          type="button"
        >
          {showCreate ? <X size={17} /> : <Plus size={17} />}
          {showCreate ? "Close" : "Create examination"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {showCreate ? (
        <form className="card grid gap-4 p-6 md:grid-cols-2" onSubmit={createExam}>
          <div className="md:col-span-2">
            <h2 className="text-lg font-black">New examination draft</h2>
            <p className="muted mt-1 text-sm">
              Configure schedule and marking rules, then attach questions or a fairness blueprint.
            </p>
          </div>
          <label className="text-sm font-bold md:col-span-2">
            Examination title
            <input
              className="field mt-1.5"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Midterm Assessment — Systems & Algorithms"
              required
              value={title}
            />
          </label>
          <label className="text-sm font-bold md:col-span-2">
            Candidate instructions
            <textarea
              className="field mt-1.5 min-h-20"
              onChange={(e) => setInstructions(e.target.value)}
              required
              value={instructions}
            />
          </label>
          <label className="text-sm font-bold">
            Window start
            <input
              className="field mt-1.5"
              onChange={(e) => setScheduledStart(e.target.value)}
              required
              type="datetime-local"
              value={scheduledStart}
            />
          </label>
          <label className="text-sm font-bold">
            Window end
            <input
              className="field mt-1.5"
              onChange={(e) => setScheduledEnd(e.target.value)}
              required
              type="datetime-local"
              value={scheduledEnd}
            />
          </label>
          <label className="text-sm font-bold">
            Duration (minutes)
            <input
              className="field mt-1.5"
              min={1}
              onChange={(e) => setDurationMinutes(e.target.value)}
              required
              type="number"
              value={durationMinutes}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-bold">
              Total marks
              <input
                className="field mt-1.5"
                min={1}
                onChange={(e) => setTotalMarks(e.target.value)}
                required
                step="0.5"
                type="number"
                value={totalMarks}
              />
            </label>
            <label className="text-sm font-bold">
              Passing marks
              <input
                className="field mt-1.5"
                min={0}
                onChange={(e) => setPassingMarks(e.target.value)}
                required
                step="0.5"
                type="number"
                value={passingMarks}
              />
            </label>
          </div>
          <label className="text-sm font-bold">
            Multi-select scoring rule
            <select
              className="field mt-1.5"
              onChange={(e) => setMultiSelectRule(e.target.value as MultiSelectScoring)}
              value={multiSelectRule}
            >
              <option value="PARTIAL_NO_NEGATIVE">Partial credit (no negative)</option>
              <option value="ALL_OR_NOTHING">All or nothing</option>
              <option value="PARTIAL_WITH_NEGATIVE">Partial credit with negative penalty</option>
            </select>
          </label>
          <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold">
            <input
              checked={useStratifiedBlueprint}
              onChange={(e) => setUseStratifiedBlueprint(e.target.checked)}
              type="checkbox"
            />
            Use Stratified Fairness Blueprint (5.2)
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary" disabled={busy} type="submit">
              {busy ? "Creating…" : "Create draft & open builder"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {exams.map((exam) => (
          <article className="card flex flex-col justify-between gap-4 p-5" key={exam.id}>
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className={`status-pill ${statusStyle[exam.status]}`}>{exam.status}</span>
                <span className="text-xs font-semibold text-slate-500">
                  {exam.useStratifiedBlueprint ? "Stratified Blueprint" : "Fixed Questions"}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-black text-slate-900">{exam.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{exam.instructions}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                <div>
                  <dt className="text-slate-500">Duration</dt>
                  <dd className="mt-0.5 font-bold">{exam.durationMinutes} min</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Marks</dt>
                  <dd className="mt-0.5 font-bold">
                    {exam.totalMarks} (pass {exam.passingMarks})
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Enrolled</dt>
                  <dd className="mt-0.5 font-bold">{exam.counts.enrollments}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-500">
                Window: {new Date(exam.scheduledStart).toLocaleString()} —{" "}
                {new Date(exam.scheduledEnd).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              {exam.status === "DRAFT" && exam.counts.attempts === 0 ? (
                <button
                  aria-label={`Delete ${exam.title}`}
                  className="btn-danger px-3 py-1.5 text-xs"
                  disabled={busy}
                  onClick={() => void deleteDraft(exam.id)}
                  type="button"
                >
                  <Trash2 size={14} /> Delete
                </button>
              ) : (
                <span className="text-xs text-slate-400">
                  {exam.counts.attempts} attempt{exam.counts.attempts === 1 ? "" : "s"}
                </span>
              )}
              <Link className="btn-primary px-3.5 py-2 text-sm" href={`/examiner/exams/${exam.id}`}>
                Open builder <ArrowRight size={15} />
              </Link>
            </div>
          </article>
        ))}
      </section>

      {exams.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-500">
          No examinations created yet. Click &ldquo;Create examination&rdquo; to configure your first test.
        </div>
      ) : null}
    </div>
  );
}
