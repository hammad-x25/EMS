import { Difficulty, MultiSelectScoring, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  deriveAttemptSeed,
  generateBalancedPaper,
  PoolQuestion,
  simulateFairnessReport,
} from "@/lib/fairness";

function buildPool(): PoolQuestion[] {
  const topics = ["Algorithms", "Databases", "Networks"];
  const difficulties: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
  const pool: PoolQuestion[] = [];

  for (const topic of topics) {
    for (const difficulty of difficulties) {
      for (let idx = 1; idx <= 3; idx += 1) {
        pool.push({
          id: `${topic}-${difficulty}-${idx}`,
          topic,
          difficulty,
          type: QuestionType.SINGLE_MCQ,
          prompt: `${topic} ${difficulty} question #${idx}`,
          options: [
            { id: "a", text: "Option A" },
            { id: "b", text: "Option B" },
            { id: "c", text: "Option C" },
            { id: "d", text: "Option D" },
          ],
          correctIds: ["b"],
          maxMarks: 2,
          multiSelectRule: MultiSelectScoring.PARTIAL_NO_NEGATIVE,
          negativeRatio: 0,
        });
      }
    }
  }
  return pool;
}

describe("stratified fairness-balanced paper generator", () => {
  const pool = buildPool();
  const rules = [
    { topic: "Algorithms", difficulty: Difficulty.EASY, pickCount: 1, marksEach: 2 },
    { topic: "Algorithms", difficulty: Difficulty.HARD, pickCount: 1, marksEach: 4 },
    { topic: "Databases", difficulty: Difficulty.MEDIUM, pickCount: 2, marksEach: 3 },
    { topic: "Networks", difficulty: Difficulty.EASY, pickCount: 1, marksEach: 2 },
  ];

  it("produces zero difficulty variance and 100% topic coverage across 100 simulated attempts", () => {
    const report = simulateFairnessReport({
      examId: "exam-fairness-1",
      questionPool: pool,
      useStratifiedBlueprint: true,
      blueprintRules: rules,
      assignedQuestions: [],
      shuffleQuestions: true,
      shuffleOptions: true,
      simulationCount: 100,
    });

    expect(report.questionsPerPaper).toBe(5);
    expect(report.difficultyStdDev).toBe(0);
    expect(report.difficultyVariance).toBe(0);
    expect(report.topicCoveragePercent).toBe(100);
    expect(report.samplePapers).toHaveLength(2);
  });

  it("generates distinct question permutations across attempts while preserving answer-key IDs", () => {
    const paperA = generateBalancedPaper({
      questionPool: pool,
      useStratifiedBlueprint: true,
      blueprintRules: rules,
      assignedQuestions: [],
      shuffleQuestions: true,
      shuffleOptions: true,
      seed: deriveAttemptSeed("attempt-candidate-1"),
    });

    const paperB = generateBalancedPaper({
      questionPool: pool,
      useStratifiedBlueprint: true,
      blueprintRules: rules,
      assignedQuestions: [],
      shuffleQuestions: true,
      shuffleOptions: true,
      seed: deriveAttemptSeed("attempt-candidate-2"),
    });

    expect(paperA.totalMarks).toBe(14);
    expect(paperB.totalMarks).toBe(14);
    expect(paperA.fairnessDifficultyAvg).toBe(paperB.fairnessDifficultyAvg);
    expect(paperA.items.map((i) => i.questionId)).not.toEqual(
      paperB.items.map((i) => i.questionId),
    );

    for (const item of paperA.items) {
      const optionIds = (item.optionsSnapshot ?? []).map((opt) => opt.id);
      expect(optionIds).toContain("b");
      expect(item.correctIdsSnap).toEqual(["b"]);
    }
  });
});
