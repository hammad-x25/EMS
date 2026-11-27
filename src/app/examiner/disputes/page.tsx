import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { DisputeWorkbench } from "@/components/examiner/DisputeWorkbench";
import { getSession } from "@/lib/auth";
import { listDisputes } from "@/lib/disputes";

export const dynamic = "force-dynamic";

export default async function ExaminerDisputesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.EXAMINER) redirect("/");

  const disputes = await listDisputes(session);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Open Innovation 5.4</p>
        <h1 className="mt-2 text-3xl font-black">Dispute Resolution Queue</h1>
        <p className="muted mt-1">
          Review candidate appeals alongside question snapshots and server incident timelines. Score adjustments automatically re-issue verifiable reports.
        </p>
      </header>
      <DisputeWorkbench initialDisputes={disputes} />
    </div>
  );
}
