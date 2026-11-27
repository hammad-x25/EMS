import { Role } from "@prisma/client";
import { Activity, BookOpenCheck, ClipboardList, LayoutDashboard, ScrollText, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import type { SessionUser } from "@/lib/auth";

const navigation = {
  ADMIN: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users & roles", icon: Users },
    { href: "/admin/audit", label: "Audit trail", icon: ScrollText },
    { href: "/admin/health", label: "System health", icon: Activity },
  ],
  EXAMINER: [
    { href: "/examiner", label: "Examiner home", icon: LayoutDashboard },
    { href: "/examiner/questions", label: "Question bank", icon: BookOpenCheck },
    { href: "/examiner/exams", label: "Examinations", icon: ClipboardList },
  ],
  CANDIDATE: [
    { href: "/candidate", label: "Candidate home", icon: LayoutDashboard },
    { href: "/candidate/dashboard", label: "My examinations", icon: BookOpenCheck },
  ],
} satisfies Record<Role, Array<{ href: string; label: string; icon: typeof LayoutDashboard }>>;

export function AppShell({ session, children }: { session: SessionUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="flex flex-col bg-slate-950 p-5 text-slate-100 md:min-h-screen">
        <Link className="flex items-center gap-3 px-2 py-3 text-lg font-black" href="/"><ShieldCheck className="text-indigo-400" /> AegisExam</Link>
        <div className="mt-7 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="truncate font-bold">{session.name}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{session.email}</p>
          <span className="mt-3 inline-block rounded-full bg-indigo-500/20 px-2 py-1 text-[11px] font-extrabold tracking-wider text-indigo-300">{session.role}</span>
        </div>
        <nav className="mt-6 flex-1 space-y-1" aria-label={`${session.role.toLowerCase()} navigation`}>
          {navigation[session.role].map(({ href, label, icon: Icon }) => (
            <Link className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-slate-300 hover:bg-slate-800 hover:text-white" href={href} key={href}>
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </aside>
      <main className="min-w-0 p-5 md:p-8 lg:p-10">{children}</main>
    </div>
  );
}
