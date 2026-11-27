import { CheckCircle2, Database, Server } from "lucide-react";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const startedAt = Date.now();
  await db.$queryRaw`SELECT 1`;
  const latency = Date.now() - startedAt;
  return (
    <div className="space-y-8">
      <header><p className="eyebrow">Operational visibility</p><h1 className="mt-2 text-3xl font-black">System health</h1><p className="muted mt-2">Live server-side checks, not client simulations.</p></header>
      <section className="grid gap-4 md:grid-cols-2">
        {[{ label: "Application server", detail: "Next.js route and rendering layer", icon: Server }, { label: "PostgreSQL database", detail: `Connected · ${latency} ms query latency`, icon: Database }].map(({ label, detail, icon: Icon }) => (
          <article className="card flex items-center gap-4 p-6" key={label}><span className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Icon /></span><div className="flex-1"><h2 className="font-black">{label}</h2><p className="muted mt-1 text-sm">{detail}</p></div><CheckCircle2 className="text-emerald-600" aria-label="Healthy" /></article>
        ))}
      </section>
    </div>
  );
}
