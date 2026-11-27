import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordSchema } from "@/lib/validation";

const { mockDb, mockHash, mockVerify, mockCreateSession, mockWriteAudit, mockAssertRateLimit } =
  vi.hoisted(() => ({
    mockDb: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
    mockHash: vi.fn(),
    mockVerify: vi.fn(),
    mockCreateSession: vi.fn(),
    mockWriteAudit: vi.fn(),
    mockAssertRateLimit: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth", () => ({
  hashPassword: mockHash,
  verifyPassword: mockVerify,
  createSessionForUser: mockCreateSession,
}));
vi.mock("@/lib/audit", () => ({ writeAudit: mockWriteAudit }));
vi.mock("@/lib/rate-limit", () => ({ assertRateLimit: mockAssertRateLimit }));

import { changeOwnPassword } from "@/lib/password-change";

const candidateSession = {
  userId: "user-cand-1",
  email: "candidate@aegisexam.local",
  name: "Candidate One",
  role: Role.CANDIDATE,
  tokenVersion: 2,
  isActive: true as const,
};

describe("self-service change password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects weak or identical new passwords in ChangePasswordSchema", () => {
    expect(
      ChangePasswordSchema.safeParse({
        currentPassword: "OldPassword@123",
        newPassword: "OldPassword@123",
      }).success,
    ).toBe(false);

    expect(
      ChangePasswordSchema.safeParse({
        currentPassword: "OldPassword@123",
        newPassword: "weak",
      }).success,
    ).toBe(false);

    expect(
      ChangePasswordSchema.safeParse({
        currentPassword: "OldPassword@123",
        newPassword: "NewStrongPassword!99",
      }).success,
    ).toBe(true);
  });

  it("rejects incorrect current password and records failure audit without updating hash", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: candidateSession.userId,
      passwordHash: "stored-hash",
      isActive: true,
    });
    mockVerify.mockResolvedValue(false);

    await expect(
      changeOwnPassword(
        candidateSession,
        { currentPassword: "WrongPassword!1", newPassword: "NewStrongPassword!99" },
        "127.0.0.1",
      ),
    ).rejects.toThrow("Current password is incorrect");

    expect(mockDb.user.update).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: candidateSession.userId,
        action: "PASSWORD_CHANGE_FAILED",
      }),
    );
  });

  it("rotates hash, increments tokenVersion, re-issues cookie, and writes PASSWORD_CHANGED audit", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: candidateSession.userId,
      passwordHash: "stored-hash",
      isActive: true,
    });
    mockVerify.mockResolvedValue(true);
    mockHash.mockResolvedValue("new-bcrypt-hash");
    const updatedUser = {
      id: candidateSession.userId,
      email: candidateSession.email,
      name: candidateSession.name,
      role: Role.CANDIDATE,
      tokenVersion: 3,
    };
    mockDb.user.update.mockResolvedValue(updatedUser);

    await changeOwnPassword(
      candidateSession,
      { currentPassword: "OldPassword@123", newPassword: "NewStrongPassword!99" },
      "127.0.0.1",
    );

    expect(mockAssertRateLimit).toHaveBeenCalledWith(
      `change-password:${candidateSession.userId}`,
      expect.objectContaining({ maxAttempts: 5 }),
    );
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: candidateSession.userId },
      data: { passwordHash: "new-bcrypt-hash", tokenVersion: { increment: 1 } },
      select: { id: true, email: true, name: true, role: true, tokenVersion: true },
    });
    expect(mockCreateSession).toHaveBeenCalledWith(updatedUser);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: candidateSession.userId,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: candidateSession.userId,
      }),
    );
  });
});
