import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { writeAudit } from "@/lib/audit";
import { parseQuestionImport } from "@/lib/bulk-import";
import { db } from "@/lib/db";
import { UnprocessableError } from "@/lib/errors";
import { toQuestionDto, toQuestionPersistenceData } from "@/lib/question-bank";
import { requireAuth } from "@/lib/rbac";

const ImportQuestionsRequestSchema = z.object({
  format: z.enum(["csv", "json"]),
  content: z.string().min(1, "Import content is required").max(500_000),
  dryRun: z.boolean().default(true),
});

export const POST = apiHandler(async (request) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  const input = ImportQuestionsRequestSchema.parse(await request.json());
  const parsed = parseQuestionImport(input.content, input.format);

  if (input.dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalRows: parsed.totalRows,
      validCount: parsed.validRows.length,
      errorCount: parsed.errors.length,
      errors: parsed.errors,
      preview: parsed.validRows.slice(0, 10),
    });
  }

  if (parsed.errors.length > 0 || parsed.validRows.length === 0) {
    throw new UnprocessableError(
      parsed.errors.length > 0
        ? "Question import failed validation"
        : "No valid question rows found to import",
      "IMPORT_VALIDATION_FAILED",
      { errors: parsed.errors, validCount: parsed.validRows.length },
    );
  }

  const created = await db.$transaction(async (tx) => {
    const items = [];
    for (const row of parsed.validRows) {
      const question = await tx.question.create({
        data: {
          ...toQuestionPersistenceData(row),
          createdById: actor.userId,
        },
        include: { _count: { select: { examQuestions: true } } },
      });
      items.push(question);
    }
    return items;
  });

  await writeAudit({
    actorId: actor.userId,
    action: "QUESTIONS_BULK_IMPORTED",
    entityType: "Question",
    entityId: actor.userId,
    details: { format: input.format, count: created.length },
  });

  return NextResponse.json(
    {
      dryRun: false,
      createdCount: created.length,
      questions: created.map(toQuestionDto),
    },
    { status: 201 },
  );
});
