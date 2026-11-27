import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/rbac";
import { getResultDetail } from "@/lib/results";

type Context = { params: Promise<{ attemptId: string }> };

export const GET = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.CANDIDATE, Role.EXAMINER, Role.ADMIN]);
  const { attemptId } = await context.params;
  return NextResponse.json({ result: await getResultDetail(actor, attemptId) });
});
