import Papa from "papaparse";
import { z } from "zod";
import {
  CreateQuestionInput,
  CreateQuestionSchema,
  QuestionOption,
} from "@/lib/question-bank";
import { PasswordSchema } from "@/lib/validation";

export type ImportFormat = "csv" | "json";

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportParseResult<T> {
  totalRows: number;
  validRows: T[];
  errors: ImportRowError[];
}

export interface CandidateImportRow {
  name: string;
  email: string;
  studentId: string | null;
  password?: string;
}

const CandidateRowSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").transform((v) => v.toLowerCase()),
  studentId: z
    .string()
    .trim()
    .min(2, "Student ID must be at least 2 characters")
    .max(50)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  password: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined)),
});

function parseCsvRecords(rawText: string): {
  records: Record<string, unknown>[];
  parseErrors: ImportRowError[];
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      records: [],
      parseErrors: [{ row: 1, field: "file", message: "Import content is empty" }],
    };
  }

  const parsed = Papa.parse<Record<string, unknown>>(trimmed, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const parseErrors: ImportRowError[] = parsed.errors.map((err) => ({
    row: typeof err.row === "number" ? err.row + 2 : 1,
    field: "csv",
    message: err.message,
  }));

  return { records: parsed.data, parseErrors };
}

function parseJsonRecords(
  rawText: string,
  wrapperKey: string,
): { records: unknown[]; parseErrors: ImportRowError[] } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      records: [],
      parseErrors: [{ row: 1, field: "file", message: "Import content is empty" }],
    };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return { records: parsed, parseErrors: [] };
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      wrapperKey in parsed &&
      Array.isArray((parsed as Record<string, unknown>)[wrapperKey])
    ) {
      return {
        records: (parsed as Record<string, unknown>)[wrapperKey] as unknown[],
        parseErrors: [],
      };
    }
    return {
      records: [],
      parseErrors: [
        {
          row: 1,
          field: "json",
          message: `Expected a JSON array or an object with a "${wrapperKey}" array`,
        },
      ],
    };
  } catch (error: unknown) {
    return {
      records: [],
      parseErrors: [
        {
          row: 1,
          field: "json",
          message: error instanceof Error ? error.message : "Invalid JSON syntax",
        },
      ],
    };
  }
}

function normalizeOptionsField(raw: unknown): QuestionOption[] | null {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) return raw as QuestionOption[];
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as QuestionOption[];
    } catch {
      return [{ id: "__invalid__", text: trimmed }];
    }
  }

  const parts = trimmed
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.map((part, index) => {
    const colonIndex = part.indexOf(":");
    if (colonIndex > 0 && colonIndex < 16) {
      return {
        id: part.slice(0, colonIndex).trim(),
        text: part.slice(colonIndex + 1).trim(),
      };
    }
    return {
      id: String.fromCharCode(97 + index),
      text: part,
    };
  });
}

function normalizeCorrectIdsField(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return trimmed
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseQuestionImport(
  rawText: string,
  format: ImportFormat,
): ImportParseResult<CreateQuestionInput> {
  const { records, parseErrors } =
    format === "csv"
      ? parseCsvRecords(rawText)
      : parseJsonRecords(rawText, "questions");

  if (parseErrors.length > 0 && records.length === 0) {
    return { totalRows: 0, validRows: [], errors: parseErrors };
  }

  const validRows: CreateQuestionInput[] = [];
  const errors: ImportRowError[] = [...parseErrors];

  records.forEach((rawRecord, index) => {
    const rowNumber = format === "csv" ? index + 2 : index + 1;
    if (!rawRecord || typeof rawRecord !== "object") {
      errors.push({ row: rowNumber, field: "row", message: "Row must be an object" });
      return;
    }

    const record = rawRecord as Record<string, unknown>;
    const candidate = {
      topic: typeof record.topic === "string" ? record.topic : "",
      difficulty:
        typeof record.difficulty === "string" ? record.difficulty.trim().toUpperCase() : record.difficulty,
      type: typeof record.type === "string" ? record.type.trim().toUpperCase() : record.type,
      prompt: typeof record.prompt === "string" ? record.prompt : "",
      options: normalizeOptionsField(record.options ?? record.optionsJson),
      correctIds: normalizeCorrectIdsField(record.correctIds ?? record.correctIdsJson),
      maxMarks: record.maxMarks,
      explanation:
        typeof record.explanation === "string" ? record.explanation : record.explanation ?? null,
    };

    const result = CreateQuestionSchema.safeParse(candidate);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          row: rowNumber,
          field: issue.path.join(".") || "row",
          message: issue.message,
        });
      }
      return;
    }

    validRows.push(result.data);
  });

  return {
    totalRows: records.length,
    validRows,
    errors,
  };
}

export function parseCandidateImport(
  rawText: string,
  format: ImportFormat,
): ImportParseResult<CandidateImportRow> {
  const { records, parseErrors } =
    format === "csv"
      ? parseCsvRecords(rawText)
      : parseJsonRecords(rawText, "candidates");

  if (parseErrors.length > 0 && records.length === 0) {
    return { totalRows: 0, validRows: [], errors: parseErrors };
  }

  const validRows: CandidateImportRow[] = [];
  const errors: ImportRowError[] = [...parseErrors];
  const seenEmails = new Set<string>();

  records.forEach((rawRecord, index) => {
    const rowNumber = format === "csv" ? index + 2 : index + 1;
    if (!rawRecord || typeof rawRecord !== "object") {
      errors.push({ row: rowNumber, field: "row", message: "Row must be an object" });
      return;
    }

    const parsed = CandidateRowSchema.safeParse(rawRecord);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          row: rowNumber,
          field: issue.path.join(".") || "row",
          message: issue.message,
        });
      }
      return;
    }

    if (parsed.data.password) {
      const pwResult = PasswordSchema.safeParse(parsed.data.password);
      if (!pwResult.success) {
        for (const issue of pwResult.error.issues) {
          errors.push({ row: rowNumber, field: "password", message: issue.message });
        }
        return;
      }
    }

    if (seenEmails.has(parsed.data.email)) {
      errors.push({
        row: rowNumber,
        field: "email",
        message: `Duplicate email "${parsed.data.email}" in import payload`,
      });
      return;
    }

    seenEmails.add(parsed.data.email);
    validRows.push({
      name: parsed.data.name,
      email: parsed.data.email,
      studentId: parsed.data.studentId ?? null,
      password: parsed.data.password,
    });
  });

  return {
    totalRows: records.length,
    validRows,
    errors,
  };
}
