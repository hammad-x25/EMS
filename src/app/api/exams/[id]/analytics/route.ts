import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getExamAnalytics } from "@/lib/analytics";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { assertExamReadAccess } from "@/lib/exam-lifecycle";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  const { id } = await context.params;
  const exam = await db.exam.findUnique({ where: { id }, select: { createdById: true } });
  if (!exam) throw new NotFoundError("Examination not found");
  assertExamReadAccess(actor, exam.createdById);
  return NextResponse.json({ analytics: await getExamAnalytics(id) });
});
