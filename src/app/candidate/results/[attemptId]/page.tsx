import { Role } from "@prisma/client";
import { CheckCircle2, Download, LockKeyhole, XCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DisputePanel } from "@/components/results/DisputePanel";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
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
      <Breadcrumb
        items={[
          { label: "My Examinations", href: "/candidate/dashboard" },
          { label: result.examTitle },
        ]}
      />

      <header>
        <p className="eyebrow">Published result</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-3xl">
          {result.examTitle}
        </h1>
        <p className="font-mono-tabular muted mt-1 text-xs">
          Published {new Date(result.publishedAt).toLocaleString()}
        </p>
      </header>

      <section
        className={`card flex flex-wrap items-center justify-between gap-5 border-2 p-6 ${
          result.passed
            ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)]/40"
            : "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)]/40"
        }`}
      >
        <div className="flex items-center gap-4">
          {result.passed ? (
            <CheckCircle2 aria-hidden="true" className="text-[var(--status-success-text)]" size={42} />
          ) : (
            <XCircle aria-hidden="true" className="text-[var(--status-danger-text)]" size={42} />
          )}
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">{result.passed ? "Passed" : "Not passed"}</p>
            <p className="font-mono-tabular text-3xl font-extrabold text-[var(--text-primary)]">
              {result.totalScore} / {result.maxScore}
            </p>
            <p className="font-mono-tabular text-xs text-[var(--text-secondary)]">
              Passing marks: {result.passingMarks}
            </p>
          </div>
        </div>
        <Link className="btn-primary" href={`/api/reports/attempt/${attemptId}/pdf`}>
          <Download size={16} /> Download QR-verified PDF
        </Link>
      </section>

      {!result.revealAnswers ? (
        <AlertBanner variant="info">
          <LockKeyhole aria-hidden="true" className="mr-1.5 inline" size={15} />
          Correct answers and explanations are hidden by the examiner&apos;s publication setting.
        </AlertBanner>
      ) : null}

      <section className="space-y-4">
        {result.questions.map((question) => (
          <article className="card p-5" key={question.snapshotId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">
                  Question {question.displayOrder} · {question.topic}
                </p>
                <h2 className="mt-1 font-bold text-[var(--text-primary)]">{question.prompt}</h2>
              </div>
              <span className="status-pill font-mono-tabular border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]">
                {question.earnedScore} / {question.maxMarks}
              </span>
            </div>

            {question.writtenText ? (
              <div className="mt-4 whitespace-pre-wrap rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 text-sm">
                {question.writtenText}
              </div>
            ) : question.selectedIds?.length ? (
              <p className="mt-4 text-sm">
                Your selection:{" "}
                <strong className="font-mono-tabular">{question.selectedIds.join(", ").toUpperCase()}</strong>
              </p>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-muted)]">No response submitted.</p>
            )}

            {question.graderFeedback ? (
              <div className="mt-3 rounded-lg border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-3 text-sm text-[var(--status-info-text)]">
                <strong>Examiner feedback:</strong> {question.graderFeedback}
              </div>
            ) : null}

            {result.revealAnswers && question.correctIds ? (
              <div className="mt-3 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3 text-sm text-[var(--status-success-text)]">
                <strong>Correct answer:</strong>{" "}
                <span className="font-mono-tabular">{question.correctIds.join(", ").toUpperCase()}</span>
                {question.explanation ? <p className="mt-1">{question.explanation}</p> : null}
              </div>
            ) : null}
          </article>
        ))}
      </section>

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
