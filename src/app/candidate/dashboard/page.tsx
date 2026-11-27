import { AttemptStatus, ExamStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import type { CandidateExamCardDto } from "@/app/api/candidate/exams/route";
import { CandidateExamsBoard } from "@/components/candidate/CandidateExamsBoard";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { reconcileExamStatuses } from "@/lib/exam-lifecycle";

export const dynamic = "force-dynamic";

export default async function CandidateDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.CANDIDATE) redirect("/");

  const now = new Date();
  await reconcileExamStatuses(undefined, now);

  const enrollments = await db.enrollment.findMany({
    where: {
      userId: session.userId,
      exam: { status: { not: ExamStatus.DRAFT } },
    },
    orderBy: { exam: { scheduledStart: "asc" } },
    include: {
      exam: {
        include: {
          attempts: {
            where: { userId: session.userId, isSandbox: false },
            orderBy: { startedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  const available: CandidateExamCardDto[] = [];
  const upcoming: CandidateExamCardDto[] = [];
  const completed: CandidateExamCardDto[] = [];

  for (const enrollment of enrollments) {
    const exam = enrollment.exam;
    const latestAttempt = exam.attempts[0] ?? null;
    const resultsPublished =
      exam.resultsPublishedAt !== null && latestAttempt?.status === AttemptStatus.PUBLISHED;

    const cardBase = {
      examId: exam.id,
      title: exam.title,
      instructions: exam.instructions,
      status: exam.status,
      scheduledStart: exam.scheduledStart.toISOString(),
      scheduledEnd: exam.scheduledEnd.toISOString(),
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      enrolledAt: enrollment.enrolledAt.toISOString(),
      attempt: latestAttempt
        ? {
            id: latestAttempt.id,
            status: latestAttempt.status,
            startedAt: latestAttempt.startedAt.toISOString(),
            submittedAt: latestAttempt.submittedAt ? latestAttempt.submittedAt.toISOString() : null,
            totalScore: resultsPublished ? latestAttempt.totalScore : null,
            maxScore: latestAttempt.maxScore,
            resultsPublished,
          }
        : null,
    };

    const isFinishedAttempt =
      latestAttempt && latestAttempt.status !== AttemptStatus.IN_PROGRESS;

    if (isFinishedAttempt || exam.status === ExamStatus.COMPLETED || now >= exam.scheduledEnd) {
      completed.push({ ...cardBase, accessState: "COMPLETED" });
    } else if (now < exam.scheduledStart || exam.status === ExamStatus.PUBLISHED) {
      upcoming.push({ ...cardBase, accessState: "UPCOMING" });
    } else {
      available.push({
        ...cardBase,
        accessState: latestAttempt?.status === AttemptStatus.IN_PROGRESS ? "RESUME" : "AVAILABLE",
      });
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Candidate portal</p>
        <h1 className="mt-2 text-3xl font-black">My Examinations</h1>
        <p className="muted mt-1">
          View available, upcoming, and completed examinations assigned to your account.
        </p>
      </header>
      <CandidateExamsBoard
        initialAvailable={available}
        initialCompleted={completed}
        initialServerNow={now.toISOString()}
        initialUpcoming={upcoming}
      />
    </div>
  );
}
