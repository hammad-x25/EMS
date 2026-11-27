import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createSessionForUser, verifyPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AuthError, ForbiddenError } from "@/lib/errors";
import {
  assertLoginLimits,
  extractClientIp,
  resetLoginLimits,
} from "@/lib/rate-limit";
import { toUserDto } from "@/lib/user-dto";
import { LoginSchema } from "@/lib/validation";

// Pre-computed valid bcrypt cost-12 hash so nonexistent-email attempts incur equal hashing time.
const DUMMY_BCRYPT_HASH = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8l8xN4zN8X8F6x2Y0q3n5aP7lJ9K1a";

export const POST = apiHandler(async (request) => {
  const input = LoginSchema.parse(await request.json());
  const ip = extractClientIp(request.headers);
  assertLoginLimits(input.email, ip);

  const user = await db.user.findUnique({ where: { email: input.email } });
  const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_BCRYPT_HASH);

  if (!user || !passwordOk) {
    if (user) {
      await writeAudit({
        actorId: user.id,
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: user.id,
        details: { ip },
      });
    } else {
      console.warn("LOGIN_FAILED_UNKNOWN_ACCOUNT", { ip, at: new Date().toISOString() });
    }
    throw new AuthError("Invalid email or password");
  }

  if (!user.isActive) {
    await writeAudit({
      actorId: user.id,
      action: "LOGIN_BLOCKED_INACTIVE",
      entityType: "User",
      entityId: user.id,
      details: { ip },
    });
    throw new ForbiddenError("This account has been deactivated");
  }

  await createSessionForUser(user);
  resetLoginLimits(input.email);
  await writeAudit({
    actorId: user.id,
    action: "LOGIN_SUCCESS",
    entityType: "User",
    entityId: user.id,
    details: { ip },
  });
  return NextResponse.json({ user: toUserDto(user) });
});
