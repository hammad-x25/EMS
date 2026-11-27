import { Activity, ClipboardList, UserCheck, Users } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [users, activeUsers, exams, attempts, recentExams] = await db.$transaction([
    db.user.count(),
    db.user.count({ where: { isActive: true } }),
    db.exam.count(),
    db.attempt.count({ where: { isSandbox: false } }),
    db.exam.findMany({
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: { createdBy: { select: { name: true } }, _count: { select: { enrollments: true, attempts: true } } },
    }),
  ]);
  return (
    <div className="space-y-8">
      <header><p className="eyebrow">Platform operations</p><h1 className="mt-2 text-3xl font-black tracking-tight">Administrator overview</h1><p className="muted mt-2">A read-only platform view with account and assessment activity.</p></header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform totals">
        <StatCard detail="All registered accounts" icon={Users} label="Users" value={users} />
        <StatCard detail="Permitted to sign in" icon={UserCheck} label="Active users" value={activeUsers} />
        <StatCard detail="Across every examiner" icon={ClipboardList} label="Examinations" value={exams} />
        <StatCard detail="Sandbox attempts excluded" icon={Activity} label="Real attempts" value={attempts} />
      </section>
      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 p-5"><h2 className="font-black">Global examination overview</h2><p className="muted mt-1 text-sm">Read-only visibility; examiners retain mutation ownership.</p></div>
        {recentExams.length === 0 ? (
          <div className="p-10 text-center"><ClipboardList className="mx-auto text-slate-300" size={34} /><p className="mt-3 font-bold">No examinations created yet</p><p className="muted mt-1 text-sm">Plan 2 introduces the examiner creation workflow.</p></div>
        ) : (
          <div className="desktop-table"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Exam</th><th className="p-4">Examiner</th><th className="p-4">Status</th><th className="p-4">Enrollment</th><th className="p-4">Attempts</th></tr></thead><tbody>{recentExams.map((exam) => <tr className="border-t border-slate-100" key={exam.id}><td className="p-4 font-bold">{exam.title}</td><td className="p-4">{exam.createdBy.name}</td><td className="p-4">{exam.status}</td><td className="p-4">{exam._count.enrollments}</td><td className="p-4">{exam._count.attempts}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
