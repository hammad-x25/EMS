import { Role } from "@prisma/client";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { examEventBus, type ExamLiveEvent } from "@/lib/event-bus";
import { assertExamReadAccess } from "@/lib/exam-lifecycle";
import { getMonitorSnapshot } from "@/lib/monitoring";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth();
  const { id } = await context.params;
  const exam = await db.exam.findUnique({ where: { id }, select: { createdById: true } });
  if (!exam) throw new NotFoundError("Examination not found");
  if (actor.role === Role.CANDIDATE) {
    const enrollment = await db.enrollment.findUnique({
      where: { examId_userId: { examId: id, userId: actor.userId } },
    });
    if (!enrollment) throw new ForbiddenError("You are not enrolled in this examination");
  } else {
    assertExamReadAccess(actor, exam.createdById);
  }

  const encoder = new TextEncoder();
  let closed = false;
  let cleaned = false;
  let cleanup = () => undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (eventName: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const channel = `exam:${id}`;
      const onEvent = (event: ExamLiveEvent) => {
        if (actor.role === Role.CANDIDATE && event.userId && event.userId !== actor.userId) return;
        send(event.type, event);
      };
      examEventBus.on(channel, onEvent);
      send("CONNECTED", { examId: id, serverNow: new Date().toISOString() });

      const fallback = async () => {
        if (closed) return;
        try {
          if (actor.role === Role.CANDIDATE) {
            const [attempt, announcements] = await Promise.all([
              db.attempt.findFirst({
                where: { examId: id, userId: actor.userId, isSandbox: false },
                select: { id: true, status: true, hardDeadlineAt: true, timeExtensionMinutes: true },
              }),
              db.announcement.findMany({ where: { examId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
            ]);
            send("SNAPSHOT", {
              serverNow: new Date().toISOString(),
              attempt: attempt ? {
                ...attempt,
                hardDeadlineAt: attempt.hardDeadlineAt.toISOString(),
                effectiveDeadlineAt: new Date(attempt.hardDeadlineAt.getTime() + attempt.timeExtensionMinutes * 60_000).toISOString(),
              } : null,
              announcements: announcements.reverse().map((item) => ({ id: item.id, message: item.message, createdAt: item.createdAt.toISOString() })),
            });
          } else {
            send("SNAPSHOT", await getMonitorSnapshot(id));
          }
        } catch (error: unknown) {
          console.error("SSE snapshot refresh error", error);
          send("STREAM_WARNING", { message: "Temporary snapshot refresh delay" });
        }
      };
      void fallback();
      const snapshotTimer = setInterval(() => void fallback(), 5_000);
      const keepAliveTimer = setInterval(() => send("KEEPALIVE", { at: new Date().toISOString() }), 15_000);
      cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        closed = true;
        clearInterval(snapshotTimer);
        clearInterval(keepAliveTimer);
        examEventBus.off(channel, onEvent);
        try { controller.close(); } catch { /* stream already closed */ }
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
