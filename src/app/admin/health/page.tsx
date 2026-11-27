import { CheckCircle2, Database, Server } from "lucide-react";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const startedAt = Date.now();
  await db.$queryRaw`SELECT 1`;
  const latency = Date.now() - startedAt;

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Operational visibility</p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-3xl">
          System health
        </h1>
        <p className="muted mt-1 text-sm">Live server-side database connectivity checks.</p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {[
          { label: "Application server", detail: "Next.js route and rendering layer", icon: Server },
          { label: "PostgreSQL database", detail: `Connected · ${latency} ms query latency`, icon: Database },
        ].map(({ label, detail, icon: Icon }) => (
          <article className="card flex items-center gap-4 p-5" key={label}>
            <span className="rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3 text-[var(--status-success-text)]">
              <Icon aria-hidden="true" size={20} />
            </span>
            <div className="flex-1">
              <h2 className="text-base font-bold text-[var(--text-primary)]">{label}</h2>
              <p className="font-mono-tabular muted mt-1 text-sm">{detail}</p>
            </div>
            <CheckCircle2 aria-label="Healthy" className="text-[var(--status-success-text)]" />
          </article>
        ))}
      </section>
    </div>
  );
}
