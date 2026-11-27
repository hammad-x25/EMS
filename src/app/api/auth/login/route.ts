import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createSessionForUser, verifyPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AuthError, ForbiddenError } from "@/lib/errors";
import { assertLoginRateLimit, resetLoginRateLimit } from "@/lib/rate-limit";
import { toUserDto } from "@/lib/user-dto";
import { LoginSchema } from "@/lib/validation";

export const POST = apiHandler(async (request) => {
  const input = LoginSchema.parse(await request.json());
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rateLimitKey = `${ip}:${input.email}`;
  assertLoginRateLimit(rateLimitKey);

  const user = await db.user.findUnique({ where: { email: input.email } });
  const validPassword = user ? await verifyPassword(input.password, user.passwordHash) : false;
  if (!user || !validPassword) {
    if (user) {
      await writeAudit({
        actorId: user.id,
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: user.id,
        details: { ip },
      });
    }
    throw new AuthError("Invalid email or password");
  }
  if (!user.isActive) {
    await writeAudit({ actorId: user.id, action: "LOGIN_BLOCKED_INACTIVE", entityType: "User", entityId: user.id, details: { ip } });
    throw new ForbiddenError("This account has been deactivated");
  }

  await createSessionForUser(user);
  resetLoginRateLimit(rateLimitKey);
  await writeAudit({ actorId: user.id, action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id, details: { ip } });
  return NextResponse.json({ user: toUserDto(user) });
});
