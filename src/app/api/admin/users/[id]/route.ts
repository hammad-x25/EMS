import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireAuth } from "@/lib/rbac";
import { toUserDto } from "@/lib/user-dto";
import { UpdateUserSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export const PATCH = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.ADMIN]);
  const { id } = await context.params;
  const input = UpdateUserSchema.parse(await request.json());
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("User not found");
  if (id === actor.userId && (input.isActive === false || (input.role && input.role !== Role.ADMIN))) {
    throw new ForbiddenError("You cannot deactivate or remove your own administrator role");
  }

  const revokeExistingSessions =
    input.isActive === false || (input.role !== undefined && input.role !== existing.role);

  const user = await db.user.update({
    where: { id },
    data: {
      name: input.name,
      role: input.role,
      studentId: input.studentId === undefined ? undefined : input.studentId || null,
      isActive: input.isActive,
      ...(revokeExistingSessions ? { tokenVersion: { increment: 1 } } : {}),
    },
  });
  await writeAudit({
    actorId: actor.userId,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: user.id,
    details: { before: { name: existing.name, role: existing.role, isActive: existing.isActive }, after: { name: user.name, role: user.role, isActive: user.isActive } },
  });
  return NextResponse.json({ user: toUserDto(user) });
});
