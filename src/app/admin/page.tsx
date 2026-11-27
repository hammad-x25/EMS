import Link from "next/link";
import { Activity, ArrowRight, ClipboardList, ScrollText, UserCheck, Users } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { enrollments: true, attempts: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Platform operations</p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-3xl">
            Administrator overview
          </h1>
          <p className="muted mt-1 text-sm">Read-only operational posture across accounts and active examinations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href="/admin/users">
            <Users size={16} /> Manage users
          </Link>
          <Link className="btn-secondary" href="/admin/audit">
            <ScrollText size={16} /> Audit trail
          </Link>
        </div>
      </header>

      <section aria-label="Platform totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="All registered accounts" icon={Users} label="Users" value={users} />
        <StatCard detail="Permitted to sign in" icon={UserCheck} label="Active users" value={activeUsers} />
        <StatCard detail="Across every examiner" icon={ClipboardList} label="Examinations" value={exams} />
        <StatCard detail="Sandbox attempts excluded" icon={Activity} label="Real attempts" value={attempts} />
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">Recent examination activity</h2>
            <p className="muted mt-0.5 text-xs">Examiners retain ownership over assessment mutations.</p>
          </div>
          <Link className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline" href="/admin/health">
            Check system health <ArrowRight size={14} />
          </Link>
        </div>

        {recentExams.length === 0 ? (
          <EmptyState
            description="No examinations have been authored by examiners yet."
            icon={ClipboardList}
            title="No examinations created"
          />
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-surface-subtle)] text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                  <tr>
                    <th className="p-4">Exam</th>
                    <th className="p-4">Examiner</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Enrollment</th>
                    <th className="p-4 text-right">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExams.map((exam) => (
                    <tr className="border-t border-[var(--border-subtle)]" key={exam.id}>
                      <td className="p-4 font-semibold text-[var(--text-primary)]">{exam.title}</td>
                      <td className="p-4 text-[var(--text-secondary)]">{exam.createdBy.name}</td>
                      <td className="p-4">
                        <StatusBadge status={exam.status} />
                      </td>
                      <td className="font-mono-tabular p-4 text-right">{exam._count.enrollments}</td>
                      <td className="font-mono-tabular p-4 text-right">{exam._count.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-[var(--border-subtle)] md:hidden">
              {recentExams.map((exam) => (
                <div className="space-y-2 p-4" key={exam.id}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-[var(--text-primary)]">{exam.title}</p>
                    <StatusBadge status={exam.status} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">Examiner: {exam.createdBy.name}</p>
                  <p className="font-mono-tabular text-xs text-[var(--text-muted)]">
                    {exam._count.enrollments} enrolled · {exam._count.attempts} attempts
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
