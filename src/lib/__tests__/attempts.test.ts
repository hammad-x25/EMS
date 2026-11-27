import { describe, expect, it } from "vitest";
import {
  AnswerMutationSchema,
  calculateEffectiveDeadline,
  isRealAttempt,
  shouldApplyMutation,
} from "@/lib/attempts";

describe("attempt delivery rules", () => {
  it("keeps the immutable hard deadline and applies extensions separately", () => {
    const hardDeadline = new Date("2026-11-27T12:00:00.000Z");

    expect(calculateEffectiveDeadline(hardDeadline, 15).toISOString()).toBe(
      "2026-11-27T12:15:00.000Z",
    );
    expect(calculateEffectiveDeadline(hardDeadline, -10).toISOString()).toBe(
      hardDeadline.toISOString(),
    );
  });

  it("accepts only strictly newer answer mutations", () => {
    expect(shouldApplyMutation(null, 1)).toBe(true);
    expect(shouldApplyMutation(4, 5)).toBe(true);
    expect(shouldApplyMutation(5, 5)).toBe(false);
    expect(shouldApplyMutation(6, 5)).toBe(false);
  });

  it("distinguishes real attempts from examiner sandbox attempts", () => {
    expect(isRealAttempt(false)).toBe(true);
    expect(isRealAttempt(true)).toBe(false);
  });

  it("validates queued answer mutations", () => {
    expect(
      AnswerMutationSchema.parse({
        snapshotId: "snapshot-1",
        selectedIds: ["a"],
        markedForReview: true,
        clientSeq: 3,
        capturedAt: "2026-11-27T12:00:00.000Z",
      }),
    ).toMatchObject({ clientSeq: 3, markedForReview: true });

    expect(() =>
      AnswerMutationSchema.parse({
        snapshotId: "snapshot-1",
        clientSeq: 0,
        capturedAt: "not-a-date",
      }),
    ).toThrow();
  });
});
