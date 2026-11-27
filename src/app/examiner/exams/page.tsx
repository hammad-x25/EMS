import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { ExamListManager } from "@/components/examiner/ExamListManager";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { toExamDto } from "@/lib/exam-dto";
import { reconcileExamStatuses } from "@/lib/exam-lifecycle";

export const dynamic = "force-dynamic";

export default async function ExaminerExamsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.EXAMINER) redirect("/");

  await reconcileExamStatuses();

  const exams = await db.exam.findMany({
    where: { createdById: session.userId },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      examQuestions: { include: { question: true } },
      blueprintRules: true,
      _count: {
        select: {
          examQuestions: true,
          blueprintRules: true,
          enrollments: true,
          attempts: { where: { isSandbox: false } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Examination management</p>
        <h1 className="mt-2 text-3xl font-black">Examinations</h1>
        <p className="muted mt-1">
          Configure schedules, fairness blueprints, candidate enrollments, and lifecycle states.
        </p>
      </header>
      <ExamListManager initialExams={exams.map(toExamDto)} />
    </div>
  );
}
