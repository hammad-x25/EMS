import { createHmac } from "node:crypto";
import { Difficulty, MultiSelectScoring, QuestionType } from "@prisma/client";
import type { QuestionOption } from "@/lib/question-bank";

export interface PoolQuestion {
  id: string;
  topic: string;
  difficulty: Difficulty;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  correctIds: string[] | null;
  maxMarks: number;
  multiSelectRule: MultiSelectScoring;
  negativeRatio: number;
}

export interface BlueprintRuleInput {
  topic: string;
  difficulty: Difficulty;
  pickCount: number;
  marksEach: number;
}

export interface AssignedExamQuestionInput {
  questionId: string;
  orderIndex: number;
  marks: number;
}

export interface GeneratedQuestionItem {
  questionId: string;
  displayOrder: number;
  type: QuestionType;
  topic: string;
  difficulty: Difficulty;
  promptSnapshot: string;
  optionsSnapshot: QuestionOption[] | null;
  correctIdsSnap: string[] | null;
  maxMarks: number;
  multiSelectRule: MultiSelectScoring;
  negativeRatio: number;
}

export interface GeneratedPaperResult {
  seed: string;
  items: GeneratedQuestionItem[];
  fairnessDifficultyAvg: number;
  totalMarks: number;
  topicCounts: Record<string, number>;
  difficultyCounts: Record<Difficulty, number>;
}

export interface FairnessSimulationReport {
  simulationCount: number;
  mode: "STRATIFIED_BLUEPRINT" | "FIXED_SET";
  questionsPerPaper: number;
  targetDifficultyAvg: number;
  simulatedMeanDifficulty: number;
  difficultyStdDev: number;
  difficultyVariance: number;
  minDifficultyAvg: number;
  maxDifficultyAvg: number;
  topicCoveragePercent: number;
  samplePapers: Array<{
    sampleLabel: string;
    fairnessDifficultyAvg: number;
    questionIds: string[];
    items: Array<{
      displayOrder: number;
      questionId: string;
      topic: string;
      difficulty: Difficulty;
      maxMarks: number;
      optionOrder: string[];
    }>;
  }>;
}

const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
};

function getFairnessSecret(): string {
  const secret = process.env.REPORT_HMAC_SECRET || process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("REPORT_HMAC_SECRET or AUTH_SECRET must be configured in production");
  }
  return "aegis-exam-deterministic-fairness-seed";
}

export function deriveAttemptSeed(attemptId: string): string {
  return createHmac("sha256", getFairnessSecret()).update(attemptId).digest("hex");
}

function createSeededRng(seedString: string): () => number {
  const digest = createHmac("sha256", getFairnessSecret()).update(seedString).digest();
  let state = digest.readUInt32LE(0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const current = copy[i];
    copy[i] = copy[j];
    copy[j] = current;
  }
  return copy;
}

