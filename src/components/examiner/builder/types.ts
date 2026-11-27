import type { Difficulty } from "@prisma/client";
import type { UserDto } from "@/lib/user-dto";

export type BuilderTab = "details" | "questions" | "fairness" | "enrollments" | "publish";

export interface EnrollmentEntry {
  id: string;
  enrolledAt: string;
  candidate: UserDto;
}

export interface BlueprintRuleDraft {
  topic: string;
  difficulty: Difficulty;
  pickCount: number;
  marksEach: number;
}

export interface AssignedQuestionDraft {
  questionId: string;
  marks: number;
}

export function toLocalDateTimeInput(isoString: string): string {
  const date = new Date(isoString);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
