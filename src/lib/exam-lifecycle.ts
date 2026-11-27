import { Difficulty, Exam, ExamStatus, MultiSelectScoring, Role } from "@prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BadRequestError, ConflictError, ForbiddenError } from "@/lib/errors";

export const ExamBaseSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
    instructions: z.string().trim().min(5, "Instructions must be at least 5 characters").max(10000),
    scheduledStart: z.coerce.date(),
    scheduledEnd: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(1, "Duration must be at least 1 minute").max(1440),
    totalMarks: z.coerce.number().positive("Total marks must be greater than 0").max(10000),
    passingMarks: z.coerce.number().min(0, "Passing marks cannot be negative").max(10000),
    shuffleQuestions: z.boolean().default(true),
    shuffleOptions: z.boolean().default(true),
    useStratifiedBlueprint: z.boolean().default(false),
    multiSelectRule: z.nativeEnum(MultiSelectScoring).default(MultiSelectScoring.PARTIAL_NO_NEGATIVE),
    negativeMarkRatio: z.coerce.number().min(0).max(1).default(0),
    revealAnswersAfterPublish: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.scheduledEnd <= value.scheduledStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledEnd"],
        message: "Scheduled end time must be after scheduled start time",
      });
    }
    if (value.passingMarks > value.totalMarks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passingMarks"],
        message: "Passing marks cannot exceed total marks",
      });
    }
  });

export const UpdateExamSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  instructions: z.string().trim().min(5).max(10000).optional(),
  scheduledStart: z.coerce.date().optional(),
  scheduledEnd: z.coerce.date().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  totalMarks: z.coerce.number().positive().max(10000).optional(),
  passingMarks: z.coerce.number().min(0).max(10000).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  useStratifiedBlueprint: z.boolean().optional(),
  multiSelectRule: z.nativeEnum(MultiSelectScoring).optional(),
  negativeMarkRatio: z.coerce.number().min(0).max(1).optional(),
  revealAnswersAfterPublish: z.boolean().optional(),
});

export const AssignQuestionsSchema = z.object({
  items: z
    .array(
      z.object({
        questionId: z.string().trim().min(1),
        marks: z.coerce.number().positive(),
        orderIndex: z.coerce.number().int().min(0).optional(),
      }),
    )
    .max(500),
});

export const BlueprintRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        topic: z.string().trim().min(1).max(80),
        difficulty: z.nativeEnum(Difficulty),
        pickCount: z.coerce.number().int().min(1).max(200),
        marksEach: z.coerce.number().positive().max(1000),
      }),
    )
    .max(100),
});

export const ExamTransitionSchema = z.object({
  targetStatus: z.nativeEnum(ExamStatus),
});

export function assertExamReadAccess(actor: SessionUser, examCreatedById: string): void {
  if (actor.role === Role.ADMIN) return;
  if (actor.role === Role.EXAMINER && examCreatedById === actor.userId) return;
  throw new ForbiddenError("You do not have permission to view this examination");
}

export function assertExamMutationAccess(actor: SessionUser, examCreatedById: string): void {
  if (actor.role === Role.EXAMINER && examCreatedById === actor.userId) return;
  throw new ForbiddenError("Only the owning examiner can modify this examination");
}

export function computeDerivedExamStatus(
  exam: Pick<Exam, "status" | "scheduledStart" | "scheduledEnd">,
  now: Date,
): ExamStatus {
  if (exam.status === ExamStatus.DRAFT || exam.status === ExamStatus.COMPLETED) {
    return exam.status;
  }
  if (now >= exam.scheduledEnd) {
    return ExamStatus.COMPLETED;
  }
  if (exam.status === ExamStatus.PUBLISHED && now >= exam.scheduledStart) {
    return ExamStatus.ONGOING;
  }
  return exam.status;
}

