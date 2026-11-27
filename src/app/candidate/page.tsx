import { BookOpenCheck, CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CandidateHomePage() {
  const session = await getSession();
  const enrollments = await db.enrollment.count({ where: { userId: session?.userId ?? "" } });
  return <div className="space-y-8"><header><p className="eyebrow">Candidate portal</p><h1 className="mt-2 text-3xl font-black">Welcome, {session?.name}</h1><p className="muted mt-2">Your private workspace only exposes examinations assigned to your account.</p></header><section className="card flex items-center gap-5 p-6"><span className="rounded-2xl bg-indigo-50 p-4 text-indigo-600"><BookOpenCheck /></span><div><p className="text-3xl font-black">{enrollments}</p><p className="muted">Assigned examinations</p></div><CheckCircle2 className="ml-auto text-emerald-600" aria-label="Account ready" /></section></div>;
}
