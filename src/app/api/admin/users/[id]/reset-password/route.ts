import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { hashPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { requireAuth } from "@/lib/rbac";
import { ResetPasswordSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.ADMIN]);
  const { id } = await context.params;
  const input = ResetPasswordSchema.parse(await request.json());
  const existing = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("User not found");
  await db.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(input.password), tokenVersion: { increment: 1 } },
  });
  await writeAudit({ actorId: actor.userId, action: "PASSWORD_RESET", entityType: "User", entityId: id });
  return NextResponse.json({ ok: true });
});
