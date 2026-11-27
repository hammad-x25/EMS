import { AuditTrailViewer } from "@/components/AuditTrailViewer";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const INITIAL_LIMIT = 25;

export default async function AuditPage() {
  const [total, logs, distinctActions] = await db.$transaction([
    db.auditLog.count(),
    db.auditLog.findMany({
      take: INITIAL_LIMIT,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
    db.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Accountability</p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-3xl">
          Platform audit trail
        </h1>
        <p className="muted mt-1 text-sm">
          Immutable log of authentication, administration, examination lifecycle, grading, and dispute events.
        </p>
      </header>

      <AuditTrailViewer
        actions={distinctActions.map((item) => item.action)}
        initialLimit={INITIAL_LIMIT}
        initialLogs={logs.map((log) => ({
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          createdAt: log.createdAt.toISOString(),
          actor: log.actor,
        }))}
        initialTotal={total}
      />
    </div>
  );
}
