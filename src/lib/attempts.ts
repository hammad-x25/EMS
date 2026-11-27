import { randomUUID } from "node:crypto";
import {
  AttemptStatus,
  ExamStatus,
  Prisma,
  QuestionType,
  Role,
} from "@prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { reconcileExamStatuses } from "@/lib/exam-lifecycle";
import { deriveAttemptSeed, generateBalancedPaper, type PoolQuestion } from "@/lib/fairness";
import { parseCorrectIdsJson, parseOptionsJson, type QuestionOption } from "@/lib/question-bank";

export const AnswerMutationSchema = z.object({
  snapshotId: z.string().trim().min(1),
  selectedIds: z.array(z.string().trim().min(1).max(32)).max(20).nullable().optional(),
  writtenText: z.string().max(50_000).nullable().optional(),
  markedForReview: z.boolean().default(false),
  clientSeq: z.number().int().positive(),
  capturedAt: z.iso.datetime(),
});

export const SyncAnswersSchema = z.object({
  mutations: z.array(AnswerMutationSchema).min(1).max(100),
});

export const AttemptEventSchema = z.object({
  eventType: z.enum(["TAB_BLUR", "FULLSCREEN_EXIT", "PASTE_ATTEMPT"]),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export type AnswerMutation = z.infer<typeof AnswerMutationSchema>;

export interface AttemptQuestionDto {
  snapshotId: string;
  displayOrder: number;
  type: QuestionType;
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  prompt: string;
  options: QuestionOption[] | null;
  maxMarks: number;
  answer: {
    selectedIds: string[] | null;
    writtenText: string | null;
    markedForReview: boolean;
    clientSeq: number;
    savedAt: string;
  } | null;
}

export interface AttemptDto {
  id: string;
  examId: string;
  examTitle: string;
  instructions: string;
  isSandbox: boolean;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  hardDeadlineAt: string;
  effectiveDeadlineAt: string;
  serverNow: string;
  timeExtensionMinutes: number;
  maxScore: number;
  lastClientSeq: number;
  questions: AttemptQuestionDto[];
  announcements: Array<{ id: string; message: string; createdAt: string }>;
}

const attemptInclude = Prisma.validator<Prisma.AttemptInclude>()({
  exam: {
    include: {
      announcements: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  },
  snapshots: {
    orderBy: { displayOrder: "asc" },
    include: { answer: true },
  },
});

type AttemptWithWorkspace = Prisma.AttemptGetPayload<{ include: typeof attemptInclude }>;

export function calculateEffectiveDeadline(
  hardDeadlineAt: Date,
  timeExtensionMinutes: number,
): Date {
  return new Date(hardDeadlineAt.getTime() + Math.max(0, timeExtensionMinutes) * 60_000);
}

export function shouldApplyMutation(existingClientSeq: number | null, incomingClientSeq: number): boolean {
  return existingClientSeq === null || incomingClientSeq > existingClientSeq;
}

export function isRealAttempt(isSandbox: boolean): boolean {
  return !isSandbox;
}

function parseSelectedIds(value: Prisma.JsonValue | null): string[] | null {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) return null;
  return value;
}

export function toAttemptDto(attempt: AttemptWithWorkspace, now = new Date()): AttemptDto {
  const effectiveDeadlineAt = calculateEffectiveDeadline(
    attempt.hardDeadlineAt,
    attempt.timeExtensionMinutes,
  );
  return {
    id: attempt.id,
    examId: attempt.examId,
    examTitle: attempt.exam.title,
    instructions: attempt.exam.instructions,
    isSandbox: attempt.isSandbox,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    hardDeadlineAt: attempt.hardDeadlineAt.toISOString(),
    effectiveDeadlineAt: effectiveDeadlineAt.toISOString(),
    serverNow: now.toISOString(),
    timeExtensionMinutes: attempt.timeExtensionMinutes,
    maxScore: attempt.maxScore,
    lastClientSeq: attempt.lastClientSeq,
    questions: attempt.snapshots.map((snapshot) => ({
      snapshotId: snapshot.id,
      displayOrder: snapshot.displayOrder,
      type: snapshot.type,
      topic: snapshot.topic,
      difficulty: snapshot.difficulty,
      prompt: snapshot.promptSnapshot,
      options: parseOptionsJson(snapshot.optionsSnapshot),
      maxMarks: snapshot.maxMarks,
      answer: snapshot.answer
        ? {
            selectedIds: parseSelectedIds(snapshot.answer.selectedIdsJson),
            writtenText: snapshot.answer.writtenText,
            markedForReview: snapshot.answer.markedForReview,
            clientSeq: snapshot.answer.clientSeq,
            savedAt: snapshot.answer.savedAt.toISOString(),
          }
        : null,
    })),
    announcements: attempt.exam.announcements
      .slice()
      .reverse()
      .map((announcement) => ({
        id: announcement.id,
        message: announcement.message,
        createdAt: announcement.createdAt.toISOString(),
      })),
  };
}

function assertAttemptAccess(actor: SessionUser, attempt: AttemptWithWorkspace): void {
  if (
    actor.role === Role.CANDIDATE &&
    !attempt.isSandbox &&
    attempt.userId === actor.userId
  ) {
    return;
  }
  if (
    actor.role === Role.EXAMINER &&
    attempt.isSandbox &&
    attempt.userId === actor.userId &&
    attempt.exam.createdById === actor.userId
  ) {
    return;
  }
  throw new ForbiddenError("You do not have access to this attempt");
}

async function loadWorkspaceAttempt(id: string): Promise<AttemptWithWorkspace> {
  const attempt = await db.attempt.findUnique({ where: { id }, include: attemptInclude });
  if (!attempt) throw new NotFoundError("Attempt not found");
  return attempt;
}

async function expireIfDue(attempt: AttemptWithWorkspace, now: Date): Promise<AttemptWithWorkspace> {
  const effectiveDeadline = calculateEffectiveDeadline(
    attempt.hardDeadlineAt,
    attempt.timeExtensionMinutes,
  );
  if (attempt.status !== AttemptStatus.IN_PROGRESS || now <= effectiveDeadline) return attempt;

  await db.attempt.updateMany({
    where: { id: attempt.id, status: AttemptStatus.IN_PROGRESS },
    data: { status: AttemptStatus.EXPIRED, submittedAt: now },
  });
  return loadWorkspaceAttempt(attempt.id);
}

async function loadPaperSource(examId: string) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      examQuestions: { include: { question: true } },
      blueprintRules: true,
    },
  });
  if (!exam) throw new NotFoundError("Examination not found");

  const bankQuestions = await db.question.findMany({ where: { createdById: exam.createdById } });
  const poolMap = new Map<string, PoolQuestion>();
  for (const question of bankQuestions) {
    poolMap.set(question.id, {
      id: question.id,
      topic: question.topic,
      difficulty: question.difficulty,
      type: question.type,
      prompt: question.prompt,
      options: parseOptionsJson(question.optionsJson),
      correctIds: parseCorrectIdsJson(question.correctIdsJson),
      maxMarks: question.maxMarks,
      multiSelectRule: exam.multiSelectRule,
      negativeRatio: exam.negativeMarkRatio,
    });
  }
  for (const assigned of exam.examQuestions) {
    if (!poolMap.has(assigned.questionId)) {
      poolMap.set(assigned.questionId, {
        id: assigned.question.id,
        topic: assigned.question.topic,
        difficulty: assigned.question.difficulty,
        type: assigned.question.type,
        prompt: assigned.question.prompt,
        options: parseOptionsJson(assigned.question.optionsJson),
        correctIds: parseCorrectIdsJson(assigned.question.correctIdsJson),
        maxMarks: assigned.marks,
        multiSelectRule: exam.multiSelectRule,
        negativeRatio: exam.negativeMarkRatio,
      });
    }
  }
  return { exam, questionPool: Array.from(poolMap.values()) };
}

