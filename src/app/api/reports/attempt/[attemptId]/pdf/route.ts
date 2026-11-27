import { Role } from "@prisma/client";
import { apiHandler } from "@/lib/api-handler";
import { generateCandidateReportPdf } from "@/lib/pdf-reports";
import { requireAuth } from "@/lib/rbac";
import { getResultDetail } from "@/lib/results";
import { getOrCreateVerification } from "@/lib/verification";

type Context = { params: Promise<{ attemptId: string }> };

export const runtime = "nodejs";

export const GET = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.CANDIDATE, Role.EXAMINER, Role.ADMIN]);
  const { attemptId } = await context.params;
  const result = await getResultDetail(actor, attemptId);
  const verification = await getOrCreateVerification(attemptId);
  const topicMap = new Map<string, { earned: number; maximum: number }>();
  for (const question of result.questions) {
    const current = topicMap.get(question.topic) ?? { earned: 0, maximum: 0 };
    current.earned += question.earnedScore;
    current.maximum += question.maxMarks;
    topicMap.set(question.topic, current);
  }
  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN || request.nextUrl.origin;
  const verificationUrl = `${appOrigin}/verify/${verification.record.code}`;
  const pdf = await generateCandidateReportPdf({
    candidateName: result.candidate.name,
    candidateIdentifier: result.candidate.studentId ?? "Not provided",
    examTitle: result.examTitle,
    attemptedAt: new Date(result.startedAt),
    totalScore: result.totalScore,
    maxScore: result.maxScore,
    passingMarks: result.passingMarks,
    verificationCode: verification.record.code,
    verificationUrl,
    version: verification.record.version,
    sections: Array.from(topicMap, ([topic, values]) => ({ topic, ...values })),
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="aegis-score-${attemptId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
