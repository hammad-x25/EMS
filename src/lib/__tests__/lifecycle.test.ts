import { ExamStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { BadRequestError, ConflictError } from "@/lib/errors";
import {
  computeDerivedExamStatus,
  validateManualTransition,
} from "@/lib/exam-lifecycle";

describe("examination lifecycle state machine", () => {
  const now = new Date("2026-11-27T12:00:00.000Z");
  const start = new Date("2026-11-27T13:00:00.000Z");
  const end = new Date("2026-11-27T15:00:00.000Z");

  it("rejects illegal DRAFT -> COMPLETED transition", () => {
    expect(() =>
      validateManualTransition(ExamStatus.DRAFT, ExamStatus.COMPLETED, {
        scheduledStart: start,
        scheduledEnd: end,
        totalMarks: 10,
        useStratifiedBlueprint: false,
        assignedMarksSum: 10,
        assignedCount: 2,
        blueprintMarksSum: 0,
        blueprintRuleCount: 0,
        insufficientStrata: [],
        nonSandboxAttemptCount: 0,
        now,
      }),
    ).toThrowError(ConflictError);
  });

  it("rejects publishing an exam with 0 questions or mismatched marks", () => {
    expect(() =>
      validateManualTransition(ExamStatus.DRAFT, ExamStatus.PUBLISHED, {
        scheduledStart: start,
        scheduledEnd: end,
        totalMarks: 10,
        useStratifiedBlueprint: false,
        assignedMarksSum: 0,
        assignedCount: 0,
        blueprintMarksSum: 0,
        blueprintRuleCount: 0,
        insufficientStrata: [],
        nonSandboxAttemptCount: 0,
        now,
      }),
    ).toThrowError(BadRequestError);

    expect(() =>
      validateManualTransition(ExamStatus.DRAFT, ExamStatus.PUBLISHED, {
        scheduledStart: start,
        scheduledEnd: end,
        totalMarks: 10,
        useStratifiedBlueprint: false,
        assignedMarksSum: 8,
        assignedCount: 2,
        blueprintMarksSum: 0,
        blueprintRuleCount: 0,
        insufficientStrata: [],
        nonSandboxAttemptCount: 0,
        now,
      }),
    ).toThrowError(BadRequestError);
  });

  it("derives ONGOING and COMPLETED automatically from server clock", () => {
    expect(
      computeDerivedExamStatus(
        { status: ExamStatus.DRAFT, scheduledStart: start, scheduledEnd: end },
        new Date("2026-11-27T14:00:00.000Z"),
      ),
    ).toBe(ExamStatus.DRAFT);

    expect(
      computeDerivedExamStatus(
        { status: ExamStatus.PUBLISHED, scheduledStart: start, scheduledEnd: end },
        new Date("2026-11-27T13:30:00.000Z"),
      ),
    ).toBe(ExamStatus.ONGOING);

    expect(
      computeDerivedExamStatus(
        { status: ExamStatus.ONGOING, scheduledStart: start, scheduledEnd: end },
        new Date("2026-11-27T15:00:00.000Z"),
      ),
    ).toBe(ExamStatus.COMPLETED);
  });
});
