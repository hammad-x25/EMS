import { ScrollText } from "lucide-react";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await db.auditLog.findMany({ take: 100, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true, email: true } } } });
  return (
    <div className="space-y-8">
      <header><p className="eyebrow">Accountability</p><h1 className="mt-2 text-3xl font-black">Platform audit trail</h1><p className="muted mt-2">Recent authentication and account-administration events.</p></header>
      <section className="card overflow-hidden">
        {logs.length === 0 ? <div className="p-10 text-center"><ScrollText className="mx-auto text-slate-300" size={34} /><p className="mt-3 font-bold">No audit events recorded</p><p className="muted mt-1 text-sm">Events appear after sign-ins and account changes.</p></div> : (
          <div className="desktop-table"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Time</th><th className="p-4">Actor</th><th className="p-4">Action</th><th className="p-4">Target</th></tr></thead><tbody>{logs.map((log) => <tr className="border-t border-slate-100" key={log.id}><td className="whitespace-nowrap p-4 text-slate-500">{log.createdAt.toLocaleString()}</td><td className="p-4"><p className="font-bold">{log.actor.name}</p><p className="text-xs text-slate-500">{log.actor.email}</p></td><td className="p-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{log.action.replaceAll("_", " ")}</span></td><td className="p-4 text-slate-600">{log.entityType} · {log.entityId}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
