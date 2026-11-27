import { Role } from "@prisma/client";
import { AlertTriangle, BarChart3, Download, Target } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
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
      <Breadcrumb
        items={[
          { label: "Examinations", href: "/examiner/exams" },
          { label: analytics.title, href: `/examiner/exams/${id}` },
          { label: "Analytics" },
        ]}
      />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Results &amp; question analytics</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-3xl">
            {analytics.title}
          </h1>
          <p className="muted mt-1 text-sm">
            Observed difficulty, skips, distractors, and cohort outcomes from real attempts only.
          </p>
        </div>
        <Link className="btn-primary" href={`/api/reports/exam/${id}/pdf`}>
          <Download size={16} /> Download cohort PDF
        </Link>
      </header>

      <section aria-label="Cohort metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Submissions", analytics.submissionCount],
          ["Mean", analytics.mean],
          ["Median", analytics.median],
          ["Range", `${analytics.minimum}–${analytics.maximum}`],
          ["Pass rate", `${analytics.passRate}%`],
        ].map(([label, value]) => (
          <div className="card p-4" key={label}>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
            <p className="font-mono-tabular mt-2 text-2xl font-extrabold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </section>

      <section className="card p-6">
        <div className="flex items-center gap-2">
          <BarChart3 aria-hidden="true" className="text-[var(--accent-primary)]" size={20} />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Score distribution</h2>
        </div>
        <div aria-label="Score distribution chart" className="mt-6 grid h-52 grid-cols-5 items-end gap-3" role="img">
          {analytics.histogram.map((bucket) => (
            <div className="flex h-full flex-col justify-end text-center" key={bucket.label}>
              <span className="font-mono-tabular mb-1 text-xs font-bold">{bucket.count}</span>
              <div
                aria-label={`${bucket.label}: ${bucket.count} submissions`}
                className="mx-auto w-full max-w-20 rounded-t-md bg-[var(--accent-primary)]"
                style={{ height: `${Math.max(4, (bucket.count / histogramMax) * 145)}px` }}
              />
              <span className="font-mono-tabular mt-2 text-xs text-[var(--text-secondary)]">{bucket.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Target aria-hidden="true" className="text-[var(--accent-primary)]" size={20} />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Question analytics</h2>
        </div>

        {analytics.questions.map((question, index) => (
          <article className="card p-5" key={question.questionId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <p className="eyebrow">
                  Question {index + 1} · {question.type.replaceAll("_", " ")}
                </p>
                <h3 className="mt-1 font-bold text-[var(--text-primary)]">{question.prompt}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {question.flags.map((flag) => (
                  <span
                    className="status-pill border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                    key={flag}
                  >
                    <AlertTriangle aria-hidden="true" size={13} /> {flag.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
                <p className="text-xs text-[var(--text-secondary)]">Observed difficulty (p)</p>
                <p className="font-mono-tabular text-xl font-extrabold">{question.observedDifficultyIndex}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
                <p className="text-xs text-[var(--text-secondary)]">Full correctness</p>
                <p className="font-mono-tabular text-xl font-extrabold">{question.correctnessRate}%</p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
                <p className="text-xs text-[var(--text-secondary)]">Skipped</p>
                <p className="font-mono-tabular text-xl font-extrabold">{question.skipRate}%</p>
              </div>
            </div>

            {question.distractorSelections.length ? (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                  Option selection frequency
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {question.distractorSelections.map((option) => (
                    <span
                      className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs"
                      key={option.optionId}
                    >
                      <strong className="font-mono-tabular">{option.optionId.toUpperCase()}</strong> · {option.text}:{" "}
                      <strong className="font-mono-tabular">{option.count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
