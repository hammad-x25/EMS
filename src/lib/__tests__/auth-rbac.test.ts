import { Role } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { AuthError, ForbiddenError } from "@/lib/errors";
import { assertAllowedRole, roleHome } from "@/lib/rbac";
import { signSessionToken, verifySessionToken } from "@/lib/session-token";
import { toUserDto } from "@/lib/user-dto";
import { PasswordSchema } from "@/lib/validation";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-auth-secret-with-more-than-thirty-two-characters";
});

describe("password and session security", () => {
  it("hashes passwords and verifies only the original value", async () => {
    const passwordHash = await hashPassword("ValidPass@123");
    expect(passwordHash).not.toContain("ValidPass@123");
    await expect(verifyPassword("ValidPass@123", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("WrongPass@123", passwordHash)).resolves.toBe(false);
  });

  it("signs an expiring token with the expected identity claims", async () => {
    const token = await signSessionToken({
      userId: "user-1",
      email: "admin@example.test",
      name: "Admin",
      role: Role.ADMIN,
      tokenVersion: 2,
    });
    await expect(verifySessionToken(token)).resolves.toEqual({
      userId: "user-1",
      email: "admin@example.test",
      name: "Admin",
      role: Role.ADMIN,
      tokenVersion: 2,
    });
    await expect(verifySessionToken(`${token}tampered`)).resolves.toBeNull();
  });

  it("enforces at least 12 characters with mixed complexity on PasswordSchema", () => {
    expect(PasswordSchema.safeParse("Short1!a").success).toBe(false);
    expect(PasswordSchema.safeParse("TenChar1!a").success).toBe(false);
    expect(PasswordSchema.safeParse("StrongPass@123").success).toBe(true);
  });
});

describe("backend role authorization", () => {
  const activeCandidate = { userId: "candidate-1", role: Role.CANDIDATE, isActive: true as const };

  it("maps missing authentication to a 401 error contract", () => {
    const error = new AuthError();
    expect(error.status).toBe(401);
    expect(error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a candidate from an administrator-only operation with 403", () => {
    expect(() => assertAllowedRole(activeCandidate, [Role.ADMIN])).toThrowError(ForbiddenError);
    try {
      assertAllowedRole(activeCandidate, [Role.ADMIN]);
    } catch (error: unknown) {
      expect(error).toMatchObject({ status: 403, code: "FORBIDDEN" });
    }
  });

  it("rejects deactivated users even when their role is allowed", () => {
    expect(() => assertAllowedRole({ ...activeCandidate, isActive: false }, [Role.CANDIDATE])).toThrowError(AuthError);
  });

  it("routes each fixed role to its own workspace", () => {
    expect(roleHome(Role.ADMIN)).toBe("/admin");
    expect(roleHome(Role.EXAMINER)).toBe("/examiner");
    expect(roleHome(Role.CANDIDATE)).toBe("/candidate");
  });
});

describe("safe user serialization", () => {
  it("never exposes passwordHash", () => {
    const source = {
      id: "user-1",
      email: "candidate@example.test",
      name: "Candidate",
      passwordHash: "must-not-leak",
      role: Role.CANDIDATE,
      studentId: "ST-1",
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const dto = toUserDto(source);
    expect(dto).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(dto)).not.toContain("must-not-leak");
  });
});
