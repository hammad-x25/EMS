import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { startOrResumeAttempt } from "@/lib/attempts";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.CANDIDATE]);
  const { id } = await context.params;
  const attempt = await startOrResumeAttempt({ actor, examId: id, sandbox: false });
  return NextResponse.json({ attempt });
});
