import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { ExamWorkspace } from "@/components/exam/ExamWorkspace";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ExaminerSandboxPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.EXAMINER) redirect("/");
  const { id } = await params;
  return <ExamWorkspace examId={id} mode="sandbox" />;
}
