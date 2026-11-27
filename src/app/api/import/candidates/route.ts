import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { parseCandidateImport } from "@/lib/bulk-import";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, UnprocessableError } from "@/lib/errors";
import { requireAuth } from "@/lib/rbac";
import { toUserDto } from "@/lib/user-dto";

const ImportCandidatesRequestSchema = z.object({
  format: z.enum(["csv", "json"]),
  content: z.string().min(1, "Import content is required").max(500_000),
  dryRun: z.boolean().default(true),
  enrollExamId: z.string().trim().min(1).optional().nullable(),
});

const DEFAULT_IMPORT_PASSWORD = "Candidate@123!";

export const POST = apiHandler(async (request) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  const input = ImportCandidatesRequestSchema.parse(await request.json());

  if (input.enrollExamId) {
    const exam = await db.exam.findUnique({
      where: { id: input.enrollExamId },
      select: { id: true, createdById: true },
    });
    if (!exam) throw new NotFoundError("Target examination not found");
    if (actor.role !== Role.ADMIN && exam.createdById !== actor.userId) {
      throw new ForbiddenError("You do not have permission to enroll candidates in this examination");
    }
  }

  const parsed = parseCandidateImport(input.content, input.format);
  const emails = parsed.validRows.map((row) => row.email);

  const existingUsers =
    emails.length > 0
      ? await db.user.findMany({
          where: { email: { in: emails } },
          select: { id: true, email: true, role: true },
        })
      : [];

  const existingByEmail = new Map(existingUsers.map((user) => [user.email, user]));
  const combinedErrors = [...parsed.errors];

  parsed.validRows.forEach((row, idx) => {
    const existing = existingByEmail.get(row.email);
    if (existing && existing.role !== Role.CANDIDATE) {
      combinedErrors.push({
        row: idx + 1,
        field: "email",
        message: `Account "${row.email}" already exists with role ${existing.role} and cannot be imported as a candidate`,
      });
    }
  });

  const existingCandidateCount = parsed.validRows.filter(
    (row) => existingByEmail.get(row.email)?.role === Role.CANDIDATE,
  ).length;
  const newCandidateCount = parsed.validRows.length - existingCandidateCount;

  if (input.dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalRows: parsed.totalRows,
      validCount: parsed.validRows.length,
      newUsersCount: newCandidateCount,
      existingCandidatesCount: existingCandidateCount,
      errorCount: combinedErrors.length,
      errors: combinedErrors,
      preview: parsed.validRows.slice(0, 10).map((row) => ({
        name: row.name,
        email: row.email,
        studentId: row.studentId,
        status: existingByEmail.has(row.email) ? "EXISTING_CANDIDATE" : "NEW_CANDIDATE",
      })),
    });
  }

  if (combinedErrors.length > 0 || parsed.validRows.length === 0) {
    throw new UnprocessableError(
      combinedErrors.length > 0
        ? "Candidate import failed validation"
        : "No valid candidate rows found to import",
      "IMPORT_VALIDATION_FAILED",
      { errors: combinedErrors, validCount: parsed.validRows.length },
    );
  }

  const defaultPasswordHash = await hashPassword(DEFAULT_IMPORT_PASSWORD);
  const passwordHashes = new Map<string, string>();
  for (const row of parsed.validRows) {
    if (!existingByEmail.has(row.email)) {
      passwordHashes.set(
        row.email,
        row.password ? await hashPassword(row.password) : defaultPasswordHash,
      );
    }
  }

  const result = await db.$transaction(async (tx) => {
    const createdUsers = [];
    const candidateIds: string[] = [];
    let skippedExisting = 0;

    for (const row of parsed.validRows) {
      const existing = existingByEmail.get(row.email);
      if (existing) {
        skippedExisting += 1;
        candidateIds.push(existing.id);
        continue;
      }

      const created = await tx.user.create({
        data: {
          email: row.email,
          name: row.name,
          studentId: row.studentId,
          role: Role.CANDIDATE,
          passwordHash: passwordHashes.get(row.email) ?? defaultPasswordHash,
        },
      });
      createdUsers.push(created);
      candidateIds.push(created.id);
    }

    let enrolledCount = 0;
    if (input.enrollExamId && candidateIds.length > 0) {
      const enrolled = await tx.enrollment.createMany({
        data: candidateIds.map((userId) => ({
          examId: input.enrollExamId as string,
          userId,
        })),
        skipDuplicates: true,
      });
      enrolledCount = enrolled.count;
    }

    return {
      createdUsers: createdUsers.map(toUserDto),
      skippedExisting,
      enrolledCount,
    };
  });

  await writeAudit({
    actorId: actor.userId,
    action: "CANDIDATES_BULK_IMPORTED",
    entityType: input.enrollExamId ? "Exam" : "User",
    entityId: input.enrollExamId ?? actor.userId,
    details: {
      format: input.format,
      createdCount: result.createdUsers.length,
      skippedExisting: result.skippedExisting,
      enrolledCount: result.enrolledCount,
    },
  });

  return NextResponse.json(
    {
      dryRun: false,
      createdCount: result.createdUsers.length,
      skippedExisting: result.skippedExisting,
      enrolledCount: result.enrolledCount,
      defaultTemporaryPassword: DEFAULT_IMPORT_PASSWORD,
      users: result.createdUsers,
    },
    { status: 201 },
  );
});
