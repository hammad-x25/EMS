import { AttemptStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { publishExamEvent } from "@/lib/event-bus";
import { recomputeAttemptTotals } from "@/lib/grading";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;
  const exam = await db.exam.findUnique({ where: { id } });
  if (!exam) throw new NotFoundError("Examination not found");
  if (exam.createdById !== actor.userId) throw new ForbiddenError("Only the owning examiner can publish results");
  const attempts = await db.attempt.findMany({ where: { examId: id, isSandbox: false }, select: { id: true, status: true } });
  if (attempts.length === 0) throw new ConflictError("No real attempts are available to publish", "NO_ATTEMPTS");
  if (attempts.some((attempt) => attempt.status === AttemptStatus.IN_PROGRESS)) {
    throw new ConflictError("All candidates must finalize before result publication", "ATTEMPTS_IN_PROGRESS");
  }
  await Promise.all(attempts.filter((attempt) => attempt.status !== AttemptStatus.PUBLISHED).map((attempt) => recomputeAttemptTotals(attempt.id)));
  const ungraded = await db.attempt.count({
    where: { examId: id, isSandbox: false, status: { notIn: [AttemptStatus.GRADED, AttemptStatus.PUBLISHED] } },
  });
  if (ungraded > 0) throw new ConflictError("Every written response must be graded before publication", "GRADING_INCOMPLETE");
  const publishedAt = new Date();
  await db.$transaction([
    db.attempt.updateMany({ where: { examId: id, isSandbox: false, status: AttemptStatus.GRADED }, data: { status: AttemptStatus.PUBLISHED } }),
    db.exam.update({ where: { id }, data: { resultsPublishedAt: publishedAt } }),
    db.auditLog.create({ data: { actorId: actor.userId, action: "EXAM_RESULTS_PUBLISHED", entityType: "Exam", entityId: id, detailsJson: { attemptCount: attempts.length } } }),
  ]);
  publishExamEvent({ type: "EXAM_ENDED", examId: id, payload: { resultsPublishedAt: publishedAt.toISOString() } });
  return NextResponse.json({ resultsPublishedAt: publishedAt.toISOString(), publishedAttempts: attempts.length });
});
