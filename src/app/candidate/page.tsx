import { ArrowRight, BookOpenCheck, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ExamStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reconcileExamStatuses } from "@/lib/exam-lifecycle";

export const dynamic = "force-dynamic";

export default async function CandidateHomePage() {
  const session = await getSession();
  const now = new Date();
  await reconcileExamStatuses(undefined, now);

  const enrollments = await db.enrollment.count({
    where: { userId: session?.userId ?? "", exam: { status: { not: ExamStatus.DRAFT } } },
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Candidate portal</p>
        <h1 className="mt-2 text-3xl font-black">Welcome, {session?.name}</h1>
        <p className="muted mt-2">
          Your private workspace only exposes examinations assigned to your account.
        </p>
      </header>
      <section className="card flex flex-wrap items-center gap-5 p-6">
        <span className="rounded-2xl bg-indigo-50 p-4 text-indigo-600">
          <BookOpenCheck />
        </span>
        <div>
          <p className="text-3xl font-black">{enrollments}</p>
          <p className="muted">Assigned examinations</p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <CheckCircle2 className="text-emerald-600" aria-label="Account ready" />
          <Link className="btn-primary text-sm" href="/candidate/dashboard">
            Open my examinations <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
