import { ExamStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { toExamDto } from "@/lib/exam-dto";
import {
  assertExamMutationAccess,
  AssignQuestionsSchema,
  reconcileExamStatuses,
} from "@/lib/exam-lifecycle";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const PUT = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;
  await reconcileExamStatuses(id);

  const exam = await db.exam.findUnique({ where: { id } });
  if (!exam) throw new NotFoundError("Examination not found");
  assertExamMutationAccess(actor, exam.createdById);

  if (exam.status !== ExamStatus.DRAFT) {
    throw new ConflictError(
      "Questions can only be modified while the examination is in DRAFT status",
      "EXAM_LOCKED",
    );
  }

  const input = AssignQuestionsSchema.parse(await request.json());
  const uniqueIds = Array.from(new Set(input.items.map((item) => item.questionId)));
  if (uniqueIds.length !== input.items.length) {
    throw new BadRequestError("Duplicate questions cannot be assigned to the same examination");
  }

  if (uniqueIds.length > 0) {
    const ownedQuestions = await db.question.findMany({
      where: { id: { in: uniqueIds }, createdById: actor.userId },
      select: { id: true },
    });
    if (ownedQuestions.length !== uniqueIds.length) {
      throw new BadRequestError("One or more selected questions were not found in your bank");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.examQuestion.deleteMany({ where: { examId: id } });
    if (input.items.length > 0) {
      await tx.examQuestion.createMany({
        data: input.items.map((item, idx) => ({
          examId: id,
          questionId: item.questionId,
          orderIndex: item.orderIndex ?? idx,
          marks: item.marks,
        })),
      });
    }
  });

  await writeAudit({
    actorId: actor.userId,
    action: "EXAM_QUESTIONS_ASSIGNED",
    entityType: "Exam",
    entityId: id,
    details: { count: input.items.length },
  });

  const updated = await db.exam.findUnique({
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

  return NextResponse.json({ exam: toExamDto(updated!) });
});