export function validateManualTransition(
  currentStatus: ExamStatus,
  targetStatus: ExamStatus,
  context: {
    scheduledStart: Date;
    scheduledEnd: Date;
    totalMarks: number;
    useStratifiedBlueprint: boolean;
    assignedMarksSum: number;
    assignedCount: number;
    blueprintMarksSum: number;
    blueprintRuleCount: number;
    insufficientStrata: string[];
    nonSandboxAttemptCount: number;
    now: Date;
  },
): void {
  if (currentStatus === targetStatus) {
    throw new ConflictError(`Examination is already in ${currentStatus} state`, "INVALID_TRANSITION");
  }

  const allowedTargets: Record<ExamStatus, ExamStatus[]> = {
    DRAFT: [ExamStatus.PUBLISHED],
    PUBLISHED: [ExamStatus.DRAFT, ExamStatus.ONGOING],
    ONGOING: [ExamStatus.COMPLETED],
    COMPLETED: [],
  };

  if (!allowedTargets[currentStatus].includes(targetStatus)) {
    throw new ConflictError(
      `Cannot transition examination from ${currentStatus} to ${targetStatus}`,
      "INVALID_TRANSITION",
    );
  }

  if (targetStatus === ExamStatus.PUBLISHED) {
    if (context.scheduledEnd <= context.scheduledStart) {
      throw new BadRequestError("Scheduled end must be after scheduled start", "INVALID_SCHEDULE");
    }
    if (context.scheduledEnd <= context.now) {
      throw new BadRequestError(
        "Cannot publish an examination whose scheduled end window has already passed",
        "SCHEDULE_IN_PAST",
      );
    }

    if (context.useStratifiedBlueprint) {
      if (context.blueprintRuleCount === 0) {
        throw new BadRequestError(
          "Configure at least one stratified blueprint rule before publishing",
          "MISSING_BLUEPRINT",
        );
      }
      if (Math.abs(context.blueprintMarksSum - context.totalMarks) > 0.01) {
        throw new BadRequestError(
          `Blueprint marks (${context.blueprintMarksSum}) must equal examination total marks (${context.totalMarks})`,
          "MARKS_MISMATCH",
        );
      }
      if (context.insufficientStrata.length > 0) {
        throw new BadRequestError(
          `Insufficient questions in bank for: ${context.insufficientStrata.join(", ")}`,
          "INSUFFICIENT_QUESTION_POOL",
        );
      }
    } else {
      if (context.assignedCount === 0) {
        throw new BadRequestError(
          "Assign at least one question before publishing",
          "MISSING_QUESTIONS",
        );
      }
      if (Math.abs(context.assignedMarksSum - context.totalMarks) > 0.01) {
        throw new BadRequestError(
          `Assigned question marks (${context.assignedMarksSum}) must equal examination total marks (${context.totalMarks})`,
          "MARKS_MISMATCH",
        );
      }
    }
  }

  if (targetStatus === ExamStatus.DRAFT && context.nonSandboxAttemptCount > 0) {
    throw new ConflictError(
      "Cannot revert to DRAFT after candidates have started attempts",
      "ATTEMPTS_EXIST",
    );
  }

  if (targetStatus === ExamStatus.ONGOING && context.scheduledEnd <= context.now) {
    throw new ConflictError(
      "Cannot start an examination whose scheduled end time has already passed",
      "SCHEDULE_ENDED",
    );
  }
}

export async function reconcileExamStatuses(examId?: string, now = new Date()): Promise<void> {
  const baseFilter = examId ? { id: examId } : {};

  await db.$transaction([
    db.exam.updateMany({
      where: {
        ...baseFilter,
        status: { in: [ExamStatus.PUBLISHED, ExamStatus.ONGOING] },
        scheduledEnd: { lte: now },
      },
      data: { status: ExamStatus.COMPLETED },
    }),
    db.exam.updateMany({
      where: {
        ...baseFilter,
        status: ExamStatus.PUBLISHED,
        scheduledStart: { lte: now },
        scheduledEnd: { gt: now },
      },
      data: { status: ExamStatus.ONGOING },
    }),
  ]);
}
