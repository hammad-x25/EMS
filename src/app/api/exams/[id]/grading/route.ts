import { AttemptStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { assertExamReadAccess } from "@/lib/exam-lifecycle";
import { ManualGradeSchema, recomputeAttemptTotals, saveManualGrade } from "@/lib/grading";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

async function gradingPayload(id: string) {
  const exam = await db.exam.findUnique({
    where: { id },
    include: {
      attempts: {
        where: { isSandbox: false },
        orderBy: { startedAt: "asc" },
        include: {
          user: { select: { id: true, name: true, studentId: true } },
          snapshots: { orderBy: { displayOrder: "asc" }, include: { answer: true } },
        },
      },
    },
  });
  if (!exam) throw new NotFoundError("Examination not found");
  return {
    exam: { id: exam.id, title: exam.title, totalMarks: exam.totalMarks, resultsPublishedAt: exam.resultsPublishedAt?.toISOString() ?? null },
    attempts: exam.attempts.map((attempt) => ({
      id: attempt.id,
      candidate: attempt.user,
      status: attempt.status,
      totalScore: attempt.totalScore,
      maxScore: attempt.maxScore,
      responses: attempt.snapshots.map((snapshot) => ({
        snapshotId: snapshot.id,
        displayOrder: snapshot.displayOrder,
        type: snapshot.type,
        topic: snapshot.topic,
        prompt: snapshot.promptSnapshot,
        maxMarks: snapshot.maxMarks,
        writtenText: snapshot.answer?.writtenText ?? null,
        autoScore: snapshot.answer?.autoScore ?? 0,
        manualScore: snapshot.answer?.manualScore ?? null,
        graderFeedback: snapshot.answer?.graderFeedback ?? null,
      })),
    })),
  };
}

export const GET = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  const { id } = await context.params;
  const exam = await db.exam.findUnique({ where: { id }, select: { createdById: true } });
  if (!exam) throw new NotFoundError("Examination not found");
  assertExamReadAccess(actor, exam.createdById);
  const attempts = await db.attempt.findMany({
    where: { examId: id, isSandbox: false, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED, AttemptStatus.GRADED] } },
    select: { id: true },
  });
  await Promise.all(attempts.map((attempt) => recomputeAttemptTotals(attempt.id)));
  return NextResponse.json(await gradingPayload(id));
});

export const PATCH = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;
  const input = ManualGradeSchema.parse(await request.json());
  const attempt = await db.attempt.findUnique({ where: { id: input.attemptId }, select: { examId: true } });
  if (!attempt || attempt.examId !== id) throw new NotFoundError("Attempt not found for this examination");
  const summary = await saveManualGrade(actor, input);
  return NextResponse.json({ summary, ...(await gradingPayload(id)) });
});
