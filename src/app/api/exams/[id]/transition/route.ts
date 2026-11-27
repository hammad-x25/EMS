import { AttemptStatus, ExamStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { toExamDto } from "@/lib/exam-dto";
import {
  assertExamMutationAccess,
  ExamTransitionSchema,
  reconcileExamStatuses,
  validateManualTransition,
} from "@/lib/exam-lifecycle";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;
  const now = new Date();
  await reconcileExamStatuses(id, now);

  const exam = await db.exam.findUnique({
    where: { id },
    include: {
      examQuestions: true,
      blueprintRules: true,
      _count: { select: { attempts: { where: { isSandbox: false } } } },
    },
  });
  if (!exam) throw new NotFoundError("Examination not found");
  assertExamMutationAccess(actor, exam.createdById);

  const { targetStatus } = ExamTransitionSchema.parse(await request.json());

  const insufficientStrata: string[] = [];
  if (exam.useStratifiedBlueprint && exam.blueprintRules.length > 0) {
    const bankCounts = await db.question.groupBy({
      by: ["topic", "difficulty"],
      where: { createdById: exam.createdById },
      _count: { _all: true },
    });
    const countMap = new Map(
      bankCounts.map((row) => [`${row.topic}::${row.difficulty}`, row._count._all]),
    );
    for (const rule of exam.blueprintRules) {
      const available = countMap.get(`${rule.topic}::${rule.difficulty}`) ?? 0;
      if (available < rule.pickCount) {
        insufficientStrata.push(`${rule.topic} ${rule.difficulty} (need ${rule.pickCount}, have ${available})`);
      }
    }
  }

  const assignedMarksSum = exam.examQuestions.reduce((sum, item) => sum + item.marks, 0);
  const blueprintMarksSum = exam.blueprintRules.reduce(
    (sum, rule) => sum + rule.pickCount * rule.marksEach,
    0,
  );

  validateManualTransition(exam.status, targetStatus, {
    scheduledStart: exam.scheduledStart,
    scheduledEnd: exam.scheduledEnd,
    totalMarks: exam.totalMarks,
    useStratifiedBlueprint: exam.useStratifiedBlueprint,
    assignedMarksSum,
    assignedCount: exam.examQuestions.length,
    blueprintMarksSum,
    blueprintRuleCount: exam.blueprintRules.length,
    insufficientStrata,
    nonSandboxAttemptCount: exam._count.attempts,
    now,
  });

  // If examiner publishes an exam whose start time already arrived, transition straight to ONGOING
  let effectiveStatus = targetStatus;
  let adjustedStart = exam.scheduledStart;
  let adjustedEnd = exam.scheduledEnd;

  if (targetStatus === ExamStatus.PUBLISHED && now >= exam.scheduledStart && now < exam.scheduledEnd) {
    effectiveStatus = ExamStatus.ONGOING;
  } else if (targetStatus === ExamStatus.ONGOING && now < exam.scheduledStart) {
    adjustedStart = now;
  } else if (targetStatus === ExamStatus.COMPLETED && now < exam.scheduledEnd) {
    adjustedEnd = now;
  }

  await db.$transaction(async (tx) => {
    await tx.exam.update({
      where: { id },
      data: {
        status: effectiveStatus,
        scheduledStart: adjustedStart,
        scheduledEnd: adjustedEnd,
      },
    });

    if (effectiveStatus === ExamStatus.COMPLETED) {
      await tx.attempt.updateMany({
        where: { examId: id, status: AttemptStatus.IN_PROGRESS },
        data: { status: AttemptStatus.EXPIRED, submittedAt: now },
      });
    }
  });

  await writeAudit({
    actorId: actor.userId,
    action: "EXAM_STATUS_CHANGED",
    entityType: "Exam",
    entityId: id,
    details: { from: exam.status, to: effectiveStatus },
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
