import { ExamStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { toExamDto } from "@/lib/exam-dto";
import {
  assertExamMutationAccess,
  BlueprintRulesSchema,
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
      "Blueprint rules can only be modified while the examination is in DRAFT status",
      "EXAM_LOCKED",
    );
  }

  const input = BlueprintRulesSchema.parse(await request.json());
  const seenKeys = new Set<string>();
  for (const rule of input.rules) {
    const key = `${rule.topic}::${rule.difficulty}`;
    if (seenKeys.has(key)) {
      throw new BadRequestError(`Duplicate blueprint rule for ${rule.topic} (${rule.difficulty})`);
    }
    seenKeys.add(key);
  }

  await db.$transaction(async (tx) => {
    await tx.examBlueprintRule.deleteMany({ where: { examId: id } });
    if (input.rules.length > 0) {
      await tx.examBlueprintRule.createMany({
        data: input.rules.map((rule) => ({
          examId: id,
          topic: rule.topic,
          difficulty: rule.difficulty,
          pickCount: rule.pickCount,
          marksEach: rule.marksEach,
        })),
      });
    }
    await tx.exam.update({
      where: { id },
      data: { useStratifiedBlueprint: true },
    });
  });

  await writeAudit({
    actorId: actor.userId,
    action: "EXAM_BLUEPRINT_UPDATED",
    entityType: "Exam",
    entityId: id,
    details: { ruleCount: input.rules.length },
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
