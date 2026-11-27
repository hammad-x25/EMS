import { ExamStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { toExamDto } from "@/lib/exam-dto";
import {
  assertExamMutationAccess,
  assertExamReadAccess,
  ExamBaseSchema,
  reconcileExamStatuses,
  UpdateExamSchema,
} from "@/lib/exam-lifecycle";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

async function loadExamForResponse(id: string) {
  return db.exam.findUnique({
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
  });
}

export const GET = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  const { id } = await context.params;
  await reconcileExamStatuses(id);

  const exam = await loadExamForResponse(id);
  if (!exam) throw new NotFoundError("Examination not found");
  assertExamReadAccess(actor, exam.createdById);

  return NextResponse.json({ exam: toExamDto(exam) });
});

export const PATCH = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;
  await reconcileExamStatuses(id);

  const existing = await db.exam.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Examination not found");
  assertExamMutationAccess(actor, existing.createdById);

  if (existing.status !== ExamStatus.DRAFT) {
    throw new ConflictError(
      "Only examinations in DRAFT status can modify configuration",
      "EXAM_LOCKED",
    );
  }

  const patch = UpdateExamSchema.parse(await request.json());
  const validated = ExamBaseSchema.parse({
    title: patch.title ?? existing.title,
    instructions: patch.instructions ?? existing.instructions,
    scheduledStart: patch.scheduledStart ?? existing.scheduledStart,
    scheduledEnd: patch.scheduledEnd ?? existing.scheduledEnd,
    durationMinutes: patch.durationMinutes ?? existing.durationMinutes,
    totalMarks: patch.totalMarks ?? existing.totalMarks,
    passingMarks: patch.passingMarks ?? existing.passingMarks,
    shuffleQuestions: patch.shuffleQuestions ?? existing.shuffleQuestions,
    shuffleOptions: patch.shuffleOptions ?? existing.shuffleOptions,
    useStratifiedBlueprint: patch.useStratifiedBlueprint ?? existing.useStratifiedBlueprint,
    multiSelectRule: patch.multiSelectRule ?? existing.multiSelectRule,
    negativeMarkRatio: patch.negativeMarkRatio ?? existing.negativeMarkRatio,
    revealAnswersAfterPublish:
      patch.revealAnswersAfterPublish ?? existing.revealAnswersAfterPublish,
  });

  await db.exam.update({
    where: { id },
    data: validated,
  });

  await writeAudit({
    actorId: actor.userId,
    action: "EXAM_UPDATED",
    entityType: "Exam",
    entityId: id,
    details: { title: validated.title, useStratifiedBlueprint: validated.useStratifiedBlueprint },
  });

  const updated = await loadExamForResponse(id);
  return NextResponse.json({ exam: toExamDto(updated!) });
});

export const DELETE = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;
  await reconcileExamStatuses(id);

  const existing = await db.exam.findUnique({
    where: { id },
    include: { _count: { select: { attempts: { where: { isSandbox: false } } } } },
  });
  if (!existing) throw new NotFoundError("Examination not found");
  assertExamMutationAccess(actor, existing.createdById);

  if (existing.status !== ExamStatus.DRAFT || existing._count.attempts > 0) {
    throw new ConflictError(
      "Only draft examinations without candidate attempts can be deleted",
      "EXAM_CANNOT_DELETE",
    );
  }

  await db.exam.delete({ where: { id } });
  await writeAudit({
    actorId: actor.userId,
    action: "EXAM_DELETED",
    entityType: "Exam",
    entityId: id,
    details: { title: existing.title },
  });

  return NextResponse.json({ deleted: true });
});