export function generateBalancedPaper(params: {
  questionPool: PoolQuestion[];
  useStratifiedBlueprint: boolean;
  blueprintRules: BlueprintRuleInput[];
  assignedQuestions: AssignedExamQuestionInput[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  seed: string;
}): GeneratedPaperResult {
  const rng = createSeededRng(params.seed);
  const byId = new Map(params.questionPool.map((q) => [q.id, q]));

  let selected: Array<{ question: PoolQuestion; marks: number }> = [];

  if (params.useStratifiedBlueprint) {
    const sortedRules = [...params.blueprintRules].sort(
      (a, b) => a.topic.localeCompare(b.topic) || a.difficulty.localeCompare(b.difficulty),
    );
    const usedIds = new Set<string>();

    for (const rule of sortedRules) {
      const matching = params.questionPool.filter(
        (q) =>
          q.topic === rule.topic &&
          q.difficulty === rule.difficulty &&
          !usedIds.has(q.id),
      );
      if (matching.length < rule.pickCount) {
        throw new Error(
          `Insufficient questions for blueprint rule (${rule.topic} / ${rule.difficulty}): need ${rule.pickCount}, found ${matching.length}`,
        );
      }
      const picked = shuffleWithRng(matching, rng).slice(0, rule.pickCount);
      for (const question of picked) {
        usedIds.add(question.id);
        selected.push({ question, marks: rule.marksEach });
      }
    }

    if (params.shuffleQuestions) {
      selected = shuffleWithRng(selected, rng);
    }
  } else {
    const sortedAssigned = [...params.assignedQuestions].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    selected = sortedAssigned.map((entry) => {
      const question = byId.get(entry.questionId);
      if (!question) {
        throw new Error(`Assigned question ${entry.questionId} is missing from question pool`);
      }
      return { question, marks: entry.marks };
    });

    if (params.shuffleQuestions) {
      selected = shuffleWithRng(selected, rng);
    }
  }

  const topicCounts: Record<string, number> = {};
  const difficultyCounts: Record<Difficulty, number> = {
    EASY: 0,
    MEDIUM: 0,
    HARD: 0,
  };

  let difficultyWeightSum = 0;
  let totalMarks = 0;

  const items: GeneratedQuestionItem[] = selected.map(({ question, marks }, index) => {
    topicCounts[question.topic] = (topicCounts[question.topic] ?? 0) + 1;
    difficultyCounts[question.difficulty] += 1;
    difficultyWeightSum += DIFFICULTY_WEIGHT[question.difficulty];
    totalMarks += marks;

    const optionsSnapshot =
      question.type !== QuestionType.WRITTEN && question.options
        ? params.shuffleOptions
          ? shuffleWithRng(question.options, rng)
          : [...question.options]
        : null;

    return {
      questionId: question.id,
      displayOrder: index + 1,
      type: question.type,
      topic: question.topic,
      difficulty: question.difficulty,
      promptSnapshot: question.prompt,
      optionsSnapshot,
      correctIdsSnap:
        question.type !== QuestionType.WRITTEN && question.correctIds
          ? [...question.correctIds]
          : null,
      maxMarks: marks,
      multiSelectRule: question.multiSelectRule,
      negativeRatio: question.negativeRatio,
    };
  });

  const fairnessDifficultyAvg =
    items.length > 0 ? Number((difficultyWeightSum / items.length).toFixed(4)) : 0;

  return {
    seed: params.seed,
    items,
    fairnessDifficultyAvg,
    totalMarks: Number(totalMarks.toFixed(4)),
    topicCounts,
    difficultyCounts,
  };
}

export function simulateFairnessReport(params: {
  examId: string;
  questionPool: PoolQuestion[];
  useStratifiedBlueprint: boolean;
  blueprintRules: BlueprintRuleInput[];
  assignedQuestions: AssignedExamQuestionInput[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  simulationCount?: number;
}): FairnessSimulationReport {
  const simulationCount = Math.max(2, Math.min(params.simulationCount ?? 20, 200));
  const papers: GeneratedPaperResult[] = [];

  for (let i = 0; i < simulationCount; i += 1) {
    const seed = deriveAttemptSeed(`sim:${params.examId}:${i}`);
    papers.push(
      generateBalancedPaper({
        questionPool: params.questionPool,
        useStratifiedBlueprint: params.useStratifiedBlueprint,
        blueprintRules: params.blueprintRules,
        assignedQuestions: params.assignedQuestions,
        shuffleQuestions: params.shuffleQuestions,
        shuffleOptions: params.shuffleOptions,
        seed,
      }),
    );
  }

  const averages = papers.map((paper) => paper.fairnessDifficultyAvg);
  const mean =
    averages.reduce((sum, value) => sum + value, 0) / Math.max(1, averages.length);
  const variance =
    averages.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, averages.length);
  const stdDev = Math.sqrt(variance);

  const expectedTopicTotals: Record<string, number> = {};
  if (params.useStratifiedBlueprint) {
    for (const rule of params.blueprintRules) {
      expectedTopicTotals[rule.topic] = (expectedTopicTotals[rule.topic] ?? 0) + rule.pickCount;
    }
  } else {
    const poolMap = new Map(params.questionPool.map((q) => [q.id, q]));
    for (const assigned of params.assignedQuestions) {
      const q = poolMap.get(assigned.questionId);
      if (q) expectedTopicTotals[q.topic] = (expectedTopicTotals[q.topic] ?? 0) + 1;
    }
  }

  const expectedEntries = Object.entries(expectedTopicTotals);
  const coveredCount = papers.filter((paper) =>
    expectedEntries.every(([topic, count]) => (paper.topicCounts[topic] ?? 0) === count),
  ).length;

  return {
    simulationCount,
    mode: params.useStratifiedBlueprint ? "STRATIFIED_BLUEPRINT" : "FIXED_SET",
    questionsPerPaper: papers[0]?.items.length ?? 0,
    targetDifficultyAvg: Number(mean.toFixed(4)),
    simulatedMeanDifficulty: Number(mean.toFixed(4)),
    difficultyStdDev: Number(stdDev.toFixed(4)),
    difficultyVariance: Number(variance.toFixed(4)),
    minDifficultyAvg: Number(Math.min(...averages).toFixed(4)),
    maxDifficultyAvg: Number(Math.max(...averages).toFixed(4)),
    topicCoveragePercent: Number(((coveredCount / simulationCount) * 100).toFixed(2)),
    samplePapers: papers.slice(0, 2).map((paper, idx) => ({
      sampleLabel: `Simulated Candidate ${idx + 1}`,
      fairnessDifficultyAvg: paper.fairnessDifficultyAvg,
      questionIds: paper.items.map((item) => item.questionId),
      items: paper.items.map((item) => ({
        displayOrder: item.displayOrder,
        questionId: item.questionId,
        topic: item.topic,
        difficulty: item.difficulty,
        maxMarks: item.maxMarks,
        optionOrder: (item.optionsSnapshot ?? []).map((opt) => opt.id),
      })),
    })),
  };
}
