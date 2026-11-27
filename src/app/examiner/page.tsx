import { BookOpenCheck, ClipboardList } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ExaminerHomePage() {
  const session = await getSession();
  const [questions, exams] = await Promise.all([
    db.question.count({ where: { createdById: session?.userId ?? "" } }),
    db.exam.count({ where: { createdById: session?.userId ?? "" } }),
  ]);
  return <div className="space-y-8"><header><p className="eyebrow">Examiner workspace</p><h1 className="mt-2 text-3xl font-black">Welcome, {session?.name}</h1><p className="muted mt-2">Your account is active and restricted to examiner-authorized records.</p></header><section className="grid gap-4 md:grid-cols-2"><article className="card p-6"><BookOpenCheck className="text-indigo-600" /><p className="mt-4 text-3xl font-black">{questions}</p><p className="muted mt-1">Reusable questions owned by you</p></article><article className="card p-6"><ClipboardList className="text-indigo-600" /><p className="mt-4 text-3xl font-black">{exams}</p><p className="muted mt-1">Examinations owned by you</p></article></section></div>;
}
