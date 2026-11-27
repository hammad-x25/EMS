import { AttemptStatus, Prisma, Role } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

function stringArray(value: Prisma.JsonValue | null): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

export async function getResultDetail(actor: SessionUser, attemptId: string) {
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      user: { select: { id: true, name: true, studentId: true } },
      exam: true,
      snapshots: { orderBy: { displayOrder: "asc" }, include: { answer: true } },
    },
  });
  if (!attempt || attempt.isSandbox) throw new NotFoundError("Result not found");
  const allowed =
    actor.role === Role.ADMIN ||
    (actor.role === Role.CANDIDATE && attempt.userId === actor.userId) ||
    (actor.role === Role.EXAMINER && attempt.exam.createdById === actor.userId);
  if (!allowed) throw new ForbiddenError("You do not have access to this result");
  if (attempt.status !== AttemptStatus.PUBLISHED || !attempt.exam.resultsPublishedAt) {
    throw new ConflictError("This result has not been published", "RESULT_NOT_PUBLISHED");
  }
  const reveal = attempt.exam.revealAnswersAfterPublish;
  const explanations = reveal
    ? new Map((await db.question.findMany({
        where: { id: { in: attempt.snapshots.map((snapshot) => snapshot.questionId) } },
        select: { id: true, explanation: true },
      })).map((question) => [question.id, question.explanation]))
    : new Map<string, string | null>();
  return {
    attemptId: attempt.id,
    examId: attempt.examId,
    examTitle: attempt.exam.title,
    candidate: attempt.user,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    publishedAt: attempt.exam.resultsPublishedAt.toISOString(),
    totalScore: attempt.totalScore ?? 0,
    maxScore: attempt.maxScore,
    passingMarks: attempt.exam.passingMarks,
    passed: (attempt.totalScore ?? 0) >= attempt.exam.passingMarks,
    revealAnswers: reveal,
    questions: attempt.snapshots.map((snapshot) => ({
      snapshotId: snapshot.id,
      displayOrder: snapshot.displayOrder,
      topic: snapshot.topic,
      type: snapshot.type,
      prompt: snapshot.promptSnapshot,
      maxMarks: snapshot.maxMarks,
      selectedIds: stringArray(snapshot.answer?.selectedIdsJson ?? null),
      writtenText: snapshot.answer?.writtenText ?? null,
      autoScore: snapshot.answer?.autoScore ?? 0,
      manualScore: snapshot.answer?.manualScore ?? null,
      earnedScore: (snapshot.answer?.autoScore ?? 0) + (snapshot.answer?.manualScore ?? 0),
      graderFeedback: snapshot.answer?.graderFeedback ?? null,
      correctIds: reveal ? stringArray(snapshot.correctIdsSnap) : null,
      explanation: reveal ? explanations.get(snapshot.questionId) ?? null : null,
    })),
  };
}
