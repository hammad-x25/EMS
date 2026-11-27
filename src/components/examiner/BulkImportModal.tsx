"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Modal } from "@/components/ui/Modal";
import { parseApiError, readApiJson } from "@/lib/form-errors";

type ImportType = "questions" | "candidates";
type ImportFormat = "csv" | "json";

interface ImportErrorItem {
  row: number;
  field: string;
  message: string;
}

interface DryRunResult {
  dryRun: true;
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: ImportErrorItem[];
  preview: Array<Record<string, unknown>>;
  newUsersCount?: number;
  existingCandidatesCount?: number;
}

const SAMPLE_QUESTIONS_CSV = `topic,difficulty,type,prompt,options,correctIds,maxMarks,explanation
Algorithms,EASY,SINGLE_MCQ,"Which traversal visits root before subtrees?","a:Inorder|b:Preorder|c:Postorder|d:Level order",b,2,"Preorder visits Root -> Left -> Right."
Databases,MEDIUM,MULTI_SELECT,"Which operations are part of DML in SQL?","a:INSERT|b:UPDATE|c:CREATE|d:DELETE",a|b|d,3,"CREATE is DDL."
Networks,HARD,WRITTEN,"Explain why TLS uses both asymmetric and symmetric cryptography.",,,5,`;

const SAMPLE_QUESTIONS_JSON = JSON.stringify(
  {
    questions: [
      {
        topic: "Algorithms",
        difficulty: "MEDIUM",
        type: "SINGLE_MCQ",
        prompt: "Which data structure backs Dijkstra's shortest-path optimization?",
        options: [
          { id: "a", text: "Priority Queue (Min-Heap)" },
          { id: "b", text: "Stack" },
          { id: "c", text: "Circular Buffer" },
        ],
        correctIds: ["a"],
        maxMarks: 3,
      },
    ],
  },
  null,
  2,
);

const SAMPLE_CANDIDATES_CSV = `name,email,studentId
Zainab Tariq,zainab.tariq@aegisexam.local,AEG-2026-101
Hamza Raza,hamza.raza@aegisexam.local,AEG-2026-102`;

const SAMPLE_CANDIDATES_JSON = JSON.stringify(
  {
    candidates: [
      {
        name: "Sana Malik",
        email: "sana.malik@aegisexam.local",
        studentId: "AEG-2026-103",
      },
    ],
  },
  null,
  2,
);

