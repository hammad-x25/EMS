import { Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { CreateQuestionSchema } from "@/lib/question-bank";

describe("question bank validation rules", () => {
  it("accepts valid SINGLE_MCQ, MULTI_SELECT, and WRITTEN definitions", () => {
    const mcq = CreateQuestionSchema.safeParse({
      topic: "Algorithms",
      difficulty: Difficulty.EASY,
      type: QuestionType.SINGLE_MCQ,
      prompt: "Which structure uses LIFO?",
      options: [
        { id: "a", text: "Stack" },
        { id: "b", text: "Queue" },
      ],
      correctIds: ["a"],
      maxMarks: 2,
    });
    expect(mcq.success).toBe(true);

    const multi = CreateQuestionSchema.safeParse({
      topic: "Databases",
      difficulty: Difficulty.MEDIUM,
      type: QuestionType.MULTI_SELECT,
      prompt: "Select valid normal forms.",
      options: [
        { id: "a", text: "1NF" },
        { id: "b", text: "2NF" },
        { id: "c", text: "XNF" },
      ],
      correctIds: ["a", "b"],
      maxMarks: 3,
    });
    expect(multi.success).toBe(true);

    const written = CreateQuestionSchema.safeParse({
      topic: "Networks",
      difficulty: Difficulty.HARD,
      type: QuestionType.WRITTEN,
      prompt: "Contrast TCP congestion control and flow control.",
      options: null,
      correctIds: null,
      maxMarks: 6,
    });
    expect(written.success).toBe(true);
  });

  it("rejects SINGLE_MCQ with multiple correct keys and WRITTEN with options", () => {
    const badMcq = CreateQuestionSchema.safeParse({
      topic: "Algorithms",
      difficulty: Difficulty.EASY,
      type: QuestionType.SINGLE_MCQ,
      prompt: "Pick exactly one option.",
      options: [
        { id: "a", text: "One" },
        { id: "b", text: "Two" },
      ],
      correctIds: ["a", "b"],
      maxMarks: 2,
    });
    expect(badMcq.success).toBe(false);

    const badWritten = CreateQuestionSchema.safeParse({
      topic: "Networks",
      difficulty: Difficulty.MEDIUM,
      type: QuestionType.WRITTEN,
      prompt: "Explain DNS resolution.",
      options: [{ id: "a", text: "Unexpected" }],
      correctIds: ["a"],
      maxMarks: 4,
    });
    expect(badWritten.success).toBe(false);
  });
});
