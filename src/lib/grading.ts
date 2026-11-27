import {
  AttemptStatus,
  MultiSelectScoring,
  Prisma,
  QuestionType,
  Role,
} from "@prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

export interface ObjectiveSnapshotInput {
  type: QuestionType;
  correctIdsSnap: Prisma.JsonValue | null;
  maxMarks: number;
  multiSelectRule: MultiSelectScoring;
  negativeRatio: number;
}

export interface ObjectiveAnswerInput {
  selectedIdsJson: Prisma.JsonValue | null;
}

export const ManualGradeSchema = z.object({
  attemptId: z.string().trim().min(1),
  snapshotId: z.string().trim().min(1),
  manualScore: z.number().finite().min(0),
  graderFeedback: z.string().trim().max(4_000).nullable().optional(),
});

function stringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function sameSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function rounded(value: number): number {
  return Number(value.toFixed(4));
}

export function gradeObjectiveSnapshot(
  snapshot: ObjectiveSnapshotInput,
  answer: ObjectiveAnswerInput | null,
): number {
  if (snapshot.type === QuestionType.WRITTEN) return 0;
  const selected = stringArray(answer?.selectedIdsJson ?? null);
  if (selected.length === 0) return 0;
  const correct = stringArray(snapshot.correctIdsSnap);
  if (correct.length === 0) return 0;

  if (snapshot.type === QuestionType.SINGLE_MCQ) {
    return selected.length === 1 && selected[0] === correct[0]
      ? snapshot.maxMarks
      : rounded(-snapshot.maxMarks * snapshot.negativeRatio);
  }

  if (snapshot.multiSelectRule === MultiSelectScoring.ALL_OR_NOTHING) {
    return sameSet(selected, correct) ? snapshot.maxMarks : 0;
  }

  const correctSelected = selected.filter((id) => correct.includes(id)).length;
  const wrongSelected = selected.filter((id) => !correct.includes(id)).length;
  const proportional =
    ((correctSelected / correct.length) - (wrongSelected / correct.length)) * snapshot.maxMarks;

  if (snapshot.multiSelectRule === MultiSelectScoring.PARTIAL_NO_NEGATIVE) {
    return rounded(Math.max(0, proportional));
  }
  return rounded(Math.max(-snapshot.maxMarks * snapshot.negativeRatio, proportional));
}

export async function recomputeAttemptTotals(attemptId: string): Promise<{
  totalScore: number;
  status: AttemptStatus;
}> {
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: { snapshots: { include: { answer: true } } },
  });
  if (!attempt) throw new NotFoundError("Attempt not found");
  if (attempt.isSandbox) {
    return { totalScore: attempt.totalScore ?? 0, status: attempt.status };
  }

  await db.$transaction(async (tx) => {
    for (const snapshot of attempt.snapshots) {
      if (snapshot.type === QuestionType.WRITTEN) {
        if (!snapshot.answer) {
          await tx.attemptAnswer.create({
            data: {
              attemptId,
              snapshotId: snapshot.id,
              selectedIdsJson: Prisma.JsonNull,
              writtenText: null,
              autoScore: 0,
            },
          });
        }
        continue;
      }
      const autoScore = gradeObjectiveSnapshot(snapshot, snapshot.answer);
      await tx.attemptAnswer.upsert({
        where: { snapshotId: snapshot.id },
        create: {
          attemptId,
          snapshotId: snapshot.id,
          selectedIdsJson: Prisma.JsonNull,
          autoScore,
        },
        update: { autoScore },
      });
    }
  });

  const scored = await db.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { snapshots: { include: { answer: true } } },
  });
  const allWrittenGraded = scored.snapshots
    .filter((snapshot) => snapshot.type === QuestionType.WRITTEN)
    .every((snapshot) => snapshot.answer?.manualScore !== null && snapshot.answer?.manualScore !== undefined);
  const totalScore = rounded(
    scored.snapshots.reduce(
      (sum, snapshot) => sum + (snapshot.answer?.autoScore ?? 0) + (snapshot.answer?.manualScore ?? 0),
      0,
    ),
  );
  const canFinalize =
    scored.status !== AttemptStatus.IN_PROGRESS && scored.status !== AttemptStatus.PUBLISHED;
  const status = canFinalize && allWrittenGraded ? AttemptStatus.GRADED : scored.status;
  await db.attempt.update({ where: { id: attemptId }, data: { totalScore, status } });
  return { totalScore, status };
}

export async function saveManualGrade(
  actor: SessionUser,
  input: z.infer<typeof ManualGradeSchema>,
): Promise<{ totalScore: number; status: AttemptStatus }> {
  if (actor.role !== Role.EXAMINER) throw new ForbiddenError();
  const snapshot = await db.attemptQuestionSnapshot.findUnique({
    where: { id: input.snapshotId },
    include: { attempt: { include: { exam: true } } },
  });
  if (!snapshot || snapshot.attemptId !== input.attemptId) {
    throw new NotFoundError("Written response not found");
  }
  if (snapshot.attempt.exam.createdById !== actor.userId || snapshot.attempt.isSandbox) {
    throw new ForbiddenError("Only the owning examiner can grade this response");
  }
  if (snapshot.type !== QuestionType.WRITTEN) {
    throw new ConflictError("Only written responses accept manual grades", "NOT_MANUAL_RESPONSE");
  }
  if (snapshot.attempt.status === AttemptStatus.IN_PROGRESS) {
    throw new ConflictError("In-progress attempts cannot be graded", "ATTEMPT_IN_PROGRESS");
  }
  if (snapshot.attempt.status === AttemptStatus.PUBLISHED) {
    throw new ConflictError("Published results require the dispute/regrade workflow", "RESULTS_PUBLISHED");
  }
  if (input.manualScore > snapshot.maxMarks) {
    throw new ConflictError(
      `Manual score cannot exceed ${snapshot.maxMarks}`,
      "SCORE_EXCEEDS_MAXIMUM",
    );
  }
  await db.attemptAnswer.upsert({
    where: { snapshotId: snapshot.id },
    create: {
      attemptId: snapshot.attemptId,
      snapshotId: snapshot.id,
      selectedIdsJson: Prisma.JsonNull,
      writtenText: null,
      autoScore: 0,
      manualScore: input.manualScore,
      graderFeedback: input.graderFeedback ?? null,
    },
    update: {
      manualScore: input.manualScore,
      graderFeedback: input.graderFeedback ?? null,
    },
  });
  return recomputeAttemptTotals(snapshot.attemptId);
}
