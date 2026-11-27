import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { assertExamReadAccess } from "@/lib/exam-lifecycle";
import { PoolQuestion, simulateFairnessReport } from "@/lib/fairness";
import { parseCorrectIdsJson, parseOptionsJson } from "@/lib/question-bank";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  const { id } = await context.params;
  const countParam = Number(request.nextUrl.searchParams.get("count") ?? "20");
  const simulationCount = Number.isFinite(countParam) ? Math.min(Math.max(countParam, 2), 100) : 20;

  const exam = await db.exam.findUnique({
    where: { id },
    include: {
      examQuestions: { include: { question: true } },
      blueprintRules: true,
    },
  });
  if (!exam) throw new NotFoundError("Examination not found");
  assertExamReadAccess(actor, exam.createdById);

  const bankQuestions = await db.question.findMany({
    where: { createdById: exam.createdById },
  });

  const poolMap = new Map<string, PoolQuestion>();
  for (const q of bankQuestions) {
    poolMap.set(q.id, {
      id: q.id,
      topic: q.topic,
      difficulty: q.difficulty,
      type: q.type,
      prompt: q.prompt,
      options: parseOptionsJson(q.optionsJson),
      correctIds: parseCorrectIdsJson(q.correctIdsJson),
      maxMarks: q.maxMarks,
      multiSelectRule: exam.multiSelectRule,
      negativeRatio: exam.negativeMarkRatio,
    });
  }
  for (const eq of exam.examQuestions) {
    if (!poolMap.has(eq.question.id)) {
      poolMap.set(eq.question.id, {
        id: eq.question.id,
        topic: eq.question.topic,
        difficulty: eq.question.difficulty,
        type: eq.question.type,
        prompt: eq.question.prompt,
        options: parseOptionsJson(eq.question.optionsJson),
        correctIds: parseCorrectIdsJson(eq.question.correctIdsJson),
        maxMarks: eq.marks,
        multiSelectRule: exam.multiSelectRule,
        negativeRatio: exam.negativeMarkRatio,
      });
    }
  }

  if (exam.useStratifiedBlueprint && exam.blueprintRules.length === 0) {
    throw new BadRequestError("Add at least one blueprint rule to preview paper fairness");
  }
  if (!exam.useStratifiedBlueprint && exam.examQuestions.length === 0) {
    throw new BadRequestError("Assign at least one question to preview paper fairness");
  }

  try {
    const report = simulateFairnessReport({
      examId: exam.id,
      questionPool: Array.from(poolMap.values()),
      useStratifiedBlueprint: exam.useStratifiedBlueprint,
      blueprintRules: exam.blueprintRules.map((rule) => ({
        topic: rule.topic,
        difficulty: rule.difficulty,
        pickCount: rule.pickCount,
        marksEach: rule.marksEach,
      })),
      assignedQuestions: exam.examQuestions.map((item) => ({
        questionId: item.questionId,
        orderIndex: item.orderIndex,
        marks: item.marks,
      })),
      shuffleQuestions: exam.shuffleQuestions,
      shuffleOptions: exam.shuffleOptions,
      simulationCount,
    });

    return NextResponse.json({ report });
  } catch (error: unknown) {
    throw new BadRequestError(
      error instanceof Error ? error.message : "Unable to simulate fairness report",
      "FAIRNESS_SIMULATION_FAILED",
    );
  }
});
