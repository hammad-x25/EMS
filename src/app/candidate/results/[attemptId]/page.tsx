import { Role } from "@prisma/client";
import { CheckCircle2, Download, LockKeyhole, XCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DisputePanel } from "@/components/results/DisputePanel";
import { getSession } from "@/lib/auth";
import { listDisputes } from "@/lib/disputes";
import { getResultDetail } from "@/lib/results";

export const dynamic = "force-dynamic";

export default async function CandidateResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.CANDIDATE) redirect("/");
  const { attemptId } = await params;
  const [result, initialDisputes] = await Promise.all([
    getResultDetail(session, attemptId),
    listDisputes(session, { attemptId }),
  ]);
  return (
    <div className="space-y-6">
      <header><p className="eyebrow">Published result</p><h1 className="mt-1 text-3xl font-black">{result.examTitle}</h1><p className="muted mt-1">Published {new Date(result.publishedAt).toLocaleString()}</p></header>
      <section className={`card flex flex-wrap items-center justify-between gap-5 border-2 p-7 ${result.passed ? "border-emerald-300 bg-emerald-50/40" : "border-rose-300 bg-rose-50/40"}`}><div className="flex items-center gap-4">{result.passed ? <CheckCircle2 className="text-emerald-600" size={48} /> : <XCircle className="text-rose-600" size={48} />}<div><p className="text-sm font-bold">{result.passed ? "Passed" : "Not passed"}</p><p className="text-4xl font-black">{result.totalScore} / {result.maxScore}</p><p className="text-xs text-slate-500">Passing marks: {result.passingMarks}</p></div></div><Link className="btn-primary" href={`/api/reports/attempt/${attemptId}/pdf`}><Download size={16} /> Download QR-verified PDF</Link></section>
      {!result.revealAnswers ? <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><LockKeyhole size={18} /> Correct answers and explanations are hidden by the examiner&apos;s publication setting.</div> : null}
      <section className="space-y-4">{result.questions.map((question) => <article className="card p-5" key={question.snapshotId}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Question {question.displayOrder} · {question.topic}</p><h2 className="mt-1 font-black">{question.prompt}</h2></div><span className="status-pill bg-indigo-50 text-indigo-700">{question.earnedScore} / {question.maxMarks}</span></div>{question.writtenText ? <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm whitespace-pre-wrap">{question.writtenText}</div> : question.selectedIds?.length ? <p className="mt-4 text-sm">Your selection: <strong>{question.selectedIds.join(", ").toUpperCase()}</strong></p> : <p className="mt-4 text-sm text-slate-500">No response submitted.</p>}{question.graderFeedback ? <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm"><strong>Examiner feedback:</strong> {question.graderFeedback}</div> : null}{result.revealAnswers && question.correctIds ? <div className="mt-3 text-sm text-emerald-800"><strong>Correct answer:</strong> {question.correctIds.join(", ").toUpperCase()}{question.explanation ? <p className="mt-1">{question.explanation}</p> : null}</div> : null}</article>)}</section>
      <DisputePanel
        attemptId={attemptId}
        initialDisputes={initialDisputes}
        questions={result.questions.map((q) => ({
          snapshotId: q.snapshotId,
          displayOrder: q.displayOrder,
          topic: q.topic,
          maxMarks: q.maxMarks,
        }))}
      />
    </div>
  );
}
