import { Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { parseCandidateImport, parseQuestionImport } from "@/lib/bulk-import";

describe("bulk question import parser", () => {
  it("parses valid CSV questions with pipe-delimited options and correctIds", () => {
    const csv = [
      "topic,difficulty,type,prompt,options,correctIds,maxMarks,explanation",
      'Algorithms,EASY,SINGLE_MCQ,"Which structure is FIFO?","a:Stack|b:Queue|c:Heap",b,2,"Queue removes oldest first"',
      'Databases,HARD,MULTI_SELECT,"Select ACID properties","a:Atomicity|b:Velocity|c:Isolation",a|c,4,',
      'Networks,MEDIUM,WRITTEN,"Explain TCP three-way handshake.",,,5,',
    ].join("\n");

    const result = parseQuestionImport(csv, "csv");
    expect(result.errors).toEqual([]);
    expect(result.totalRows).toBe(3);
    expect(result.validRows).toHaveLength(3);
    expect(result.validRows[0]).toMatchObject({
      topic: "Algorithms",
      difficulty: Difficulty.EASY,
      type: QuestionType.SINGLE_MCQ,
      correctIds: ["b"],
      maxMarks: 2,
    });
    expect(result.validRows[1].correctIds).toEqual(["a", "c"]);
    expect(result.validRows[2].options).toBeNull();
  });

  it("reports exact CSV row numbers and fields for invalid rows", () => {
    const csv = [
      "topic,difficulty,type,prompt,options,correctIds,maxMarks",
      'Algorithms,EASY,SINGLE_MCQ,"Valid prompt here","a:One|b:Two",a,2',
      'Databases,IMPOSSIBLE,SINGLE_MCQ,"Bad difficulty and missing key","a:One|b:Two",z,0',
    ].join("\n");

    const result = parseQuestionImport(csv, "csv");
    expect(result.validRows).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors.every((error) => error.row === 3)).toBe(true);
    expect(result.errors.map((error) => error.field)).toContain("difficulty");
    expect(result.errors.map((error) => error.field)).toContain("maxMarks");
  });

  it("parses JSON arrays and wrapped question objects", () => {
    const json = JSON.stringify({
      questions: [
        {
          topic: "Security",
          difficulty: "MEDIUM",
          type: "SINGLE_MCQ",
          prompt: "Which header prevents clickjacking?",
          options: [
            { id: "a", text: "X-Frame-Options" },
            { id: "b", text: "ETag" },
          ],
          correctIds: ["a"],
          maxMarks: 3,
        },
      ],
    });

    const result = parseQuestionImport(json, "json");
    expect(result.errors).toEqual([]);
    expect(result.validRows).toHaveLength(1);
  });
});

describe("bulk candidate import parser", () => {
  it("validates candidate rows and catches duplicate emails and invalid rows", () => {
    const csv = [
      "name,email,studentId",
      "Alice Khan,Alice@Example.edu,AEG-101",
      "Bob Ali,alice@example.edu,AEG-102",
      "X,not-an-email,AEG-103",
    ].join("\n");

    const result = parseCandidateImport(csv, "csv");
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].email).toBe("alice@example.edu");
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 3, field: "email" }),
        expect.objectContaining({ row: 4, field: "name" }),
        expect.objectContaining({ row: 4, field: "email" }),
      ]),
    );
  });
});
