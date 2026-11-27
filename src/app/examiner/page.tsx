import { ArrowRight, BookOpenCheck, ClipboardList, MessageSquareWarning, Users } from "lucide-react";
import Link from "next/link";
import { DisputeStatus } from "@prisma/client";
import { StatCard } from "@/components/StatCard";
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
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Examiner workspace</p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-3xl">
            Welcome, {session?.name}
          </h1>
          <p className="muted mt-1 text-sm">
            Author questions, run fairness simulations, monitor live rooms, grade written answers, and resolve disputes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href="/examiner/questions">
            <BookOpenCheck size={16} /> Question bank
          </Link>
          <Link className="btn-primary" href="/examiner/exams">
            <ClipboardList size={16} /> Examinations
          </Link>
        </div>
      </header>

      <section aria-label="Examiner workload metrics" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <StatCard detail="Owned in your bank" icon={BookOpenCheck} label="Questions" value={questions} />
          <Link className="inline-flex items-center gap-1 px-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline" href="/examiner/questions">
            Manage question bank <ArrowRight size={13} />
          </Link>
        </div>
        <div className="space-y-2">
          <StatCard detail="Drafts, live & completed" icon={ClipboardList} label="Examinations" value={exams} />
          <Link className="inline-flex items-center gap-1 px-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline" href="/examiner/exams">
            Manage examinations <ArrowRight size={13} />
          </Link>
        </div>
        <div className="space-y-2">
          <StatCard detail="Assigned across your exams" icon={Users} label="Enrollments" value={enrollments} />
        </div>
        <div className="space-y-2">
          <StatCard detail="Open or under review" icon={MessageSquareWarning} label="Active disputes" value={openDisputes} />
          <Link className="inline-flex items-center gap-1 px-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline" href="/examiner/disputes">
            Review disputes <ArrowRight size={13} />
          </Link>
        </div>
      </section>
    </div>
  );
}
