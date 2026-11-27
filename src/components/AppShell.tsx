import { Role } from "@prisma/client";
import type { ReactNode } from "react";
import { AppShellNav, type NavItem } from "@/components/AppShellNav";
import type { SessionUser } from "@/lib/auth";

const navigation: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: "/admin", label: "Overview", icon: "dashboard", exact: true },
    { href: "/admin/users", label: "Users & roles", icon: "users" },
    { href: "/admin/audit", label: "Audit trail", icon: "audit" },
    { href: "/admin/health", label: "System health", icon: "health" },
  ],
  EXAMINER: [
    { href: "/examiner", label: "Examiner home", icon: "dashboard", exact: true },
    { href: "/examiner/questions", label: "Question bank", icon: "questions" },
    { href: "/examiner/exams", label: "Examinations", icon: "exams" },
    { href: "/examiner/disputes", label: "Disputes", icon: "disputes" },
  ],
  CANDIDATE: [
    { href: "/candidate", label: "Candidate home", icon: "dashboard", exact: true },
    { href: "/candidate/dashboard", label: "My examinations", icon: "questions" },
  ],
};

export function AppShell({ session, children }: { session: SessionUser; children: ReactNode }) {
  return (
    <AppShellNav items={navigation[session.role]} session={session}>
      {children}
    </AppShellNav>
  );
}
