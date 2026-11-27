import { AttemptStatus, ExamStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { reconcileExamStatuses } from "@/lib/exam-lifecycle";
import { requireAuth } from "@/lib/rbac";

export interface CandidateExamCardDto {
  examId: string;
  title: string;
  instructions: string;
  status: ExamStatus;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  enrolledAt: string;
  accessState: "AVAILABLE" | "RESUME" | "UPCOMING" | "COMPLETED";
  attempt: {
    id: string;
    status: AttemptStatus;
    startedAt: string;
    submittedAt: string | null;
    totalScore: number | null;
    maxScore: number;
    resultsPublished: boolean;
  } | null;
}

export const GET = apiHandler(async () => {
  const actor = await requireAuth([Role.CANDIDATE]);
  const now = new Date();
  await reconcileExamStatuses(undefined, now);

  const enrollments = await db.enrollment.findMany({
    where: {
      userId: actor.userId,
      exam: { status: { not: ExamStatus.DRAFT } },
    },
    orderBy: { exam: { scheduledStart: "asc" } },
    include: {
      exam: {
        include: {
          attempts: {
            where: { userId: actor.userId, isSandbox: false },
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
    const resultsPublished = exam.resultsPublishedAt !== null && latestAttempt?.status === AttemptStatus.PUBLISHED;

    const attemptSummary = latestAttempt
      ? {
          id: latestAttempt.id,
          status: latestAttempt.status,
          startedAt: latestAttempt.startedAt.toISOString(),
          submittedAt: latestAttempt.submittedAt ? latestAttempt.submittedAt.toISOString() : null,
          // Never reveal scores prior to controlled publication
          totalScore: resultsPublished ? latestAttempt.totalScore : null,
          maxScore: latestAttempt.maxScore,
          resultsPublished,
        }
      : null;

    const baseCard = {
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
      attempt: attemptSummary,
    };

    const isFinishedAttempt =
      latestAttempt && latestAttempt.status !== AttemptStatus.IN_PROGRESS;

    if (isFinishedAttempt || exam.status === ExamStatus.COMPLETED || now >= exam.scheduledEnd) {
      completed.push({ ...baseCard, accessState: "COMPLETED" });
    } else if (now < exam.scheduledStart || exam.status === ExamStatus.PUBLISHED) {
      upcoming.push({ ...baseCard, accessState: "UPCOMING" });
    } else {
      available.push({
        ...baseCard,
        accessState: latestAttempt?.status === AttemptStatus.IN_PROGRESS ? "RESUME" : "AVAILABLE",
      });
    }
  }

  return NextResponse.json({
    serverNow: now.toISOString(),
    available,
    upcoming,
    completed,
  });
});
