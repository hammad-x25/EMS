import { Role } from "@prisma/client";
import { AlertTriangle, BarChart3, Download, Target } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getExamAnalytics } from "@/lib/analytics";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.EXAMINER) redirect("/");
  const { id } = await params;
  const exam = await db.exam.findUnique({ where: { id }, select: { createdById: true } });
  if (!exam || exam.createdById !== session.userId) notFound();
  const analytics = await getExamAnalytics(id);
  const histogramMax = Math.max(1, ...analytics.histogram.map((bucket) => bucket.count));
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Results &amp; question analytics</p><h1 className="mt-1 text-3xl font-black">{analytics.title}</h1><p className="muted mt-1">Observed difficulty, skips, distractors, and cohort outcomes from real attempts only.</p></div><Link className="btn-primary" href={`/api/reports/exam/${id}/pdf`}><Download size={16} /> Download cohort PDF</Link></header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[
        ["Submissions", analytics.submissionCount], ["Mean", analytics.mean], ["Median", analytics.median], ["Range", `${analytics.minimum}–${analytics.maximum}`], ["Pass rate", `${analytics.passRate}%`],
      ].map(([label, value]) => <div className="card p-4" key={label}><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</section>
      <section className="card p-6"><div className="flex items-center gap-2"><BarChart3 className="text-indigo-600" /><h2 className="text-lg font-black">Score distribution</h2></div><div className="mt-6 grid h-52 grid-cols-5 items-end gap-3">{analytics.histogram.map((bucket) => <div className="flex h-full flex-col justify-end text-center" key={bucket.label}><span className="mb-1 text-xs font-black">{bucket.count}</span><div className="mx-auto w-full max-w-20 rounded-t-lg bg-indigo-500" style={{ height: `${Math.max(4, (bucket.count / histogramMax) * 150)}px` }} /><span className="mt-2 text-[11px] text-slate-500">{bucket.label}</span></div>)}</div></section>
      <section className="space-y-4"><div className="flex items-center gap-2"><Target className="text-indigo-600" /><h2 className="text-xl font-black">Question analytics</h2></div>{analytics.questions.map((question, index) => <article className="card p-5" key={question.questionId}><div className="flex flex-wrap items-start justify-between gap-3"><div className="max-w-3xl"><p className="eyebrow">Question {index + 1} · {question.type}</p><h3 className="mt-1 font-black">{question.prompt}</h3></div><div className="flex gap-2">{question.flags.map((flag) => <span className="status-pill bg-amber-50 text-amber-800" key={flag}><AlertTriangle size={13} /> {flag.replaceAll("_", " ")}</span>)}</div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Observed difficulty (p)</p><p className="text-xl font-black">{question.observedDifficultyIndex}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Full correctness</p><p className="text-xl font-black">{question.correctnessRate}%</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Skipped</p><p className="text-xl font-black">{question.skipRate}%</p></div></div>{question.distractorSelections.length ? <div className="mt-4"><p className="text-xs font-black uppercase text-slate-500">Option selection frequency</p><div className="mt-2 flex flex-wrap gap-2">{question.distractorSelections.map((option) => <span className="rounded-lg border border-slate-200 px-3 py-2 text-xs" key={option.optionId}><strong>{option.optionId.toUpperCase()}</strong> · {option.text}: <strong>{option.count}</strong></span>)}</div></div> : null}</article>)}</section>
    </div>
  );
}
