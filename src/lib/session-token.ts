import type { Role } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "aegis_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
const ROLES: Role[] = ["ADMIN", "EXAMINER", "CANDIDATE"];

export type SessionClaims = {
  userId: string;
  email: string;
  name: string;
  role: Role;
};

function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email, name: claims.name, role: claims.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(authSecret());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"] });
    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      !ROLES.includes(payload.role as Role)
    ) {
      return null;
    }
    return { userId: payload.sub, email: payload.email, name: payload.name, role: payload.role as Role };
  } catch {
    return null;
  }
}
