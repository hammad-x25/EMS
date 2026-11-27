import { AttemptStatus, Role } from "@prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { publishExamEvent } from "@/lib/event-bus";

export const AnnouncementSchema = z.object({
  message: z.string().trim().min(3).max(500),
});

export const TimeExtensionSchema = z.object({
  minutes: z.number().int().min(1).max(120),
  justification: z.string().trim().min(10).max(1_000),
});

export interface MonitorAttemptDto {
  id: string;
  candidate: { id: string; name: string; studentId: string | null };
  status: AttemptStatus;
  answered: number;
  totalQuestions: number;
  connection: "ONLINE" | "GAP" | "FINALIZED";
  gapSeconds: number;
  hardDeadlineAt: string;
  effectiveDeadlineAt: string;
  timeExtensionMinutes: number;
  incidentCount: number;
  events: Array<{ id: string; eventType: string; severity: string; occurredAt: string; metadata: unknown }>;
}

export interface MonitorSnapshotDto {
  examId: string;
  title: string;
  serverNow: string;
  attempts: MonitorAttemptDto[];
  announcements: Array<{ id: string; message: string; createdAt: string }>;
}

function effectiveDeadline(hardDeadlineAt: Date, extensionMinutes: number): Date {
  return new Date(hardDeadlineAt.getTime() + extensionMinutes * 60_000);
}

function answered(snapshot: { type: string; answer: { selectedIdsJson: unknown; writtenText: string | null } | null }): boolean {
  if (!snapshot.answer) return false;
  if (snapshot.type === "WRITTEN") return Boolean(snapshot.answer.writtenText?.trim());
  return Array.isArray(snapshot.answer.selectedIdsJson) && snapshot.answer.selectedIdsJson.length > 0;
}

export async function getMonitorSnapshot(examId: string, now = new Date()): Promise<MonitorSnapshotDto> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      announcements: { orderBy: { createdAt: "desc" }, take: 20 },
      attempts: {
        where: { isSandbox: false },
        orderBy: { startedAt: "desc" },
        include: {
          user: { select: { id: true, name: true, studentId: true } },
          snapshots: { include: { answer: true } },
          events: { orderBy: { occurredAt: "desc" }, take: 50 },
        },
      },
    },
  });
  if (!exam) throw new NotFoundError("Examination not found");

  for (const attempt of exam.attempts) {
    const gapMs = now.getTime() - attempt.lastHeartbeatAt.getTime();
    const alreadyLogged = attempt.events.some(
      (event) => event.eventType === "HEARTBEAT_LOST" && event.occurredAt >= attempt.lastHeartbeatAt,
    );
    if (attempt.status === AttemptStatus.IN_PROGRESS && gapMs > 15_000 && !alreadyLogged) {
      const event = await db.attemptEvent.create({
        data: {
          attemptId: attempt.id,
          eventType: "HEARTBEAT_LOST",
          severity: "NOTICE",
          metadata: { gapSeconds: Math.round(gapMs / 1000) },
          occurredAt: now,
        },
      });
      attempt.events.unshift(event);
      publishExamEvent({
        type: "CONNECTIVITY_CHANGE",
        examId,
        attemptId: attempt.id,
        userId: attempt.userId,
        payload: { connection: "GAP", gapSeconds: Math.round(gapMs / 1000) },
      });
    }
  }

  return {
    examId,
    title: exam.title,
    serverNow: now.toISOString(),
    attempts: exam.attempts.map((attempt) => {
      const gapSeconds = Math.max(0, Math.round((now.getTime() - attempt.lastHeartbeatAt.getTime()) / 1000));
      return {
        id: attempt.id,
        candidate: attempt.user,
        status: attempt.status,
        answered: attempt.snapshots.filter(answered).length,
        totalQuestions: attempt.snapshots.length,
        connection: attempt.status !== AttemptStatus.IN_PROGRESS ? "FINALIZED" : gapSeconds <= 15 ? "ONLINE" : "GAP",
        gapSeconds,
        hardDeadlineAt: attempt.hardDeadlineAt.toISOString(),
        effectiveDeadlineAt: effectiveDeadline(attempt.hardDeadlineAt, attempt.timeExtensionMinutes).toISOString(),
        timeExtensionMinutes: attempt.timeExtensionMinutes,
        incidentCount: attempt.events.filter((event) => event.severity === "NOTICE").length,
        events: attempt.events.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          severity: event.severity,
          occurredAt: event.occurredAt.toISOString(),
          metadata: event.metadata,
        })),
      };
    }),
    announcements: exam.announcements.slice().reverse().map((announcement) => ({
      id: announcement.id,
      message: announcement.message,
      createdAt: announcement.createdAt.toISOString(),
    })),
  };
}

export async function createAnnouncement(actor: SessionUser, examId: string, message: string) {
  if (actor.role !== Role.EXAMINER) throw new ForbiddenError();
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { createdById: true } });
  if (!exam) throw new NotFoundError("Examination not found");
  if (exam.createdById !== actor.userId) throw new ForbiddenError("Only the owning examiner can announce");
  const announcement = await db.announcement.create({ data: { examId, message, createdBy: actor.userId } });
  publishExamEvent({ type: "ANNOUNCEMENT", examId, payload: { id: announcement.id, message } });
  return { id: announcement.id, message, createdAt: announcement.createdAt.toISOString() };
}

export async function grantTimeExtension(
  actor: SessionUser,
  attemptId: string,
  input: z.infer<typeof TimeExtensionSchema>,
) {
  if (actor.role !== Role.EXAMINER) throw new ForbiddenError();
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: { exam: true, events: { where: { eventType: "HEARTBEAT_LOST" }, take: 1 } },
  });
  if (!attempt) throw new NotFoundError("Attempt not found");
  if (attempt.isSandbox || attempt.exam.createdById !== actor.userId) throw new ForbiddenError();
  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new ConflictError("Only active attempts can receive time extensions", "ATTEMPT_FINALIZED");
  }
  if (attempt.events.length === 0) {
    throw new ConflictError("A verified connectivity-gap event is required", "OUTAGE_NOT_VERIFIED");
  }
  const updated = await db.$transaction(async (tx) => {
    const next = await tx.attempt.update({
      where: { id: attempt.id },
      data: { timeExtensionMinutes: { increment: input.minutes } },
    });
    await tx.attemptEvent.create({
      data: {
        attemptId,
        eventType: "TIME_EXTENDED",
        severity: "INFO",
        metadata: { minutes: input.minutes, justification: input.justification, actorId: actor.userId },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "ATTEMPT_TIME_EXTENDED",
        entityType: "Attempt",
        entityId: attempt.id,
        detailsJson: { minutes: input.minutes, justification: input.justification },
      },
    });
    return next;
  });
  const effectiveDeadlineAt = effectiveDeadline(updated.hardDeadlineAt, updated.timeExtensionMinutes);
  publishExamEvent({
    type: "TIME_EXTENDED",
    examId: updated.examId,
    attemptId: updated.id,
    userId: updated.userId,
    payload: { minutes: input.minutes, totalExtensionMinutes: updated.timeExtensionMinutes, effectiveDeadlineAt: effectiveDeadlineAt.toISOString() },
  });
  return { timeExtensionMinutes: updated.timeExtensionMinutes, effectiveDeadlineAt: effectiveDeadlineAt.toISOString() };
}
