import { BadgeCheck, BadgeX, ShieldQuestion } from "lucide-react";
import { VerifyLookupForm } from "@/components/VerifyLookupForm";
import { verifyPublicReport } from "@/lib/verification";

export const dynamic = "force-dynamic";

export default async function VerifyReportPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalizedCode = code.toUpperCase();
  const verification = await verifyPublicReport(normalizedCode);
  const valid = verification.status === "VALID";

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--bg-canvas)] p-5">
      <section className="card w-full max-w-xl p-7 text-center md:p-8">
        {valid ? (
          <BadgeCheck aria-hidden="true" className="mx-auto text-[var(--status-success-text)]" size={56} />
        ) : verification.status === "NOT_FOUND" ? (
          <ShieldQuestion aria-hidden="true" className="mx-auto text-[var(--text-muted)]" size={56} />
        ) : (
          <BadgeX aria-hidden="true" className="mx-auto text-[var(--status-danger-text)]" size={56} />
        )}

        <p className="eyebrow mt-4">AegisExam report verification</p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-3xl">
          {verification.status.replaceAll("_", " ")}
        </h1>

        {verification.report ? (
          <dl className="mt-6 grid grid-cols-1 gap-3 text-left text-sm sm:grid-cols-2">
            {[
              ["Verification ID", verification.report.code],
              ["Candidate", verification.report.candidateName],
              ["Candidate ID", verification.report.candidateIdentifier],
              ["Examination", verification.report.examTitle],
              ["Score", `${verification.report.score} / ${verification.report.maxScore}`],
              ["Issued", new Date(verification.report.issuedAt).toLocaleString()],
              ["Version", verification.report.version],
            ].map(([label, value]) => (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3" key={label}>
                <dt className="text-xs font-medium text-[var(--text-muted)]">{label}</dt>
                <dd className="font-mono-tabular mt-1 font-bold text-[var(--text-primary)]">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">
            No report exists for verification ID <strong className="font-mono-tabular">{normalizedCode}</strong>.
          </p>
        )}

        <VerifyLookupForm initialCode={normalizedCode} />

        <p className="mt-5 text-xs leading-5 text-[var(--text-muted)]">
          For privacy, this public check never exposes email, question text, candidate answers, feedback, or monitoring history.
        </p>
      </section>
    </main>
  );
}
