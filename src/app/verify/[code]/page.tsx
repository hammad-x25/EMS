import { BadgeCheck, BadgeX, ShieldQuestion } from "lucide-react";
import { verifyPublicReport } from "@/lib/verification";

export const dynamic = "force-dynamic";

export default async function VerifyReportPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const verification = await verifyPublicReport(code.toUpperCase());
  const valid = verification.status === "VALID";
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-5"><section className="card w-full max-w-xl p-8 text-center">{valid ? <BadgeCheck className="mx-auto text-emerald-600" size={64} /> : verification.status === "NOT_FOUND" ? <ShieldQuestion className="mx-auto text-slate-500" size={64} /> : <BadgeX className="mx-auto text-rose-600" size={64} />}<p className="eyebrow mt-5">AegisExam report verification</p><h1 className="mt-2 text-3xl font-black">{verification.status.replaceAll("_", " ")}</h1>{verification.report ? <dl className="mt-7 grid grid-cols-2 gap-3 text-left text-sm">{[
        ["Verification ID", verification.report.code], ["Candidate", verification.report.candidateName], ["Candidate ID", verification.report.candidateIdentifier], ["Examination", verification.report.examTitle], ["Score", `${verification.report.score} / ${verification.report.maxScore}`], ["Issued", new Date(verification.report.issuedAt).toLocaleString()], ["Version", verification.report.version],
      ].map(([label, value]) => <div className="rounded-xl bg-slate-50 p-3" key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}</dl> : <p className="mt-5 text-sm text-slate-600">No report exists for this verification ID.</p>}<p className="mt-7 border-t border-slate-200 pt-5 text-xs text-slate-500">For privacy, this public check never exposes email, question text, candidate answers, feedback, or monitoring history.</p></section></main>
  );
}
