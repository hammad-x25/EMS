import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AttemptStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";

export interface VerificationPayload {
  code: string;
  attemptId: string;
  totalScore: number;
  maxScore: number;
  version: number;
  issuedAt: string;
}

export type VerificationStatus = "VALID" | "REVOKED_SUPERSEDED" | "NOT_FOUND";

function reportSecret(): string {
  const value = process.env.REPORT_HMAC_SECRET;
  if (!value || value.length < 24) throw new Error("REPORT_HMAC_SECRET must contain at least 24 characters");
  return value;
}

function canonical(payload: VerificationPayload): string {
  return JSON.stringify([
    payload.code,
    payload.attemptId,
    payload.totalScore,
    payload.maxScore,
    payload.version,
    payload.issuedAt,
  ]);
}

export function signVerificationPayload(payload: VerificationPayload, secret = reportSecret()): string {
  return createHmac("sha256", secret).update(canonical(payload)).digest("hex");
}

export function verifyVerificationSignature(
  payload: VerificationPayload,
  signature: string,
  secret = reportSecret(),
): boolean {
  const expected = Buffer.from(signVerificationPayload(payload, secret), "hex");
  const supplied = Buffer.from(signature, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function newCode(): string {
  const token = randomBytes(4).toString("hex").toUpperCase();
  return `AEG-${token.slice(0, 4)}-${token.slice(4, 8)}`;
}

export function maskCandidateName(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => `${part[0]}${"*".repeat(Math.max(2, part.length - 1))}`).join(" ");
}

export function maskCandidateIdentifier(identifier: string | null): string {
  if (!identifier) return "Not provided";
  if (identifier.length <= 4) return `${identifier[0]}***`;
  return `${identifier.slice(0, 3)}${"*".repeat(Math.max(3, identifier.length - 6))}${identifier.slice(-3)}`;
}

export async function getOrCreateVerification(attemptId: string) {
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: { verifications: { orderBy: { version: "desc" } } },
  });
  if (!attempt) throw new NotFoundError("Attempt not found");
  if (attempt.isSandbox || attempt.status !== AttemptStatus.PUBLISHED || attempt.totalScore === null) {
    throw new ConflictError("A report can only be issued for published real results", "REPORT_NOT_AVAILABLE");
  }
  const latest = attempt.verifications[0];
  if (latest) {
    const payload: VerificationPayload = {
      code: latest.code,
      attemptId,
      totalScore: attempt.totalScore,
      maxScore: attempt.maxScore,
      version: latest.version,
      issuedAt: latest.issuedAt.toISOString(),
    };
    if (verifyVerificationSignature(payload, latest.signatureHash)) return { record: latest, payload };
  }

  const version = (latest?.version ?? 0) + 1;
  const issuedAt = new Date();
  for (let retry = 0; retry < 5; retry += 1) {
    const code = newCode();
    const payload: VerificationPayload = {
      code,
      attemptId,
      totalScore: attempt.totalScore,
      maxScore: attempt.maxScore,
      version,
      issuedAt: issuedAt.toISOString(),
    };
    try {
      const record = await db.reportVerification.create({
        data: { attemptId, code, version, issuedAt, signatureHash: signVerificationPayload(payload) },
      });
      return { record, payload };
    } catch (error: unknown) {
      if (retry === 4) throw error;
    }
  }
  throw new Error("Unable to allocate report verification code");
}

export async function verifyPublicReport(code: string): Promise<{
  status: VerificationStatus;
  report?: {
    code: string;
    candidateName: string;
    candidateIdentifier: string;
    examTitle: string;
    score: number;
    maxScore: number;
    issuedAt: string;
    version: number;
  };
}> {
  const record = await db.reportVerification.findUnique({
    where: { code },
    include: {
      attempt: {
        include: {
          user: true,
          exam: true,
          verifications: { orderBy: { version: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!record || record.attempt.totalScore === null) return { status: "NOT_FOUND" };
  const payload: VerificationPayload = {
    code: record.code,
    attemptId: record.attemptId,
    totalScore: record.attempt.totalScore,
    maxScore: record.attempt.maxScore,
    version: record.version,
    issuedAt: record.issuedAt.toISOString(),
  };
  const latestVersion = record.attempt.verifications[0]?.version ?? record.version;
  const valid =
    latestVersion === record.version &&
    record.attempt.status === AttemptStatus.PUBLISHED &&
    record.attempt.exam.resultsPublishedAt !== null &&
    verifyVerificationSignature(payload, record.signatureHash);
  return {
    status: valid ? "VALID" : "REVOKED_SUPERSEDED",
    report: {
      code: record.code,
      candidateName: maskCandidateName(record.attempt.user.name),
      candidateIdentifier: maskCandidateIdentifier(record.attempt.user.studentId),
      examTitle: record.attempt.exam.title,
      score: record.attempt.totalScore,
      maxScore: record.attempt.maxScore,
      issuedAt: record.issuedAt.toISOString(),
      version: record.version,
    },
  };
}
