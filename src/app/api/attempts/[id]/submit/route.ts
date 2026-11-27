import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { submitAttempt, SubmitAttemptSchema } from "@/lib/attempts";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.CANDIDATE, Role.EXAMINER]);
  const { id } = await context.params;
  const rawBody = await request.text();
  const input = SubmitAttemptSchema.parse(rawBody ? JSON.parse(rawBody) : {});
  return NextResponse.json({ attempt: await submitAttempt(actor, id, input.mutations) });
});
