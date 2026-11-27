import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { AttemptEventSchema, recordAttemptEvent } from "@/lib/attempts";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.CANDIDATE, Role.EXAMINER]);
  const { id } = await context.params;
  const input = AttemptEventSchema.parse(await request.json());
  await recordAttemptEvent(actor, id, input);
  return new NextResponse(null, { status: 204 });
});