export async function startOrResumeAttempt(params: {
  actor: SessionUser;
  examId: string;
  sandbox: boolean;
  now?: Date;
}): Promise<AttemptDto> {
  const now = params.now ?? new Date();
  if (!params.sandbox) await reconcileExamStatuses(params.examId, now);
  const { exam, questionPool } = await loadPaperSource(params.examId);

  if (params.sandbox) {
    if (params.actor.role !== Role.EXAMINER || exam.createdById !== params.actor.userId) {
      throw new ForbiddenError("Only the owning examiner can launch this sandbox");
    }
    const sandboxStatuses: ExamStatus[] = [
      ExamStatus.DRAFT,
      ExamStatus.PUBLISHED,
      ExamStatus.ONGOING,
    ];
    if (!sandboxStatuses.includes(exam.status)) {
      throw new ConflictError("Completed examinations cannot launch new sandbox attempts", "SANDBOX_UNAVAILABLE");
    }
  } else {
    if (params.actor.role !== Role.CANDIDATE) throw new ForbiddenError();
    const enrollment = await db.enrollment.findUnique({
      where: { examId_userId: { examId: exam.id, userId: params.actor.userId } },
    });
    if (!enrollment) throw new ForbiddenError("You are not enrolled in this examination");
    if (
      exam.status !== ExamStatus.ONGOING ||
      now < exam.scheduledStart ||
      now >= exam.scheduledEnd
    ) {
      throw new ConflictError("This examination is not currently available", "EXAM_NOT_AVAILABLE");
    }
  }

  const existing = await db.attempt.findFirst({
    where: { examId: exam.id, userId: params.actor.userId, isSandbox: params.sandbox },
    orderBy: { startedAt: "desc" },
    include: attemptInclude,
  });
  if (existing) {
    const current = await expireIfDue(existing, now);
    if (current.status === AttemptStatus.IN_PROGRESS) return toAttemptDto(current, now);
    throw new ConflictError(
      params.sandbox
        ? "This sandbox attempt is finalized. Reset it before starting again."
        : "You have already finalized this examination attempt.",
      "ATTEMPT_FINALIZED",
    );
  }

  const attemptId = randomUUID();
  const seed = deriveAttemptSeed(attemptId);
  let paper;
  try {
    paper = generateBalancedPaper({
      questionPool,
      useStratifiedBlueprint: exam.useStratifiedBlueprint,
      blueprintRules: exam.blueprintRules.map((rule) => ({
        topic: rule.topic,
        difficulty: rule.difficulty,
        pickCount: rule.pickCount,
        marksEach: rule.marksEach,
      })),
      assignedQuestions: exam.examQuestions.map((item) => ({
        questionId: item.questionId,
        orderIndex: item.orderIndex,
        marks: item.marks,
      })),
      shuffleQuestions: exam.shuffleQuestions,
      shuffleOptions: exam.shuffleOptions,
      seed,
    });
  } catch (error: unknown) {
    throw new BadRequestError(
      error instanceof Error ? error.message : "Unable to generate examination paper",
      "PAPER_GENERATION_FAILED",
    );
  }
  if (paper.items.length === 0) {
    throw new BadRequestError("The examination has no configured questions", "EMPTY_EXAM");
  }

  const durationDeadline = new Date(now.getTime() + exam.durationMinutes * 60_000);
  const hardDeadlineAt = params.sandbox
    ? durationDeadline
    : new Date(Math.min(durationDeadline.getTime(), exam.scheduledEnd.getTime()));

  try {
    await db.$transaction(
      async (tx) => {
        const duplicate = await tx.attempt.findFirst({
          where: { examId: exam.id, userId: params.actor.userId, isSandbox: params.sandbox },
          select: { id: true },
        });
        if (duplicate) throw new ConflictError("An attempt already exists", "ATTEMPT_EXISTS");
        await tx.attempt.create({
          data: {
            id: attemptId,
            examId: exam.id,
            userId: params.actor.userId,
            isSandbox: params.sandbox,
            seed,
            startedAt: now,
            lastHeartbeatAt: now,
            hardDeadlineAt,
            maxScore: paper.totalMarks,
            fairnessDifficultyAvg: paper.fairnessDifficultyAvg,
            snapshots: {
              create: paper.items.map((item) => ({
                questionId: item.questionId,
                displayOrder: item.displayOrder,
                type: item.type,
                topic: item.topic,
                difficulty: item.difficulty,
                promptSnapshot: item.promptSnapshot,
                optionsSnapshot: item.optionsSnapshot
                  ? (item.optionsSnapshot as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
                correctIdsSnap: item.correctIdsSnap
                  ? (item.correctIdsSnap as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
                maxMarks: item.maxMarks,
                multiSelectRule: item.multiSelectRule,
                negativeRatio: item.negativeRatio,
              })),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      const raced = await db.attempt.findFirst({
        where: { examId: exam.id, userId: params.actor.userId, isSandbox: params.sandbox },
        include: attemptInclude,
      });
      if (raced?.status === AttemptStatus.IN_PROGRESS) return toAttemptDto(raced, now);
    }
    throw error;
  }

  return toAttemptDto(await loadWorkspaceAttempt(attemptId), now);
}

export async function getAttempt(actor: SessionUser, attemptId: string, now = new Date()): Promise<AttemptDto> {
  const attempt = await loadWorkspaceAttempt(attemptId);
  assertAttemptAccess(actor, attempt);
  return toAttemptDto(await expireIfDue(attempt, now), now);
}

function validateMutation(snapshot: AttemptWithWorkspace["snapshots"][number], mutation: AnswerMutation): void {
  if (snapshot.type === QuestionType.WRITTEN) {
    if ((mutation.selectedIds?.length ?? 0) > 0) {
      throw new BadRequestError("Written responses cannot contain selected options", "INVALID_ANSWER");
    }
    return;
  }
  if (mutation.writtenText && mutation.writtenText.trim().length > 0) {
    throw new BadRequestError("Objective responses cannot contain written text", "INVALID_ANSWER");
  }
  const optionIds = new Set((parseOptionsJson(snapshot.optionsSnapshot) ?? []).map((option) => option.id));
  for (const selectedId of mutation.selectedIds ?? []) {
    if (!optionIds.has(selectedId)) {
      throw new BadRequestError("Selected option does not belong to this question", "INVALID_OPTION");
    }
  }
  if (snapshot.type === QuestionType.SINGLE_MCQ && (mutation.selectedIds?.length ?? 0) > 1) {
    throw new BadRequestError("Single-answer questions accept at most one option", "INVALID_ANSWER");
  }
}

export async function syncAnswers(
  actor: SessionUser,
  attemptId: string,
  mutations: AnswerMutation[],
  now = new Date(),
): Promise<{ accepted: number; ignored: number; attempt: AttemptDto }> {
  const attempt = await loadWorkspaceAttempt(attemptId);
  assertAttemptAccess(actor, attempt);
  const effectiveDeadline = calculateEffectiveDeadline(attempt.hardDeadlineAt, attempt.timeExtensionMinutes);
  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new ConflictError("This attempt no longer accepts answers", "ATTEMPT_FINALIZED");
  }
  if (now.getTime() > effectiveDeadline.getTime() + 5_000) {
    await db.attempt.updateMany({
      where: { id: attempt.id, status: AttemptStatus.IN_PROGRESS },
      data: { status: AttemptStatus.EXPIRED, submittedAt: now },
    });
    throw new ConflictError("The examination time limit has expired", "ATTEMPT_EXPIRED");
  }

  const snapshots = new Map(attempt.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  let accepted = 0;
  let ignored = 0;
  let highestClientSeq = attempt.lastClientSeq;
  const connectionGapMs = now.getTime() - attempt.lastHeartbeatAt.getTime();

  await db.$transaction(async (tx) => {
    for (const mutation of [...mutations].sort((a, b) => a.clientSeq - b.clientSeq)) {
      const snapshot = snapshots.get(mutation.snapshotId);
      if (!snapshot) throw new BadRequestError("Question snapshot does not belong to this attempt", "INVALID_SNAPSHOT");
      validateMutation(snapshot, mutation);
      const existing = await tx.attemptAnswer.findUnique({ where: { snapshotId: mutation.snapshotId } });
      if (!shouldApplyMutation(existing?.clientSeq ?? null, mutation.clientSeq)) {
        ignored += 1;
        continue;
      }
      const selectedIds = mutation.selectedIds ?? [];
      await tx.attemptAnswer.upsert({
        where: { snapshotId: mutation.snapshotId },
        update: {
          selectedIdsJson: snapshot.type === QuestionType.WRITTEN
            ? Prisma.JsonNull
            : (selectedIds as Prisma.InputJsonValue),
          writtenText: snapshot.type === QuestionType.WRITTEN ? mutation.writtenText ?? "" : null,
          markedForReview: mutation.markedForReview,
          clientSeq: mutation.clientSeq,
          savedAt: now,
        },
        create: {
          attemptId: attempt.id,
          snapshotId: mutation.snapshotId,
          selectedIdsJson: snapshot.type === QuestionType.WRITTEN
            ? Prisma.JsonNull
            : (selectedIds as Prisma.InputJsonValue),
          writtenText: snapshot.type === QuestionType.WRITTEN ? mutation.writtenText ?? "" : null,
          markedForReview: mutation.markedForReview,
          clientSeq: mutation.clientSeq,
          savedAt: now,
        },
      });
      accepted += 1;
      highestClientSeq = Math.max(highestClientSeq, mutation.clientSeq);
    }
    await tx.attempt.update({
      where: { id: attempt.id },
      data: { lastClientSeq: highestClientSeq, lastHeartbeatAt: now },
    });
    if (connectionGapMs > 15_000) {
      await tx.attemptEvent.create({
        data: {
          attemptId: attempt.id,
          eventType: "RECONNECTED",
          severity: "INFO",
          metadata: { gapSeconds: Math.round(connectionGapMs / 1000) },
          occurredAt: now,
        },
      });
    }
  });

  return { accepted, ignored, attempt: await getAttempt(actor, attempt.id, now) };
}

export async function heartbeatAttempt(actor: SessionUser, attemptId: string, now = new Date()): Promise<AttemptDto> {
  const attempt = await loadWorkspaceAttempt(attemptId);
  assertAttemptAccess(actor, attempt);
  const current = await expireIfDue(attempt, now);
  if (current.status === AttemptStatus.IN_PROGRESS) {
    await db.attempt.update({ where: { id: current.id }, data: { lastHeartbeatAt: now } });
  }
  return getAttempt(actor, attemptId, now);
}

export async function recordAttemptEvent(
  actor: SessionUser,
  attemptId: string,
  input: z.infer<typeof AttemptEventSchema>,
  now = new Date(),
): Promise<void> {
  const attempt = await loadWorkspaceAttempt(attemptId);
  assertAttemptAccess(actor, attempt);
  if (attempt.status !== AttemptStatus.IN_PROGRESS) return;
  await db.attemptEvent.create({
    data: {
      attemptId,
      eventType: input.eventType,
      severity: "NOTICE",
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      occurredAt: now,
    },
  });
}

export async function submitAttempt(actor: SessionUser, attemptId: string, now = new Date()): Promise<AttemptDto> {
  const attempt = await loadWorkspaceAttempt(attemptId);
  assertAttemptAccess(actor, attempt);
  const effectiveDeadline = calculateEffectiveDeadline(attempt.hardDeadlineAt, attempt.timeExtensionMinutes);
  const targetStatus = now > effectiveDeadline ? AttemptStatus.EXPIRED : AttemptStatus.SUBMITTED;
  if (attempt.status === AttemptStatus.IN_PROGRESS) {
    await db.attempt.updateMany({
      where: { id: attempt.id, status: AttemptStatus.IN_PROGRESS },
      data: { status: targetStatus, submittedAt: now },
    });
  }
  return getAttempt(actor, attemptId, now);
}

export async function resetSandboxAttempt(actor: SessionUser, examId: string): Promise<void> {
  if (actor.role !== Role.EXAMINER) throw new ForbiddenError();
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { createdById: true } });
  if (!exam) throw new NotFoundError("Examination not found");
  if (exam.createdById !== actor.userId) throw new ForbiddenError("Only the owning examiner can reset this sandbox");
  await db.attempt.deleteMany({ where: { examId, userId: actor.userId, isSandbox: true } });
}
