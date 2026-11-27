import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { hashPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/rbac";
import { toUserDto } from "@/lib/user-dto";
import { CreateUserSchema } from "@/lib/validation";

export const GET = apiHandler(async (request) => {
  await requireAuth([Role.ADMIN]);
  const search = request.nextUrl.searchParams.get("q")?.trim();
  const roleParam = request.nextUrl.searchParams.get("role");
  const statusParam = request.nextUrl.searchParams.get("status");
  const role = Object.values(Role).includes(roleParam as Role) ? (roleParam as Role) : undefined;
  const where: Prisma.UserWhereInput = {
    role,
    isActive: statusParam === "active" ? true : statusParam === "inactive" ? false : undefined,
    OR: search
      ? [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { studentId: { contains: search, mode: "insensitive" } },
        ]
      : undefined,
  };
  const users = await db.user.findMany({ where, orderBy: [{ role: "asc" }, { name: "asc" }] });
  return NextResponse.json({ users: users.map(toUserDto) });
});

export const POST = apiHandler(async (request) => {
  const actor = await requireAuth([Role.ADMIN]);
  const input = CreateUserSchema.parse(await request.json());
  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      studentId: input.studentId || null,
    },
  });
  await writeAudit({
    actorId: actor.userId,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    details: { email: user.email, role: user.role },
  });
  return NextResponse.json({ user: toUserDto(user) }, { status: 201 });
});
