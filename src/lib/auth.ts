import { Role } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  SessionClaims,
  signSessionToken,
  verifySessionToken,
} from "@/lib/session-token";

export type SessionUser = SessionClaims & { isActive: true };

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, 12);
}

export function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return compare(plain, passwordHash);
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const user = await db.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, email: true, name: true, role: true, isActive: true, tokenVersion: true },
  });
  if (!user?.isActive || user.tokenVersion !== claims.tokenVersion) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tokenVersion: user.tokenVersion,
    isActive: true,
  };
}

export async function createSessionForUser(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  tokenVersion: number;
}): Promise<void> {
  const token = await signSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
  await setSessionCookie(token);
}
