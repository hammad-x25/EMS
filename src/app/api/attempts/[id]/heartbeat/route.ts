import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { heartbeatAttempt } from "@/lib/attempts";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.CANDIDATE, Role.EXAMINER]);
  const { id } = await context.params;
  return NextResponse.json({ attempt: await heartbeatAttempt(actor, id) });
});
