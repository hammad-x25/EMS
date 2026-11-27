import { Difficulty, Prisma, Question, QuestionType, Role } from "@prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/errors";

export const QuestionOptionSchema = z.object({
  id: z.string().trim().min(1, "Option ID is required").max(32),
  text: z.string().trim().min(1, "Option text is required").max(1000),
});

export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

const BaseQuestionObjectSchema = z.object({
  topic: z.string().trim().min(2, "Topic must be at least 2 characters").max(80),
  difficulty: z.nativeEnum(Difficulty),
  type: z.nativeEnum(QuestionType),
  prompt: z.string().trim().min(5, "Prompt must be at least 5 characters").max(5000),
  options: z.array(QuestionOptionSchema).max(12).nullable().optional(),
  correctIds: z.array(z.string().trim().min(1)).max(12).nullable().optional(),
  maxMarks: z.coerce.number().positive("Max marks must be greater than 0").max(1000),
  explanation: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

function validateQuestionRules(
  value: z.infer<typeof BaseQuestionObjectSchema>,
  ctx: z.RefinementCtx,
): void {
  const options = value.options ?? [];
  const correctIds = value.correctIds ?? [];

  if (value.type === QuestionType.WRITTEN) {
    if (options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Written questions must not define answer options",
      });
    }
    if (correctIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctIds"],
        message: "Written questions must not define objective answer keys",
      });
    }
    return;
  }

  if (options.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["options"],
      message: "Objective questions require at least 2 options",
    });
    return;
  }

  const optionIds = new Set<string>();
  for (const option of options) {
    if (optionIds.has(option.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: `Duplicate option ID "${option.id}"`,
      });
      return;
    }
    optionIds.add(option.id);
  }

  const uniqueCorrect = new Set(correctIds);
  if (uniqueCorrect.size !== correctIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correctIds"],
      message: "Duplicate option IDs in correctIds",
    });
  }

  for (const correctId of uniqueCorrect) {
    if (!optionIds.has(correctId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctIds"],
        message: `Correct option ID "${correctId}" does not exist in options`,
      });
    }
  }

  if (value.type === QuestionType.SINGLE_MCQ && uniqueCorrect.size !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correctIds"],
      message: "Single-answer MCQ must have exactly 1 correct option",
    });
  }

  if (value.type === QuestionType.MULTI_SELECT && uniqueCorrect.size < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correctIds"],
      message: "Multiple-select question must have at least 1 correct option",
    });
  }
}

export const CreateQuestionSchema = BaseQuestionObjectSchema.superRefine(validateQuestionRules);

export const UpdateQuestionSchema = BaseQuestionObjectSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;

export interface QuestionDto {
  id: string;
  topic: string;
  difficulty: Difficulty;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  correctIds: string[] | null;
  maxMarks: number;
  explanation: string | null;
  createdById: string;
  assignedExamCount: number;
  createdAt: string;
  updatedAt: string;
}

export function parseOptionsJson(value: Prisma.JsonValue | null): QuestionOption[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = z.array(QuestionOptionSchema).safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseCorrectIdsJson(value: Prisma.JsonValue | null): string[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = z.array(z.string()).safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function toQuestionDto(
  question: Question & { _count?: { examQuestions: number } },
): QuestionDto {
  return {
    id: question.id,
    topic: question.topic,
    difficulty: question.difficulty,
    type: question.type,
    prompt: question.prompt,
    options: parseOptionsJson(question.optionsJson),
    correctIds: parseCorrectIdsJson(question.correctIdsJson),
    maxMarks: question.maxMarks,
    explanation: question.explanation ?? null,
    createdById: question.createdById,
    assignedExamCount: question._count?.examQuestions ?? 0,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}

export function toQuestionPersistenceData(input: CreateQuestionInput) {
  const isWritten = input.type === QuestionType.WRITTEN;
  return {
    topic: input.topic,
    difficulty: input.difficulty,
    type: input.type,
    prompt: input.prompt,
    optionsJson: isWritten ? Prisma.JsonNull : ((input.options ?? []) as Prisma.InputJsonValue),
    correctIdsJson: isWritten ? Prisma.JsonNull : ((input.correctIds ?? []) as Prisma.InputJsonValue),
    maxMarks: input.maxMarks,
    explanation: input.explanation ?? null,
  };
}

export function assertQuestionAccess(actor: SessionUser, questionCreatedById: string): void {
  if (actor.role === Role.ADMIN) return;
  if (actor.role === Role.EXAMINER && questionCreatedById === actor.userId) return;
  throw new ForbiddenError("You do not have permission to access this question");
}
