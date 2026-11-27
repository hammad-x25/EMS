import { AttemptStatus, Prisma, QuestionType } from "@prisma/client";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

export interface AnalyticsAnswerInput {
  selectedIdsJson: Prisma.JsonValue | null;
  writtenText: string | null;
  autoScore: number | null;
  manualScore: number | null;
}

export interface AnalyticsSnapshotInput {
  questionId: string;
  promptSnapshot: string;
  type: QuestionType;
  optionsSnapshot: Prisma.JsonValue | null;
  maxMarks: number;
  answer: AnalyticsAnswerInput | null;
}

export interface AnalyticsAttemptInput {
  totalScore: number | null;
  maxScore: number;
  snapshots: AnalyticsSnapshotInput[];
}

export interface QuestionAnalyticsDto {
  questionId: string;
  prompt: string;
  type: QuestionType;
  responseCount: number;
  skipRate: number;
  correctnessRate: number;
  observedDifficultyIndex: number;
  distractorSelections: Array<{ optionId: string; text: string; count: number }>;
  flags: string[];
}

export interface ExamAnalyticsDto {
  examId: string;
  title: string;
  passingMarks: number;
  maxScore: number;
  submissionCount: number;
  mean: number;
  median: number;
  minimum: number;
  maximum: number;
  passRate: number;
  histogram: Array<{ label: string; count: number }>;
  questions: QuestionAnalyticsDto[];
}

function rounded(value: number): number {
  return Number(value.toFixed(2));
}

function stringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function options(value: Prisma.JsonValue | null): Array<{ id: string; text: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    return typeof item.id === "string" && typeof item.text === "string"
      ? [{ id: item.id, text: item.text }]
      : [];
  });
}

function isAnswered(snapshot: AnalyticsSnapshotInput): boolean {
  if (!snapshot.answer) return false;
  if (snapshot.type === QuestionType.WRITTEN) {
    return Boolean(snapshot.answer.writtenText?.trim());
  }
  return stringArray(snapshot.answer.selectedIdsJson).length > 0;
}

export function computeExamAnalytics(input: {
  examId: string;
  title: string;
  passingMarks: number;
  maxScore: number;
  attempts: AnalyticsAttemptInput[];
}): ExamAnalyticsDto {
  const scores = input.attempts
    .map((attempt) => attempt.totalScore)
    .filter((score): score is number => score !== null)
    .sort((left, right) => left - right);
  const mean = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  const median = scores.length === 0
    ? 0
    : scores.length % 2 === 1
      ? scores[Math.floor(scores.length / 2)]
      : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2;
  const bucketLabels = ["0–20%", "21–40%", "41–60%", "61–80%", "81–100%"];
  const histogram = bucketLabels.map((label) => ({ label, count: 0 }));
  for (const score of scores) {
    const percentage = input.maxScore > 0 ? (score / input.maxScore) * 100 : 0;
    const index = Math.min(4, Math.max(0, Math.ceil(Math.max(percentage, 1) / 20) - 1));
    histogram[index].count += 1;
  }

  const grouped = new Map<string, AnalyticsSnapshotInput[]>();
  for (const attempt of input.attempts) {
    for (const snapshot of attempt.snapshots) {
      grouped.set(snapshot.questionId, [...(grouped.get(snapshot.questionId) ?? []), snapshot]);
    }
  }
  const questions = Array.from(grouped.entries()).map(([questionId, snapshots]) => {
    const responseCount = snapshots.length;
    const answered = snapshots.filter(isAnswered);
    const skipRate = responseCount ? ((responseCount - answered.length) / responseCount) * 100 : 0;
    const fullCredit = snapshots.filter((snapshot) => {
      const score = (snapshot.answer?.autoScore ?? 0) + (snapshot.answer?.manualScore ?? 0);
      return score >= snapshot.maxMarks;
    }).length;
    const normalized = snapshots.reduce((sum, snapshot) => {
      const score = (snapshot.answer?.autoScore ?? 0) + (snapshot.answer?.manualScore ?? 0);
      return sum + Math.max(0, Math.min(1, score / snapshot.maxMarks));
    }, 0);
    const optionList = options(snapshots[0].optionsSnapshot);
    const counts = new Map(optionList.map((option) => [option.id, 0]));
    for (const snapshot of snapshots) {
      for (const selectedId of stringArray(snapshot.answer?.selectedIdsJson ?? null)) {
        counts.set(selectedId, (counts.get(selectedId) ?? 0) + 1);
      }
    }
    const correctnessRate = responseCount ? (fullCredit / responseCount) * 100 : 0;
    const flags: string[] = [];
    if (correctnessRate < 25) flags.push("LOW_CORRECTNESS");
    if (skipRate > 30) flags.push("HIGH_SKIP_RATE");
    return {
      questionId,
      prompt: snapshots[0].promptSnapshot,
      type: snapshots[0].type,
      responseCount,
      skipRate: rounded(skipRate),
      correctnessRate: rounded(correctnessRate),
      observedDifficultyIndex: rounded(responseCount ? normalized / responseCount : 0),
      distractorSelections: optionList.map((option) => ({
        optionId: option.id,
        text: option.text,
        count: counts.get(option.id) ?? 0,
      })),
      flags,
    } satisfies QuestionAnalyticsDto;
  });

  return {
    examId: input.examId,
    title: input.title,
    passingMarks: input.passingMarks,
    maxScore: input.maxScore,
    submissionCount: input.attempts.length,
    mean: rounded(mean),
    median: rounded(median),
    minimum: rounded(scores[0] ?? 0),
    maximum: rounded(scores.at(-1) ?? 0),
    passRate: rounded(scores.length ? (scores.filter((score) => score >= input.passingMarks).length / scores.length) * 100 : 0),
    histogram,
    questions: questions.sort((left, right) => left.prompt.localeCompare(right.prompt)),
  };
}

export async function getExamAnalytics(examId: string): Promise<ExamAnalyticsDto> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      attempts: {
        where: {
          isSandbox: false,
          status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED, AttemptStatus.GRADED, AttemptStatus.PUBLISHED] },
        },
        include: { snapshots: { include: { answer: true } } },
      },
    },
  });
  if (!exam) throw new NotFoundError("Examination not found");
  return computeExamAnalytics({
    examId: exam.id,
    title: exam.title,
    passingMarks: exam.passingMarks,
    maxScore: exam.totalMarks,
    attempts: exam.attempts,
  });
}
