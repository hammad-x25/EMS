import { EventEmitter } from "node:events";

export interface ExamLiveEvent {
  type: "ANNOUNCEMENT" | "TIME_EXTENDED" | "EXAM_ENDED" | "ATTEMPT_PROGRESS" | "INCIDENT_LOGGED" | "ATTEMPT_SUBMITTED" | "CONNECTIVITY_CHANGE";
  examId: string;
  attemptId?: string;
  userId?: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

const globalBus = globalThis as typeof globalThis & { aegisExamEventBus?: EventEmitter };
export const examEventBus = globalBus.aegisExamEventBus ?? new EventEmitter();
examEventBus.setMaxListeners(0);
if (process.env.NODE_ENV !== "production") globalBus.aegisExamEventBus = examEventBus;

export function publishExamEvent(event: Omit<ExamLiveEvent, "occurredAt">): void {
  examEventBus.emit(`exam:${event.examId}`, { ...event, occurredAt: new Date().toISOString() } satisfies ExamLiveEvent);
}
