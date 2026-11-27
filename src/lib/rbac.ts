import { Role } from "@prisma/client";
import { getSession, SessionUser } from "@/lib/auth";
import { AuthError, ForbiddenError } from "@/lib/errors";

export function assertAllowedRole<T extends { role: Role; isActive: boolean }>(user: T, allowedRoles?: Role[]): T {
  if (!user.isActive) throw new AuthError("This account has been deactivated");
  if (allowedRoles && !allowedRoles.includes(user.role)) throw new ForbiddenError();
  return user;
}

export async function requireAuth(allowedRoles?: Role[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError();
  return assertAllowedRole(session, allowedRoles);
}

export function roleHome(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "EXAMINER") return "/examiner";
  return "/candidate";
}
