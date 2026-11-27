import { Difficulty, Prisma, QuestionType, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  CreateQuestionSchema,
  toQuestionDto,
  toQuestionPersistenceData,
} from "@/lib/question-bank";
import { requireAuth } from "@/lib/rbac";

export const GET = apiHandler(async (request) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  const params = request.nextUrl.searchParams;

  const topic = params.get("topic")?.trim();
  const difficultyParam = params.get("difficulty");
  const typeParam = params.get("type");
  const query = params.get("q")?.trim();

  const difficulty = Object.values(Difficulty).includes(difficultyParam as Difficulty)
    ? (difficultyParam as Difficulty)
    : undefined;
  const type = Object.values(QuestionType).includes(typeParam as QuestionType)
    ? (typeParam as QuestionType)
    : undefined;

  const where: Prisma.QuestionWhereInput = {
    createdById: actor.role === Role.ADMIN ? undefined : actor.userId,
    topic: topic && topic !== "ALL" ? topic : undefined,
    difficulty,
    type,
    OR: query
      ? [
          { prompt: { contains: query, mode: "insensitive" } },
          { topic: { contains: query, mode: "insensitive" } },
        ]
      : undefined,
  };

  const questions = await db.question.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { topic: "asc" }],
    include: { _count: { select: { examQuestions: true } } },
  });

  const topics = Array.from(new Set(questions.map((q) => q.topic))).sort((a, b) =>
    a.localeCompare(b),
  );

  return NextResponse.json({
    questions: questions.map(toQuestionDto),
    topics,
  });
});

export const POST = apiHandler(async (request) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  const input = CreateQuestionSchema.parse(await request.json());

  const created = await db.question.create({
    data: {
      ...toQuestionPersistenceData(input),
      createdById: actor.userId,
    },
    include: { _count: { select: { examQuestions: true } } },
  });

  await writeAudit({
    actorId: actor.userId,
    action: "QUESTION_CREATED",
    entityType: "Question",
    entityId: created.id,
    details: { topic: created.topic, difficulty: created.difficulty, type: created.type },
  });

  return NextResponse.json({ question: toQuestionDto(created) }, { status: 201 });
});
