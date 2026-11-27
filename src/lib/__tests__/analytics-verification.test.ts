import { Prisma, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeExamAnalytics } from "@/lib/analytics";
import { generateCandidateReportPdf } from "@/lib/pdf-reports";
import {
  maskCandidateIdentifier,
  maskCandidateName,
  signVerificationPayload,
  verifyVerificationSignature,
} from "@/lib/verification";

describe("analytics, verifiable reports, and PDF output", () => {
  it("calculates skip rate, p-value, and distractor frequencies from submissions", () => {
    const options = [{ id: "a", text: "Alpha" }, { id: "b", text: "Beta" }] as Prisma.JsonValue;
    const analytics = computeExamAnalytics({
      examId: "exam-1",
      title: "Fixture Exam",
      passingMarks: 1,
      maxScore: 2,
      attempts: [
        { totalScore: 2, maxScore: 2, snapshots: [{ questionId: "q1", promptSnapshot: "Choose", type: QuestionType.SINGLE_MCQ, optionsSnapshot: options, maxMarks: 2, answer: { selectedIdsJson: ["a"], writtenText: null, autoScore: 2, manualScore: null } }] },
        { totalScore: 0, maxScore: 2, snapshots: [{ questionId: "q1", promptSnapshot: "Choose", type: QuestionType.SINGLE_MCQ, optionsSnapshot: options, maxMarks: 2, answer: { selectedIdsJson: ["b"], writtenText: null, autoScore: 0, manualScore: null } }] },
        { totalScore: 0, maxScore: 2, snapshots: [{ questionId: "q1", promptSnapshot: "Choose", type: QuestionType.SINGLE_MCQ, optionsSnapshot: options, maxMarks: 2, answer: null }] },
      ],
    });
    expect(analytics.questions[0].skipRate).toBe(33.33);
    expect(analytics.questions[0].correctnessRate).toBe(33.33);
    expect(analytics.questions[0].observedDifficultyIndex).toBe(0.33);
    expect(analytics.questions[0].distractorSelections).toEqual([
      { optionId: "a", text: "Alpha", count: 1 },
      { optionId: "b", text: "Beta", count: 1 },
    ]);
    expect(analytics.questions[0].flags).toContain("HIGH_SKIP_RATE");
  });

  it("rejects a tampered HMAC payload and masks private candidate data", () => {
    const secret = "a-secure-test-report-signing-secret";
    const payload = { code: "AEG-ABCD-1234", attemptId: "attempt-1", totalScore: 8, maxScore: 10, version: 1, issuedAt: "2026-11-27T12:00:00.000Z" };
    const signature = signVerificationPayload(payload, secret);
    expect(verifyVerificationSignature(payload, signature, secret)).toBe(true);
    expect(verifyVerificationSignature({ ...payload, totalScore: 9 }, signature, secret)).toBe(false);
    expect(maskCandidateName("Demo Candidate")).toBe("D*** C********");
    expect(maskCandidateIdentifier("AEG-2026-001")).toBe("AEG******001");
  });

  it("generates a valid PDF score report larger than 1KB", async () => {
    const pdf = await generateCandidateReportPdf({
      candidateName: "Demo Candidate",
      candidateIdentifier: "AEG-2026-001",
      examTitle: "Fixture Examination",
      attemptedAt: new Date("2026-11-27T12:00:00.000Z"),
      totalScore: 8,
      maxScore: 10,
      passingMarks: 5,
      verificationCode: "AEG-ABCD-1234",
      verificationUrl: "https://example.test/verify/AEG-ABCD-1234",
      version: 1,
      sections: [{ topic: "Algorithms", earned: 8, maximum: 10 }],
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
