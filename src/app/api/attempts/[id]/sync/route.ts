import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { syncAnswers, SyncAnswersSchema } from "@/lib/attempts";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.CANDIDATE, Role.EXAMINER]);
  const { id } = await context.params;
  const input = SyncAnswersSchema.parse(await request.json());
  return NextResponse.json(await syncAnswers(actor, id, input.mutations));
});
