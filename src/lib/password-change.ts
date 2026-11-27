import { writeAudit } from "@/lib/audit";
import {
  createSessionForUser,
  hashPassword,
  verifyPassword,
  type SessionUser,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { BadRequestError, ForbiddenError } from "@/lib/errors";
import { assertRateLimit } from "@/lib/rate-limit";
import type { ChangePasswordInput } from "@/lib/validation";

const CHANGE_PASSWORD_MAX_ATTEMPTS = 5;
const CHANGE_PASSWORD_WINDOW_MS = 15 * 60 * 1000;

/**
 * Verifies current credentials, enforces password policy, rotates hash + tokenVersion,
 * re-issues the caller's active cookie, and logs the action in AuditLog.
 */
export async function changeOwnPassword(
  session: SessionUser,
  input: ChangePasswordInput,
  ip: string,
): Promise<void> {
  assertRateLimit(`change-password:${session.userId}`, {
    maxAttempts: CHANGE_PASSWORD_MAX_ATTEMPTS,
    windowMs: CHANGE_PASSWORD_WINDOW_MS,
    message: "Too many password change attempts. Try again later.",
  });

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true, isActive: true },
  });

  if (!user?.isActive) {
    throw new ForbiddenError("This account has been deactivated");
  }

  const matches = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!matches) {
    await writeAudit({
      actorId: session.userId,
      action: "PASSWORD_CHANGE_FAILED",
      entityType: "User",
      entityId: session.userId,
      details: { ip },
    });
    throw new BadRequestError("Current password is incorrect", "INVALID_CURRENT_PASSWORD", {
      fieldErrors: { currentPassword: ["Current password is incorrect"] },
    });
  }

  const updated = await db.user.update({
    where: { id: session.userId },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      tokenVersion: { increment: 1 },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      tokenVersion: true,
    },
  });

  await createSessionForUser(updated);
  await writeAudit({
    actorId: session.userId,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: session.userId,
    details: { ip },
  });
}
