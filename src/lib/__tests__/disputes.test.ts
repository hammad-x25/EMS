import { describe, expect, it } from "vitest";
import {
  computeDisputeAdjustedScore,
  CreateDisputeSchema,
  ResolveDisputeSchema,
} from "@/lib/disputes";
import { BadRequestError, ConflictError } from "@/lib/errors";

describe("dispute validation and score adjustment", () => {
  it("validates dispute creation and resolution payloads", () => {
    const validCreate = CreateDisputeSchema.safeParse({
      attemptId: "attempt-1",
      snapshotId: "snap-1",
      category: "GRADING_ERROR",
      description: "My written answer covered all three complexity bounds accurately.",
    });
    expect(validCreate.success).toBe(true);

    const invalidResolve = ResolveDisputeSchema.safeParse({
      outcome: "RESOLVED_ADJUSTED",
      resolutionNote: "Adjusted after review",
    });
    expect(invalidResolve.success).toBe(false);
  });

  it("computes adjusted manual score and rejects values exceeding question or exam maximum", () => {
    const adjusted = computeDisputeAdjustedScore({
      currentTotalScore: 7,
      maxScore: 10,
      questionMaxMarks: 5,
      currentQuestionAutoScore: 0,
      currentQuestionManualScore: 3,
      adjustedManualScore: 4.5,
    });
    expect(adjusted).toEqual({
      newTotalScore: 8.5,
      appliedDelta: 1.5,
      newManualScore: 4.5,
    });

    expect(() =>
      computeDisputeAdjustedScore({
        currentTotalScore: 7,
        maxScore: 10,
        questionMaxMarks: 5,
        currentQuestionAutoScore: 0,
        currentQuestionManualScore: 3,
        adjustedManualScore: 6,
      }),
    ).toThrowError(ConflictError);
  });

  it("computes attempt-level score deltas and enforces [0, maxScore] bounds", () => {
    const deltaApplied = computeDisputeAdjustedScore({
      currentTotalScore: 6,
      maxScore: 10,
      scoreDelta: 1.5,
    });
    expect(deltaApplied.newTotalScore).toBe(7.5);
    expect(deltaApplied.appliedDelta).toBe(1.5);

    expect(() =>
      computeDisputeAdjustedScore({
        currentTotalScore: 6,
        maxScore: 10,
        scoreDelta: 0,
      }),
    ).toThrowError(BadRequestError);

    expect(() =>
      computeDisputeAdjustedScore({
        currentTotalScore: 9,
        maxScore: 10,
        scoreDelta: 2,
      }),
    ).toThrowError(ConflictError);
  });
});
