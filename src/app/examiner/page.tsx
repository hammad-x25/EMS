import { ArrowRight, BookOpenCheck, ClipboardList, MessageSquareWarning, Users } from "lucide-react";
import Link from "next/link";
import { DisputeStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reconcileExamStatuses } from "@/lib/exam-lifecycle";

export const dynamic = "force-dynamic";

export default async function ExaminerHomePage() {
  const session = await getSession();
  await reconcileExamStatuses();

  const [questions, exams, enrollments, openDisputes] = await Promise.all([
    db.question.count({ where: { createdById: session?.userId ?? "" } }),
    db.exam.count({ where: { createdById: session?.userId ?? "" } }),
    db.enrollment.count({ where: { exam: { createdById: session?.userId ?? "" } } }),
    db.dispute.count({
      where: {
        exam: { createdById: session?.userId ?? "" },
        attempt: { isSandbox: false },
        status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Examiner workspace</p>
        <h1 className="mt-2 text-3xl font-black">Welcome, {session?.name}</h1>
        <p className="muted mt-2">
          Your account is active and restricted to examiner-authorized records.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="card flex flex-col justify-between p-6">
          <div>
            <BookOpenCheck className="text-indigo-600" />
            <p className="mt-4 text-3xl font-black">{questions}</p>
            <p className="muted mt-1">Reusable questions owned by you</p>
          </div>
          <Link className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600" href="/examiner/questions">
            Manage question bank <ArrowRight size={15} />
          </Link>
        </article>
        <article className="card flex flex-col justify-between p-6">
          <div>
            <ClipboardList className="text-indigo-600" />
            <p className="mt-4 text-3xl font-black">{exams}</p>
            <p className="muted mt-1">Examinations owned by you</p>
          </div>
          <Link className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600" href="/examiner/exams">
            Manage examinations <ArrowRight size={15} />
          </Link>
        </article>
        <article className="card flex flex-col justify-between p-6">
          <div>
            <Users className="text-indigo-600" />
            <p className="mt-4 text-3xl font-black">{enrollments}</p>
            <p className="muted mt-1">Candidate enrollments across exams</p>
          </div>
          <Link className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600" href="/examiner/exams">
            Configure enrollments <ArrowRight size={15} />
          </Link>
        </article>
        <article className="card flex flex-col justify-between p-6">
          <div>
            <MessageSquareWarning className="text-amber-600" />
            <p className="mt-4 text-3xl font-black">{openDisputes}</p>
            <p className="muted mt-1">Active result disputes awaiting review</p>
          </div>
          <Link className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600" href="/examiner/disputes">
            Review dispute queue <ArrowRight size={15} />
          </Link>
        </article>
      </section>
    </div>
  );
}
