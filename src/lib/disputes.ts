import { AttemptStatus, DisputeStatus, Prisma, QuestionType, Role } from "@prisma/client";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  CreateDisputeSchema,
  DISPUTE_CATEGORIES,
  type DisputeCategory,
  type DisputeDto,
  ResolveDisputeSchema,
} from "@/lib/dispute-types";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { getOrCreateVerification } from "@/lib/verification";

export {
  CreateDisputeSchema,
  DISPUTE_CATEGORIES,
  type DisputeCategory,
  type DisputeDto,
  ResolveDisputeSchema,
};

function rounded(value: number): number {
  return Number(value.toFixed(4));
}

export function computeDisputeAdjustedScore(params: {
  currentTotalScore: number;
  maxScore: number;
  questionMaxMarks?: number;
  currentQuestionAutoScore?: number;
  currentQuestionManualScore?: number | null;
  adjustedManualScore?: number;
  scoreDelta?: number;
}): {
  newTotalScore: number;
  appliedDelta: number;
  newManualScore: number | undefined;
} {
  if (params.adjustedManualScore !== undefined) {
    if (params.questionMaxMarks === undefined) {
      throw new BadRequestError("adjustedManualScore requires a question-linked dispute");
    }
    if (params.adjustedManualScore < 0 || params.adjustedManualScore > params.questionMaxMarks) {
      throw new ConflictError(
        `Adjusted score must be between 0 and ${params.questionMaxMarks}`,
        "SCORE_EXCEEDS_MAXIMUM",
      );
    }
    const previousManual = params.currentQuestionManualScore ?? 0;
    const rawDelta = rounded(params.adjustedManualScore - previousManual);
    const nextTotal = rounded(params.currentTotalScore + rawDelta);
    if (nextTotal < 0 || nextTotal > params.maxScore) {
      throw new ConflictError(
        `Adjusted total score (${nextTotal}) must stay within 0 and ${params.maxScore}`,
        "SCORE_OUT_OF_BOUNDS",
      );
    }
    return {
      newTotalScore: nextTotal,
      appliedDelta: rounded(nextTotal - params.currentTotalScore),
      newManualScore: rounded(params.adjustedManualScore),
    };
  }

  const delta = params.scoreDelta ?? 0;
  if (delta === 0) {
    throw new BadRequestError("Score adjustment delta must be non-zero");
  }

  const nextTotal = rounded(params.currentTotalScore + delta);
  if (nextTotal < 0 || nextTotal > params.maxScore) {
    throw new ConflictError(
      `Adjusted total score (${nextTotal}) must stay within 0 and ${params.maxScore}`,
      "SCORE_OUT_OF_BOUNDS",
    );
  }

  let newManualScore: number | undefined;
  if (params.questionMaxMarks !== undefined) {
    const auto = params.currentQuestionAutoScore ?? 0;
    const candidateManual = rounded((params.currentQuestionManualScore ?? 0) + delta);
    if (auto + candidateManual < 0 || auto + candidateManual > params.questionMaxMarks) {
      throw new ConflictError(
        `Question score after adjustment cannot fall outside 0 and ${params.questionMaxMarks}`,
        "SCORE_EXCEEDS_MAXIMUM",
      );
    }
    newManualScore = candidateManual;
  }

  return {
    newTotalScore: nextTotal,
    appliedDelta: rounded(delta),
    newManualScore,
  };
}

function stringArray(value: Prisma.JsonValue | null): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

async function mapDisputeRecords(
  records: Array<{
    id: string;
    examId: string;
    attemptId: string;
    candidateId: string;
    snapshotId: string | null;
    category: string;
    description: string;
    status: DisputeStatus;
    resolutionNote: string | null;
    scoreDelta: number | null;
    resolvedById: string | null;
    createdAt: Date;
    updatedAt: Date;
    exam: { title: string };
    candidate: { id: string; name: string; email: string; studentId: string | null };
    attempt: {
      totalScore: number | null;
      maxScore: number;
      snapshots: Array<{
        id: string;
        displayOrder: number;
        topic: string;
        type: QuestionType;
        promptSnapshot: string;
        maxMarks: number;
        answer: {
          selectedIdsJson: Prisma.JsonValue | null;
          writtenText: string | null;
          autoScore: number | null;
          manualScore: number | null;
          graderFeedback: string | null;
        } | null;
      }>;
      events: Array<{
        id: string;
        eventType: string;
        severity: string;
        occurredAt: Date;
      }>;
    };
  }>,
  includeEmail: boolean,
): Promise<DisputeDto[]> {
  return records.map((record) => {
    const snap = record.snapshotId
      ? record.attempt.snapshots.find((item) => item.id === record.snapshotId) ?? null
      : null;

    return {
      id: record.id,
      examId: record.examId,
      examTitle: record.exam.title,
      attemptId: record.attemptId,
      candidate: {
        id: record.candidate.id,
        name: record.candidate.name,
        email: includeEmail ? record.candidate.email : undefined,
        studentId: record.candidate.studentId,
      },
      snapshotId: record.snapshotId,
      question: snap
        ? {
            displayOrder: snap.displayOrder,
            topic: snap.topic,
            type: snap.type,
            prompt: snap.promptSnapshot,
            maxMarks: snap.maxMarks,
            selectedIds: stringArray(snap.answer?.selectedIdsJson ?? null),
            writtenText: snap.answer?.writtenText ?? null,
            autoScore: snap.answer?.autoScore ?? 0,
            manualScore: snap.answer?.manualScore ?? null,
            graderFeedback: snap.answer?.graderFeedback ?? null,
          }
        : null,
      category: record.category,
      description: record.description,
      status: record.status,
      resolutionNote: record.resolutionNote,
      scoreDelta: record.scoreDelta,
      resolvedById: record.resolvedById,
      attemptTotalScore: record.attempt.totalScore,
      attemptMaxScore: record.attempt.maxScore,
      events: record.attempt.events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        severity: event.severity,
        occurredAt: event.occurredAt.toISOString(),
      })),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  });
}

