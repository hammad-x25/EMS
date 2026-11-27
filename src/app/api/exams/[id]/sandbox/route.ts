import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { resetSandboxAttempt, startOrResumeAttempt } from "@/lib/attempts";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;
  const attempt = await startOrResumeAttempt({ actor, examId: id, sandbox: true });
  return NextResponse.json({ attempt });
});

export const DELETE = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;
  await resetSandboxAttempt(actor, id);
  return new NextResponse(null, { status: 204 });
});
