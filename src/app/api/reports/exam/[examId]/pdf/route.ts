import { Role } from "@prisma/client";
import { getExamAnalytics } from "@/lib/analytics";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { assertExamReadAccess } from "@/lib/exam-lifecycle";
import { generateExamSummaryPdf } from "@/lib/pdf-reports";
import { assertRateLimit } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ examId: string }> };

export const runtime = "nodejs";

export const GET = apiHandler<Context>(async (_request, context) => {
  const actor = await requireAuth([Role.EXAMINER, Role.ADMIN]);
  assertRateLimit(`pdf:exam:${actor.userId}`, { maxAttempts: 30, windowMs: 60_000 });
  const { examId } = await context.params;
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { createdById: true } });
  if (!exam) throw new NotFoundError("Examination not found");
  assertExamReadAccess(actor, exam.createdById);
  const pdf = await generateExamSummaryPdf(await getExamAnalytics(examId));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="aegis-exam-${examId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
