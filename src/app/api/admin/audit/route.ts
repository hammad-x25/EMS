import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { requireAuth } from "@/lib/rbac";

export const GET = apiHandler(async (request) => {
  await requireAuth([Role.ADMIN]);
  const params = request.nextUrl.searchParams;
  const search = (params.get("search") ?? params.get("q"))?.trim();
  const actionParam = params.get("action")?.trim();
  const pagination = parsePagination(params, { defaultLimit: 25, maxLimit: 100 });

  const where: Prisma.AuditLogWhereInput = {
    action: actionParam && actionParam !== "ALL" ? actionParam : undefined,
    OR: search
      ? [
          { action: { contains: search, mode: "insensitive" } },
          { entityType: { contains: search, mode: "insensitive" } },
          { entityId: { contains: search, mode: "insensitive" } },
          { actor: { name: { contains: search, mode: "insensitive" } } },
          { actor: { email: { contains: search, mode: "insensitive" } } },
        ]
      : undefined,
  };

  if (params.has("page")) {
    const [total, logs, distinctActions] = await db.$transaction([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      db.auditLog.findMany({
        distinct: ["action"],
        select: { action: true },
        orderBy: { action: "asc" },
      }),
    ]);

    return NextResponse.json({
      logs: logs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })),
      actions: distinctActions.map((item) => item.action),
      pagination: buildPaginationMeta(pagination.page, pagination.limit, total),
    });
  }

  const requested = Number(params.get("limit") ?? "50");
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 100) : 50;
  const logs = await db.auditLog.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({
    logs: logs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })),
  });
});
