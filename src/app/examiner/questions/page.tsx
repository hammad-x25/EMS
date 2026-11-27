import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { QuestionBankManager } from "@/components/examiner/QuestionBankManager";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { toQuestionDto } from "@/lib/question-bank";

export const dynamic = "force-dynamic";

const INITIAL_LIMIT = 20;

export default async function ExaminerQuestionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.EXAMINER) redirect("/");

  const [total, questions, distinctTopics] = await db.$transaction([
    db.question.count({ where: { createdById: session.userId } }),
    db.question.findMany({
      where: { createdById: session.userId },
      orderBy: [{ updatedAt: "desc" }, { topic: "asc" }],
      take: INITIAL_LIMIT,
      include: { _count: { select: { examQuestions: true } } },
    }),
    db.question.findMany({
      where: { createdById: session.userId },
      distinct: ["topic"],
      select: { topic: true },
      orderBy: { topic: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Question bank</p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-3xl">
          Reusable question bank
        </h1>
        <p className="muted mt-1 text-sm">
          Organize single-choice, multiple-select, and written questions by topic and difficulty, or bulk import via CSV/JSON.
        </p>
      </header>
      <QuestionBankManager
        initialLimit={INITIAL_LIMIT}
        initialQuestions={questions.map(toQuestionDto)}
        initialTopics={distinctTopics.map((item) => item.topic)}
        initialTotal={total}
      />
    </div>
  );
}
