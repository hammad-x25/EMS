import {
  Difficulty,
  Exam,
  ExamBlueprintRule,
  ExamQuestion,
  ExamStatus,
  MultiSelectScoring,
  Question,
  QuestionType,
} from "@prisma/client";
import { parseOptionsJson, QuestionOption } from "@/lib/question-bank";

export interface ExamAssignedQuestionDto {
  id: string;
  questionId: string;
  orderIndex: number;
  marks: number;
  topic: string;
  difficulty: Difficulty;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
}

export interface ExamBlueprintRuleDto {
  id: string;
  topic: string;
  difficulty: Difficulty;
  pickCount: number;
  marksEach: number;
}

export interface ExamDto {
  id: string;
  title: string;
  instructions: string;
  status: ExamStatus;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  useStratifiedBlueprint: boolean;
  multiSelectRule: MultiSelectScoring;
  negativeMarkRatio: number;
  revealAnswersAfterPublish: boolean;
  resultsPublishedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  counts: {
    questions: number;
    blueprintRules: number;
    enrollments: number;
    attempts: number;
  };
  assignedMarksSum: number;
  blueprintMarksSum: number;
  assignedQuestions?: ExamAssignedQuestionDto[];
  blueprintRules?: ExamBlueprintRuleDto[];
}

export type ExamWithRelations = Exam & {
  _count: {
    examQuestions: number;
    blueprintRules: number;
    enrollments: number;
    attempts: number;
  };
  examQuestions?: Array<ExamQuestion & { question: Question }>;
  blueprintRules?: ExamBlueprintRule[];
};

export function toExamDto(exam: ExamWithRelations): ExamDto {
  const assignedQuestions = exam.examQuestions
    ?.slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((item) => ({
      id: item.id,
      questionId: item.questionId,
      orderIndex: item.orderIndex,
      marks: item.marks,
      topic: item.question.topic,
      difficulty: item.question.difficulty,
      type: item.question.type,
      prompt: item.question.prompt,
      options: parseOptionsJson(item.question.optionsJson),
    }));

  const blueprintRules = exam.blueprintRules
    ?.slice()
    .sort((a, b) => a.topic.localeCompare(b.topic) || a.difficulty.localeCompare(b.difficulty))
    .map((rule) => ({
      id: rule.id,
      topic: rule.topic,
      difficulty: rule.difficulty,
      pickCount: rule.pickCount,
      marksEach: rule.marksEach,
    }));

  const assignedMarksSum = Number(
    (exam.examQuestions?.reduce((sum, q) => sum + q.marks, 0) ?? 0).toFixed(2),
  );
  const blueprintMarksSum = Number(
    (exam.blueprintRules?.reduce((sum, r) => sum + r.pickCount * r.marksEach, 0) ?? 0).toFixed(2),
  );

  return {
    id: exam.id,
    title: exam.title,
    instructions: exam.instructions,
    status: exam.status,
    scheduledStart: exam.scheduledStart.toISOString(),
    scheduledEnd: exam.scheduledEnd.toISOString(),
    durationMinutes: exam.durationMinutes,
    totalMarks: exam.totalMarks,
    passingMarks: exam.passingMarks,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    useStratifiedBlueprint: exam.useStratifiedBlueprint,
    multiSelectRule: exam.multiSelectRule,
    negativeMarkRatio: exam.negativeMarkRatio,
    revealAnswersAfterPublish: exam.revealAnswersAfterPublish,
    resultsPublishedAt: exam.resultsPublishedAt ? exam.resultsPublishedAt.toISOString() : null,
    createdById: exam.createdById,
    createdAt: exam.createdAt.toISOString(),
    updatedAt: exam.updatedAt.toISOString(),
    counts: {
      questions: exam._count.examQuestions,
      blueprintRules: exam._count.blueprintRules,
      enrollments: exam._count.enrollments,
      attempts: exam._count.attempts,
    },
    assignedMarksSum,
    blueprintMarksSum,
    assignedQuestions,
    blueprintRules,
  };
}
