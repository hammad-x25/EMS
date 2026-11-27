import { MultiSelectScoring, Prisma, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { gradeObjectiveSnapshot, ManualGradeSchema } from "@/lib/grading";

const base = {
  type: QuestionType.MULTI_SELECT,
  correctIdsSnap: ["a", "b"] as Prisma.JsonValue,
  maxMarks: 4,
  negativeRatio: 0.25,
};

describe("objective grading", () => {
  it("awards single-answer marks, configured negative marks, and zero for skips", () => {
    const snapshot = { ...base, type: QuestionType.SINGLE_MCQ, correctIdsSnap: ["b"] };
    expect(gradeObjectiveSnapshot({ ...snapshot, multiSelectRule: MultiSelectScoring.ALL_OR_NOTHING }, { selectedIdsJson: ["b"] })).toBe(4);
    expect(gradeObjectiveSnapshot({ ...snapshot, multiSelectRule: MultiSelectScoring.ALL_OR_NOTHING }, { selectedIdsJson: ["a"] })).toBe(-1);
    expect(gradeObjectiveSnapshot({ ...snapshot, multiSelectRule: MultiSelectScoring.ALL_OR_NOTHING }, null)).toBe(0);
  });

  it("supports all-or-nothing multi-select scoring", () => {
    const snapshot = { ...base, multiSelectRule: MultiSelectScoring.ALL_OR_NOTHING };
    expect(gradeObjectiveSnapshot(snapshot, { selectedIdsJson: ["b", "a"] })).toBe(4);
    expect(gradeObjectiveSnapshot(snapshot, { selectedIdsJson: ["a"] })).toBe(0);
  });

  it("supports partial scoring without negative totals", () => {
    const snapshot = { ...base, multiSelectRule: MultiSelectScoring.PARTIAL_NO_NEGATIVE };
    expect(gradeObjectiveSnapshot(snapshot, { selectedIdsJson: ["a"] })).toBe(2);
    expect(gradeObjectiveSnapshot(snapshot, { selectedIdsJson: ["a", "c", "d"] })).toBe(0);
  });

  it("supports partial scoring with a configured negative floor", () => {
    const snapshot = { ...base, multiSelectRule: MultiSelectScoring.PARTIAL_WITH_NEGATIVE };
    expect(gradeObjectiveSnapshot(snapshot, { selectedIdsJson: ["a", "c"] })).toBe(0);
    expect(gradeObjectiveSnapshot(snapshot, { selectedIdsJson: ["c", "d"] })).toBe(-1);
  });

  it("rejects malformed manual grades", () => {
    expect(() => ManualGradeSchema.parse({ attemptId: "a", snapshotId: "s", manualScore: -1 })).toThrow();
    expect(ManualGradeSchema.parse({ attemptId: "a", snapshotId: "s", manualScore: 4 })).toMatchObject({ manualScore: 4 });
  });
});
