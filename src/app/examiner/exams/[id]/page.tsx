import { Role } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { ExamBuilderWorkspace } from "@/components/examiner/ExamBuilderWorkspace";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { toExamDto } from "@/lib/exam-dto";
import { reconcileExamStatuses } from "@/lib/exam-lifecycle";
import { toQuestionDto } from "@/lib/question-bank";
import { toUserDto } from "@/lib/user-dto";

export const dynamic = "force-dynamic";

export default async function ExaminerExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.EXAMINER) redirect("/");

  const { id } = await params;
  await reconcileExamStatuses(id);

  const [exam, bankQuestions, enrollments, candidates] = await Promise.all([
    db.exam.findUnique({
      where: { id },
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
    }),
    db.question.findMany({
      where: { createdById: session.userId },
      orderBy: [{ topic: "asc" }, { difficulty: "asc" }],
      include: { _count: { select: { examQuestions: true } } },
    }),
    db.enrollment.findMany({
      where: { examId: id },
      orderBy: { enrolledAt: "desc" },
      include: { user: true },
    }),
    db.user.findMany({
      where: { role: Role.CANDIDATE, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!exam || exam.createdById !== session.userId) {
    notFound();
  }

  const enrolledIds = new Set(enrollments.map((item) => item.userId));

  return (
    <ExamBuilderWorkspace
      bankQuestions={bankQuestions.map(toQuestionDto)}
      initialAvailableCandidates={candidates
        .filter((candidate) => !enrolledIds.has(candidate.id))
        .map(toUserDto)}
      initialEnrollments={enrollments.map((item) => ({
        id: item.id,
        enrolledAt: item.enrolledAt.toISOString(),
        candidate: toUserDto(item.user),
      }))}
      initialExam={toExamDto(exam)}
    />
  );
}
