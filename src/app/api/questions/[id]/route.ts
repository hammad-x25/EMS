import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import {
  assertQuestionAccess,
  CreateQuestionSchema,
  parseCorrectIdsJson,
  parseOptionsJson,
  toQuestionDto,
  toQuestionPersistenceData,
  UpdateQuestionSchema,
} from "@/lib/question-bank";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  const { id } = await context.params;
  const question = await db.question.findUnique({
    where: { id },
    include: { _count: { select: { examQuestions: true } } },
  });
  if (!question) throw new NotFoundError("Question not found");
  assertQuestionAccess(actor, question.createdById);
  return NextResponse.json({ question: toQuestionDto(question) });
});

export const PATCH = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  const { id } = await context.params;

  const existing = await db.question.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Question not found");
  assertQuestionAccess(actor, existing.createdById);

  const patch = UpdateQuestionSchema.parse(await request.json());

  // Re-validate merged payload so partial edits cannot break type/options/correctIds invariants.
  const merged = CreateQuestionSchema.parse({
    topic: patch.topic ?? existing.topic,
    difficulty: patch.difficulty ?? existing.difficulty,
    type: patch.type ?? existing.type,
    prompt: patch.prompt ?? existing.prompt,
    options: patch.options !== undefined ? patch.options : parseOptionsJson(existing.optionsJson),
    correctIds:
      patch.correctIds !== undefined ? patch.correctIds : parseCorrectIdsJson(existing.correctIdsJson),
    maxMarks: patch.maxMarks ?? existing.maxMarks,
    explanation: patch.explanation !== undefined ? patch.explanation : existing.explanation,
  });

  // Note: updating Question intentionally leaves AttemptQuestionSnapshot untouched.
  const updated = await db.question.update({
    where: { id },
    data: toQuestionPersistenceData(merged),
    include: { _count: { select: { examQuestions: true } } },
  });

  await writeAudit({
    actorId: actor.userId,
    action: "QUESTION_UPDATED",
    entityType: "Question",
    entityId: updated.id,
    details: { topic: updated.topic, difficulty: updated.difficulty, type: updated.type },
  });

  return NextResponse.json({ question: toQuestionDto(updated) });
});

export const DELETE = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  const { id } = await context.params;

  const existing = await db.question.findUnique({
    where: { id },
    include: { _count: { select: { examQuestions: true } } },
  });
  if (!existing) throw new NotFoundError("Question not found");
  assertQuestionAccess(actor, existing.createdById);

  if (existing._count.examQuestions > 0) {
    throw new ConflictError(
      "This question is assigned to one or more examinations and cannot be deleted",
      "QUESTION_IN_USE",
    );
  }

  await db.question.delete({ where: { id } });
  await writeAudit({
    actorId: actor.userId,
    action: "QUESTION_DELETED",
    entityType: "Question",
    entityId: id,
    details: { topic: existing.topic, type: existing.type },
  });

  return NextResponse.json({ deleted: true });
});
