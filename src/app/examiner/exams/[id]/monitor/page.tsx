import { Role } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { MonitorDashboard } from "@/components/examiner/MonitorDashboard";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMonitorSnapshot } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export default async function MonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.EXAMINER) redirect("/");
  const { id } = await params;
  const exam = await db.exam.findUnique({ where: { id }, select: { createdById: true } });
  if (!exam || exam.createdById !== session.userId) notFound();
  return <MonitorDashboard examId={id} initialSnapshot={await getMonitorSnapshot(id)} />;
}
