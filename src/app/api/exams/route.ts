import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { toExamDto } from "@/lib/exam-dto";
import { ExamBaseSchema, reconcileExamStatuses } from "@/lib/exam-lifecycle";
import { requireAuth } from "@/lib/rbac";

export const GET = apiHandler(async () => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  await reconcileExamStatuses();

  const exams = await db.exam.findMany({
    where: actor.role === Role.ADMIN ? undefined : { createdById: actor.userId },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      examQuestions: { include: { question: true } },
      blueprintRules: true,
      _count: {
        select: {
          examQuestions: true,
          blueprintRules: true,
          enrollments: true,
          attempts: { where: { isSandbox: false } },
        },
      },
    },
  });

  return NextResponse.json({ exams: exams.map(toExamDto) });
});

export const POST = apiHandler(async (request) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const input = ExamBaseSchema.parse(await request.json());

  const created = await db.exam.create({
    data: {
      ...input,
      createdById: actor.userId,
    },
    include: {
      examQuestions: { include: { question: true } },
      blueprintRules: true,
      _count: {
        select: {
          examQuestions: true,
          blueprintRules: true,
          enrollments: true,
          attempts: { where: { isSandbox: false } },
        },
      },
    },
  });

  await writeAudit({
    actorId: actor.userId,
    action: "EXAM_CREATED",
    entityType: "Exam",
    entityId: created.id,
    details: { title: created.title, totalMarks: created.totalMarks },
  });

  return NextResponse.json({ exam: toExamDto(created) }, { status: 201 });
});
