import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/rbac";

export const GET = apiHandler(async () => {
  await requireAuth([Role.ADMIN]);
  const [users, activeUsers, exams, attempts, recentExams] = await db.$transaction([
    db.user.count(),
    db.user.count({ where: { isActive: true } }),
    db.exam.count(),
    db.attempt.count({ where: { isSandbox: false } }),
    db.exam.findMany({
      take: 20,
      orderBy: { updatedAt: "desc" },
      include: { createdBy: { select: { name: true, email: true } }, _count: { select: { enrollments: true, attempts: true } } },
    }),
  ]);
  return NextResponse.json({
    totals: { users, activeUsers, exams, attempts },
    exams: recentExams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      status: exam.status,
      scheduledStart: exam.scheduledStart.toISOString(),
      scheduledEnd: exam.scheduledEnd.toISOString(),
      examiner: exam.createdBy,
      enrollments: exam._count.enrollments,
      attempts: exam._count.attempts,
    })),
  });
});
