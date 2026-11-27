export interface ParsedApiError {
  message: string;
  code?: string;
  fieldErrors: Record<string, string>;
  formErrors: string[];
}

interface RawApiErrorBody {
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extracts structured message and field-level Zod validation errors from API error payloads.
 */
export function parseApiError(body: unknown, fallback = "The request could not be completed"): ParsedApiError {
  if (!isRecord(body)) {
    return { message: fallback, fieldErrors: {}, formErrors: [] };
  }

  const raw = body as RawApiErrorBody;
  const errObj = isRecord(raw.error) ? raw.error : undefined;
  const message =
    typeof errObj?.message === "string" && errObj.message.trim().length > 0
      ? errObj.message
      : fallback;
  const code = typeof errObj?.code === "string" ? errObj.code : undefined;

  const fieldErrors: Record<string, string> = {};
  const formErrors: string[] = [];

  if (isRecord(errObj?.details)) {
    const details = errObj.details;
    if (Array.isArray(details.formErrors)) {
      for (const item of details.formErrors) {
        if (typeof item === "string" && item.trim()) formErrors.push(item);
      }
    }
    if (isRecord(details.fieldErrors)) {
      for (const [key, value] of Object.entries(details.fieldErrors)) {
        if (Array.isArray(value)) {
          const first = value.find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
          if (first) fieldErrors[key] = first;
        } else if (typeof value === "string" && value.trim().length > 0) {
          fieldErrors[key] = value;
        }
      }
    }
  }

  return { message, code, fieldErrors, formErrors };
}

export async function readApiJson<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}
