import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/rbac";

export const GET = apiHandler(async (request) => {
  await requireAuth([Role.ADMIN]);
  const requested = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 100) : 50;
  const logs = await db.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({
    logs: logs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })),
  });
});
