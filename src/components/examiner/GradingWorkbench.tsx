"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, Send, UserRoundCheck } from "lucide-react";

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
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function load() {
    const response = await fetch(`/api/exams/${examId}/grading`);
    const body = await response.json() as GradingPayload & { error?: { message?: string } };
    if (!response.ok) return setNotice(body.error?.message ?? "Unable to load grading data");
    setData(body);
    setActiveAttemptId((current) => current ?? body.attempts[0]?.id ?? null);
  }
  // The loader intentionally reruns only when the examination changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [examId]);
  const active = data?.attempts.find((attempt) => attempt.id === activeAttemptId) ?? null;
  const gradedCount = data?.attempts.filter((attempt) => ["GRADED", "PUBLISHED"].includes(attempt.status)).length ?? 0;
  const pendingWritten = useMemo(() => data?.attempts.reduce((sum, attempt) => sum + attempt.responses.filter((response) => response.type === "WRITTEN" && response.manualScore === null).length, 0) ?? 0, [data]);

  async function saveGrade(event: FormEvent<HTMLFormElement>, attemptId: string, response: GradingResponse) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyKey(response.snapshotId);
    const request = await fetch(`/api/exams/${examId}/grading`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId, snapshotId: response.snapshotId, manualScore: Number(form.get("manualScore")), graderFeedback: String(form.get("feedback") ?? "") || null }) });
    const body = await request.json() as GradingPayload & { error?: { message?: string } };
    setBusyKey(null);
    if (!request.ok) return setNotice(body.error?.message ?? "Grade could not be saved");
    setData({ exam: body.exam, attempts: body.attempts });
    setNotice("Manual grade saved and attempt totals recomputed.");
  }

  async function publish() {
    setBusyKey("publish");
    const response = await fetch(`/api/exams/${examId}/publish-results`, { method: "POST" });
    const body = await response.json() as { error?: { message?: string }; publishedAttempts?: number };
    setBusyKey(null);
    if (!response.ok) return setNotice(body.error?.message ?? "Results could not be published");
    setNotice(`${body.publishedAttempts} results published to candidates.`);
    setPreviewOpen(false);
    await load();
  }

  if (!data) return <div className="card p-8 text-center"><p className="font-black">Preparing objective scores and written responses…</p>{notice ? <p className="mt-2 text-sm text-rose-700">{notice}</p> : null}</div>;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Evaluation &amp; grading</p><h1 className="mt-1 text-3xl font-black">{data.exam.title}</h1><p className="muted mt-1">Objective answers are scored automatically; written marks remain examiner-controlled.</p></div><button className="btn-primary" disabled={data.attempts.length === 0} onClick={() => setPreviewOpen(true)} type="button"><Eye size={16} /> Preview result summary</button></header>
      {notice ? <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">{notice}</div> : null}
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><aside className="card h-fit p-4"><h2 className="font-black">Candidates</h2><div className="mt-3 space-y-2">{data.attempts.map((attempt) => <button className={`w-full rounded-xl border p-3 text-left ${activeAttemptId === attempt.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`} key={attempt.id} onClick={() => setActiveAttemptId(attempt.id)} type="button"><div className="flex justify-between gap-2"><strong className="text-sm">{attempt.candidate.name}</strong><span className="text-xs font-bold">{attempt.totalScore ?? 0}/{attempt.maxScore}</span></div><p className="mt-1 text-xs text-slate-500">{attempt.status} · {attempt.candidate.studentId ?? "No ID"}</p></button>)}{data.attempts.length === 0 ? <p className="text-sm text-slate-500">No finalized real attempts.</p> : null}</div></aside><section className="space-y-4">{active ? <><div className="card flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="text-xl font-black">{active.candidate.name}</h2><p className="text-sm text-slate-500">Current total {active.totalScore ?? 0} / {active.maxScore}</p></div><span className="status-pill bg-indigo-50 text-indigo-700"><UserRoundCheck size={14} /> {active.status}</span></div>{active.responses.filter((response) => response.type === "WRITTEN").map((response) => <form className="card p-6" key={response.snapshotId} onSubmit={(event) => void saveGrade(event, active.id, response)}><p className="eyebrow">Question {response.displayOrder} · {response.topic}</p><h3 className="mt-2 font-black">{response.prompt}</h3><div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm whitespace-pre-wrap">{response.writtenText?.trim() || <em className="text-slate-500">No written response submitted.</em>}</div><div className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr]"><label className="text-sm font-bold">Score / {response.maxMarks}<input className="field mt-1" defaultValue={response.manualScore ?? ""} max={response.maxMarks} min={0} name="manualScore" required step="0.25" type="number" /></label><label className="text-sm font-bold">Feedback<textarea className="field mt-1 min-h-20" defaultValue={response.graderFeedback ?? ""} name="feedback" /></label></div><div className="mt-4 flex justify-end"><button className="btn-primary" disabled={busyKey === response.snapshotId || data.exam.resultsPublishedAt !== null} type="submit"><CheckCircle2 size={16} /> {busyKey === response.snapshotId ? "Saving…" : "Save grade"}</button></div></form>)}{active.responses.every((response) => response.type !== "WRITTEN") ? <div className="card p-8 text-center text-sm text-slate-500">This paper contains no written questions. Objective grading is complete.</div> : null}</> : null}</section></div>
      {previewOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true"><section className="card w-full max-w-lg p-6"><p className="eyebrow">Pre-publication checkpoint</p><h2 className="mt-1 text-xl font-black">Result summary</h2><div className="mt-5 grid grid-cols-3 gap-3 text-center"><div className="rounded-xl bg-slate-100 p-4"><p className="text-2xl font-black">{data.attempts.length}</p><p className="text-xs">Attempts</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-2xl font-black text-emerald-800">{gradedCount}</p><p className="text-xs">Fully graded</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-2xl font-black text-amber-800">{pendingWritten}</p><p className="text-xs">Written pending</p></div></div><p className="mt-5 text-sm text-slate-600">Publishing makes scores and reports visible to candidates. Correct answers remain hidden unless enabled in exam settings.</p><div className="mt-6 flex justify-end gap-3"><button className="btn-secondary" onClick={() => setPreviewOpen(false)} type="button">Cancel</button><button className="btn-primary" disabled={pendingWritten > 0 || busyKey === "publish" || data.exam.resultsPublishedAt !== null} onClick={() => void publish()} type="button"><Send size={16} /> {data.exam.resultsPublishedAt ? "Already published" : busyKey === "publish" ? "Publishing…" : "Publish results"}</button></div></section></div> : null}
    </div>
  );
}
