import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { QuestionBankManager } from "@/components/examiner/QuestionBankManager";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { toQuestionDto } from "@/lib/question-bank";

export const dynamic = "force-dynamic";

export default async function ExaminerQuestionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.EXAMINER) redirect("/");

  const questions = await db.question.findMany({
    where: { createdById: session.userId },
    orderBy: [{ updatedAt: "desc" }, { topic: "asc" }],
    include: { _count: { select: { examQuestions: true } } },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Question bank</p>
        <h1 className="mt-2 text-3xl font-black">Reusable Question Bank</h1>
        <p className="muted mt-1">
          Organize single-choice, multiple-select, and written questions by topic and difficulty, or bulk import via CSV/JSON.
        </p>
      </header>
      <QuestionBankManager initialQuestions={questions.map(toQuestionDto)} />
    </div>
  );
}