export function BulkImportModal({
  mode,
  enrollExamId,
  onClose,
  onSuccess,
}: {
  mode: ImportType;
  enrollExamId?: string;
  onClose: () => void;
  onSuccess: (summary: string) => void;
}) {
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [content, setContent] = useState("");
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const endpoint = mode === "questions" ? "/api/import/questions" : "/api/import/candidates";

  function loadSample(selectedFormat: ImportFormat) {
    setFormat(selectedFormat);
    setDryRun(null);
    setErrorMessage(null);
    if (mode === "questions") {
      setContent(selectedFormat === "csv" ? SAMPLE_QUESTIONS_CSV : SAMPLE_QUESTIONS_JSON);
    } else {
      setContent(selectedFormat === "csv" ? SAMPLE_CANDIDATES_CSV : SAMPLE_CANDIDATES_JSON);
    }
  }

  async function handleFileUpload(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    if (file.name.toLowerCase().endsWith(".json")) {
      setFormat("json");
    } else if (file.name.toLowerCase().endsWith(".csv")) {
      setFormat("csv");
    }
    setContent(text);
    setDryRun(null);
    setErrorMessage(null);
  }

  async function runDryCheck(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage(null);
    setDryRun(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          format,
          content,
          dryRun: true,
          enrollExamId: enrollExamId ?? undefined,
        }),
      });
      const body = await readApiJson<DryRunResult & { error?: { message?: string } }>(response);
      if (!response.ok || !body) {
        throw new Error(parseApiError(body, "Validation check failed").message);
      }
      setDryRun(body);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    setBusy(true);
    setErrorMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          format,
          content,
          dryRun: false,
          enrollExamId: enrollExamId ?? undefined,
        }),
      });
      const body = await readApiJson<{
        createdCount?: number;
        skippedExisting?: number;
        enrolledCount?: number;
        error?: { message?: string };
      }>(response);
      if (!response.ok) {
        throw new Error(parseApiError(body, "Import failed").message);
      }

      const summary =
        mode === "questions"
          ? `Imported ${body?.createdCount ?? 0} questions into your bank.`
          : `Imported ${body?.createdCount ?? 0} new candidates (${body?.skippedExisting ?? 0} existing)${enrollExamId ? ` and enrolled ${body?.enrolledCount ?? 0} in this examination.` : "."}`;

      onSuccess(summary);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Import commit failed");
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "questions"
      ? "Import questions from CSV or JSON"
      : enrollExamId
        ? "Import & enroll candidates from CSV or JSON"
        : "Import candidate accounts";

  return (
    <Modal
      closeDisabled={busy}
      closeLabel="Close bulk import modal"
      description="Run a dry-run validation check before committing records."
      eyebrow="Bulk import"
      onClose={onClose}
      open
      size="xl"
      title={title}
    >
      <form className="space-y-4" onSubmit={runDryCheck}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              className={format === "csv" ? "btn-primary h-9 px-3 text-xs" : "btn-secondary h-9 px-3 text-xs"}
              onClick={() => setFormat("csv")}
              type="button"
            >
              CSV
            </button>
            <button
              className={format === "json" ? "btn-primary h-9 px-3 text-xs" : "btn-secondary h-9 px-3 text-xs"}
              onClick={() => setFormat("json")}
              type="button"
            >
              JSON
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-secondary h-9 px-3 text-xs"
              onClick={() => loadSample("csv")}
              type="button"
            >
              <FileSpreadsheet size={14} /> Load sample CSV
            </button>
            <button
              className="btn-secondary h-9 px-3 text-xs"
              onClick={() => loadSample("json")}
              type="button"
            >
              Load sample JSON
            </button>
            <label className="btn-secondary h-9 cursor-pointer px-3 text-xs">
              <Upload size={14} /> Upload file
              <input
                accept=".csv,.json,text/csv,application/json"
                className="sr-only"
                onChange={(event) => void handleFileUpload(event.target.files?.[0])}
                type="file"
              />
            </label>
          </div>
        </div>

        <label className="block text-sm font-semibold text-[var(--text-primary)]">
          Import payload ({format.toUpperCase()})
          <textarea
            className="field font-mono-tabular mt-1.5 min-h-44 text-xs"
            onChange={(event) => {
              setContent(event.target.value);
              setDryRun(null);
            }}
            placeholder={
              mode === "questions"
                ? "Paste CSV with headers: topic,difficulty,type,prompt,options,correctIds,maxMarks,explanation"
                : "Paste CSV with headers: name,email,studentId"
            }
            required
            value={content}
          />
        </label>

        {errorMessage ? <AlertBanner variant="error">{errorMessage}</AlertBanner> : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
          <button className="btn-secondary" disabled={busy} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn-secondary" disabled={busy || !content.trim()} type="submit">
            {busy ? "Validating…" : "Validate (Dry Run)"}
          </button>
          <button
            className="btn-primary"
            disabled={busy || !dryRun || dryRun.errorCount > 0 || dryRun.validCount === 0}
            onClick={() => void commitImport()}
            type="button"
          >
            {busy ? "Importing…" : `Commit ${dryRun?.validCount ?? 0} valid rows`}
          </button>
        </div>
      </form>

      {dryRun ? (
        <div className="mt-5 space-y-3 border-t border-[var(--border-subtle)] pt-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="status-pill status-active">
              <CheckCircle2 size={14} /> {dryRun.validCount} valid rows
            </span>
            {dryRun.errorCount > 0 ? (
              <span className="status-pill status-inactive">
                <AlertTriangle size={14} /> {dryRun.errorCount} validation errors
              </span>
            ) : null}
            <span className="font-mono-tabular text-xs text-[var(--text-secondary)]">
              Total parsed: {dryRun.totalRows}
            </span>
          </div>

          {dryRun.errors.length > 0 ? (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-xs text-[var(--status-danger-text)]">
              <p className="font-bold">Fix the following errors before committing:</p>
              <ul className="mt-2 space-y-1">
                {dryRun.errors.map((err, idx) => (
                  <li key={`${err.row}-${err.field}-${idx}`}>
                    <strong>Row {err.row}</strong> ({err.field}): {err.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {dryRun.preview.length > 0 ? (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-xs">
              <p className="font-bold text-[var(--text-primary)]">
                Preview (showing up to {dryRun.preview.length} valid rows):
              </p>
              <ul className="mt-2 space-y-1 text-[var(--text-secondary)]">
                {dryRun.preview.map((row, idx) => (
                  <li className="truncate" key={idx}>
                    {mode === "questions"
                      ? `[${String(row.topic)}] ${String(row.difficulty)} · ${String(row.type)} · ${String(row.prompt)} (${String(row.maxMarks)}m)`
                      : `${String(row.name)} (${String(row.email)}) · ${String(row.status ?? "")}`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
