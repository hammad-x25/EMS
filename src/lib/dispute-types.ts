import { DisputeStatus, QuestionType } from "@prisma/client";
import { z } from "zod";

export const DISPUTE_CATEGORIES = [
  "GRADING_ERROR",
  "AMBIGUOUS_QUESTION",
  "TECHNICAL_INCIDENT",
  "INCIDENT_APPEAL",
] as const;

export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number];

export const CreateDisputeSchema = z.object({
  attemptId: z.string().trim().min(1),
  snapshotId: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .transform((v) => v || null),
  category: z.enum(DISPUTE_CATEGORIES),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the dispute in at least 10 characters")
    .max(3000),
});

export const ResolveDisputeSchema = z
  .object({
    outcome: z.enum(["UNDER_REVIEW", "RESOLVED_UPHELD", "RESOLVED_ADJUSTED", "REJECTED"]),
    resolutionNote: z.string().trim().max(3000).optional(),
    adjustedManualScore: z.number().finite().min(0).optional(),
    scoreDelta: z.number().finite().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.outcome !== "UNDER_REVIEW") {
      if (!value.resolutionNote || value.resolutionNote.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["resolutionNote"],
          message: "Resolution note must contain at least 5 characters",
        });
      }
    }
    if (value.outcome === "RESOLVED_ADJUSTED") {
      if (value.adjustedManualScore === undefined && value.scoreDelta === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scoreDelta"],
          message: "Provide adjustedManualScore or scoreDelta when adjusting a result",
        });
      }
    }
  });

export interface DisputeDto {
  id: string;
  examId: string;
  examTitle: string;
  attemptId: string;
  candidate: { id: string; name: string; email?: string; studentId: string | null };
  snapshotId: string | null;
  question: {
    displayOrder: number;
    topic: string;
    type: QuestionType;
    prompt: string;
    maxMarks: number;
    selectedIds: string[] | null;
    writtenText: string | null;
    autoScore: number;
    manualScore: number | null;
    graderFeedback: string | null;
  } | null;
  category: string;
  description: string;
  status: DisputeStatus;
  resolutionNote: string | null;
  scoreDelta: number | null;
  resolvedById: string | null;
  attemptTotalScore: number | null;
  attemptMaxScore: number;
  events: Array<{
    id: string;
    eventType: string;
    severity: string;
    occurredAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
