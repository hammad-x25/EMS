import { Difficulty, Prisma, QuestionType, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
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
  const query = (params.get("search") ?? params.get("q"))?.trim();
  const pagination = parsePagination(params, { defaultLimit: 20, maxLimit: 100 });

  const difficulty = Object.values(Difficulty).includes(difficultyParam as Difficulty)
    ? (difficultyParam as Difficulty)
    : undefined;
  const type = Object.values(QuestionType).includes(typeParam as QuestionType)
    ? (typeParam as QuestionType)
    : undefined;

  const ownerScope = actor.role === Role.ADMIN ? undefined : actor.userId;

  const where: Prisma.QuestionWhereInput = {
    createdById: ownerScope,
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

  if (pagination.enabled) {
    const [total, questions, distinctTopics] = await db.$transaction([
      db.question.count({ where }),
      db.question.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { topic: "asc" }],
        skip: pagination.skip,
        take: pagination.limit,
        include: { _count: { select: { examQuestions: true } } },
      }),
      db.question.findMany({
        where: { createdById: ownerScope },
        distinct: ["topic"],
        select: { topic: true },
        orderBy: { topic: "asc" },
      }),
    ]);

    return NextResponse.json({
      questions: questions.map(toQuestionDto),
      topics: distinctTopics.map((item) => item.topic),
      pagination: buildPaginationMeta(pagination.page, pagination.limit, total),
    });
  }

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
