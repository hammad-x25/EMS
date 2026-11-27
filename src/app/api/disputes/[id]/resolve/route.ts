import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { resolveDispute, ResolveDisputeSchema } from "@/lib/disputes";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;
  const input = ResolveDisputeSchema.parse(await request.json());
  const result = await resolveDispute(actor, id, input);
  return NextResponse.json(result);
});