export async function listDisputes(
  actor: SessionUser,
  filters?: { attemptId?: string; examId?: string; status?: DisputeStatus },
): Promise<DisputeDto[]> {
  const where: Prisma.DisputeWhereInput = {
    attempt: { isSandbox: false },
    attemptId: filters?.attemptId,
    examId: filters?.examId,
    status: filters?.status,
    ...(actor.role === Role.CANDIDATE
      ? { candidateId: actor.userId }
      : actor.role === Role.EXAMINER
        ? { exam: { createdById: actor.userId } }
        : {}),
  };

  const rows = await db.dispute.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      exam: { select: { title: true } },
      candidate: { select: { id: true, name: true, email: true, studentId: true } },
      attempt: {
        select: {
          totalScore: true,
          maxScore: true,
          snapshots: {
            orderBy: { displayOrder: "asc" },
            include: { answer: true },
          },
          events: {
            orderBy: { occurredAt: "asc" },
            take: 25,
          },
        },
      },
    },
  });

  return mapDisputeRecords(rows, actor.role !== Role.CANDIDATE);
}

export async function createDispute(
  actor: SessionUser,
  input: z.infer<typeof CreateDisputeSchema>,
): Promise<DisputeDto> {
  if (actor.role !== Role.CANDIDATE) {
    throw new ForbiddenError("Only candidates can submit result disputes");
  }

  const attempt = await db.attempt.findUnique({
    where: { id: input.attemptId },
    include: {
      exam: true,
      snapshots: { select: { id: true } },
    },
  });

  if (!attempt || attempt.isSandbox) {
    throw new NotFoundError("Published attempt not found");
  }
  if (attempt.userId !== actor.userId) {
    throw new ForbiddenError("You can only dispute your own examination attempt");
  }
  if (attempt.status !== AttemptStatus.PUBLISHED || !attempt.exam.resultsPublishedAt) {
    throw new ConflictError(
      "Disputes can only be filed after results are published",
      "RESULT_NOT_PUBLISHED",
    );
  }
  if (input.snapshotId && !attempt.snapshots.some((snap) => snap.id === input.snapshotId)) {
    throw new BadRequestError("Referenced question does not belong to this attempt");
  }

  const existingOpen = await db.dispute.findFirst({
    where: {
      attemptId: attempt.id,
      snapshotId: input.snapshotId,
      category: input.category,
      status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] },
    },
    select: { id: true },
  });
  if (existingOpen) {
    throw new ConflictError(
      "An active dispute already exists for this item and category",
      "DUPLICATE_ACTIVE_DISPUTE",
    );
  }

  const created = await db.dispute.create({
    data: {
      examId: attempt.examId,
      attemptId: attempt.id,
      candidateId: actor.userId,
      snapshotId: input.snapshotId,
      category: input.category,
      description: input.description,
      status: DisputeStatus.OPEN,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    action: "DISPUTE_FILED",
    entityType: "Dispute",
    entityId: created.id,
    details: {
      attemptId: attempt.id,
      examId: attempt.examId,
      category: input.category,
      snapshotId: input.snapshotId,
    },
  });

  const [dto] = await listDisputes(actor, { attemptId: attempt.id });
  const exact = (await listDisputes(actor, { attemptId: attempt.id })).find(
    (item) => item.id === created.id,
  );
  return exact ?? dto;
}

