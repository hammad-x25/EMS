import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";

export default async function ExaminerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.EXAMINER) redirect(roleHome(session.role));
  return <AppShell session={session}>{children}</AppShell>;
}
