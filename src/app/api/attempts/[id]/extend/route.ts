import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { grantTimeExtension, TimeExtensionSchema } from "@/lib/monitoring";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;
  const input = TimeExtensionSchema.parse(await request.json());
  return NextResponse.json({ extension: await grantTimeExtension(actor, id, input) });
});