export async function resolveDispute(
  actor: SessionUser,
  disputeId: string,
  input: z.infer<typeof ResolveDisputeSchema>,
): Promise<{
  dispute: DisputeDto;
  updatedTotalScore: number | null;
  verification: { code: string; version: number } | null;
}> {
  if (actor.role !== Role.EXAMINER) {
    throw new ForbiddenError("Only the owning examiner can resolve disputes");
  }

  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: {
      exam: true,
      attempt: {
        include: {
          snapshots: { include: { answer: true } },
        },
      },
    },
  });

  if (!dispute || dispute.attempt.isSandbox) {
    throw new NotFoundError("Dispute not found");
  }
  if (dispute.exam.createdById !== actor.userId) {
    throw new ForbiddenError("Only the owning examiner can resolve disputes for this examination");
  }
  if (
    dispute.status !== DisputeStatus.OPEN &&
    dispute.status !== DisputeStatus.UNDER_REVIEW
  ) {
    throw new ConflictError(
      "This dispute has already been resolved",
      "DISPUTE_ALREADY_RESOLVED",
    );
  }

  if (input.outcome === "UNDER_REVIEW") {
    await db.dispute.update({
      where: { id: disputeId },
      data: { status: DisputeStatus.UNDER_REVIEW },
    });
    await writeAudit({
      actorId: actor.userId,
      action: "DISPUTE_UNDER_REVIEW",
      entityType: "Dispute",
      entityId: disputeId,
      details: { attemptId: dispute.attemptId },
    });
    const list = await listDisputes(actor, { attemptId: dispute.attemptId });
    return {
      dispute: list.find((item) => item.id === disputeId)!,
      updatedTotalScore: dispute.attempt.totalScore,
      verification: null,
    };
  }

  if (input.outcome === "RESOLVED_UPHELD" || input.outcome === "REJECTED") {
    const nextStatus =
      input.outcome === "RESOLVED_UPHELD"
        ? DisputeStatus.RESOLVED_UPHELD
        : DisputeStatus.REJECTED;
    await db.dispute.update({
      where: { id: disputeId },
      data: {
        status: nextStatus,
        resolutionNote: input.resolutionNote ?? null,
        resolvedById: actor.userId,
      },
    });
    await writeAudit({
      actorId: actor.userId,
      action: "DISPUTE_RESOLVED",
      entityType: "Dispute",
      entityId: disputeId,
      details: {
        attemptId: dispute.attemptId,
        outcome: nextStatus,
      },
    });
    const list = await listDisputes(actor, { attemptId: dispute.attemptId });
    return {
      dispute: list.find((item) => item.id === disputeId)!,
      updatedTotalScore: dispute.attempt.totalScore,
      verification: null,
    };
  }

  // RESOLVED_ADJUSTED
  if (dispute.attempt.totalScore === null) {
    throw new ConflictError("Cannot adjust an unscored attempt", "ATTEMPT_UNSCORED");
  }

  const targetSnapshot = dispute.snapshotId
    ? dispute.attempt.snapshots.find((snap) => snap.id === dispute.snapshotId) ?? null
    : null;

  if (input.adjustedManualScore !== undefined && !targetSnapshot) {
    throw new BadRequestError("adjustedManualScore requires a question-linked dispute");
  }

  const adjustment = computeDisputeAdjustedScore({
    currentTotalScore: dispute.attempt.totalScore,
    maxScore: dispute.attempt.maxScore,
    questionMaxMarks: targetSnapshot?.maxMarks,
    currentQuestionAutoScore: targetSnapshot?.answer?.autoScore ?? 0,
    currentQuestionManualScore: targetSnapshot?.answer?.manualScore ?? null,
    adjustedManualScore: input.adjustedManualScore,
    scoreDelta: input.scoreDelta,
  });

  await db.$transaction(async (tx) => {
    if (targetSnapshot && adjustment.newManualScore !== undefined) {
      await tx.attemptAnswer.upsert({
        where: { snapshotId: targetSnapshot.id },
        create: {
          attemptId: dispute.attemptId,
          snapshotId: targetSnapshot.id,
          selectedIdsJson: Prisma.JsonNull,
          writtenText: null,
          autoScore: 0,
          manualScore: adjustment.newManualScore,
          graderFeedback: input.resolutionNote ?? null,
        },
        update: {
          manualScore: adjustment.newManualScore,
          graderFeedback: input.resolutionNote ?? targetSnapshot.answer?.graderFeedback ?? null,
        },
      });
    }

    await tx.attempt.update({
      where: { id: dispute.attemptId },
      data: { totalScore: adjustment.newTotalScore },
    });

    await tx.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.RESOLVED_ADJUSTED,
        resolutionNote: input.resolutionNote ?? null,
        scoreDelta: adjustment.appliedDelta,
        resolvedById: actor.userId,
      },
    });
  });

  await writeAudit({
    actorId: actor.userId,
    action: "DISPUTE_SCORE_ADJUSTED",
    entityType: "Dispute",
    entityId: disputeId,
    details: {
      attemptId: dispute.attemptId,
      previousTotalScore: dispute.attempt.totalScore,
      newTotalScore: adjustment.newTotalScore,
      scoreDelta: adjustment.appliedDelta,
      snapshotId: dispute.snapshotId,
    },
  });

  // Issue new report verification version so any prior PDF code becomes REVOKED_SUPERSEDED.
  const issued = await getOrCreateVerification(dispute.attemptId);

  const list = await listDisputes(actor, { attemptId: dispute.attemptId });
  return {
    dispute: list.find((item) => item.id === disputeId)!,
    updatedTotalScore: adjustment.newTotalScore,
    verification: {
      code: issued.record.code,
      version: issued.record.version,
    },
  };
}
