import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { assertExamMutationAccess, assertExamReadAccess } from "@/lib/exam-lifecycle";
import { requireAuth } from "@/lib/rbac";
import { toUserDto } from "@/lib/user-dto";

type Context = { params: Promise<{ id: string }> };

const EnrollCandidatesSchema = z
  .object({
    userIds: z.array(z.string().trim().min(1)).max(500).optional(),
    emails: z.array(z.string().trim().email().transform((v) => v.toLowerCase())).max(500).optional(),
  })
  .refine(
    (value) => (value.userIds?.length ?? 0) > 0 || (value.emails?.length ?? 0) > 0,
    "Provide at least one candidate userId or email",
  );

export const GET = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  const { id } = await context.params;

  const exam = await db.exam.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!exam) throw new NotFoundError("Examination not found");
  assertExamReadAccess(actor, exam.createdById);

  const [enrollments, allCandidates] = await Promise.all([
    db.enrollment.findMany({
      where: { examId: id },
      orderBy: { enrolledAt: "desc" },
      include: { user: true },
    }),
    db.user.findMany({
      where: { role: Role.CANDIDATE, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const enrolledIds = new Set(enrollments.map((item) => item.userId));

  return NextResponse.json({
    enrollments: enrollments.map((item) => ({
      id: item.id,
      enrolledAt: item.enrolledAt.toISOString(),
      candidate: toUserDto(item.user),
    })),
    availableCandidates: allCandidates
      .filter((candidate) => !enrolledIds.has(candidate.id))
      .map(toUserDto),
  });
});

export const POST = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;

  const exam = await db.exam.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!exam) throw new NotFoundError("Examination not found");
  assertExamMutationAccess(actor, exam.createdById);

  const input = EnrollCandidatesSchema.parse(await request.json());

  const targets = await db.user.findMany({
    where: {
      role: Role.CANDIDATE,
      isActive: true,
      OR: [
        ...(input.userIds?.length ? [{ id: { in: input.userIds } }] : []),
        ...(input.emails?.length ? [{ email: { in: input.emails } }] : []),
      ],
    },
    select: { id: true, email: true },
  });

  if (targets.length === 0) {
    throw new BadRequestError("No active candidate accounts matched the selection");
  }

  const created = await db.enrollment.createMany({
    data: targets.map((candidate) => ({ examId: id, userId: candidate.id })),
    skipDuplicates: true,
  });

  await writeAudit({
    actorId: actor.userId,
    action: "CANDIDATES_ENROLLED",
    entityType: "Exam",
    entityId: id,
    details: { addedCount: created.count, targetCount: targets.length },
  });

  return NextResponse.json({ enrolledCount: created.count }, { status: 201 });
});

export const DELETE = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;

  const exam = await db.exam.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!exam) throw new NotFoundError("Examination not found");
  assertExamMutationAccess(actor, exam.createdById);

  const userId = request.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) throw new BadRequestError("userId query parameter is required");

  const existingAttempt = await db.attempt.findFirst({
    where: { examId: id, userId, isSandbox: false },
    select: { id: true },
  });
  if (existingAttempt) {
    throw new ConflictError(
      "Cannot unenroll a candidate who already has an examination attempt",
      "ATTEMPT_EXISTS",
    );
  }

  await db.enrollment.deleteMany({ where: { examId: id, userId } });
  await writeAudit({
    actorId: actor.userId,
    action: "CANDIDATE_UNENROLLED",
    entityType: "Exam",
    entityId: id,
    details: { userId },
  });

  return NextResponse.json({ removed: true });
});
