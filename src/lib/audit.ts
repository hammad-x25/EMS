import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function writeAudit(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Prisma.InputJsonValue;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      detailsJson: input.details,
    },
  });
}
