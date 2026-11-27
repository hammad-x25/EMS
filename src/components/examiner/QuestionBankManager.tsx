"use client";

import { Difficulty, QuestionType } from "@prisma/client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BookOpenCheck, Eye, FileUp, Pencil, Plus, Trash2 } from "lucide-react";
import { BulkImportModal } from "@/components/examiner/BulkImportModal";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTableToolbar, PaginationControls } from "@/components/ui/DataTableControls";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { parseApiError, readApiJson } from "@/lib/form-errors";
import type { PaginationMeta } from "@/lib/pagination";
import type { QuestionDto, QuestionOption } from "@/lib/question-bank";

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
const TYPES: QuestionType[] = ["SINGLE_MCQ", "MULTI_SELECT", "WRITTEN"];

const DEFAULT_OPTIONS: QuestionOption[] = [
  { id: "a", text: "" },
  { id: "b", text: "" },
  { id: "c", text: "" },
  { id: "d", text: "" },
];

interface QuestionsListResponse {
  questions?: QuestionDto[];
  topics?: string[];
  pagination?: PaginationMeta;
  error?: { message?: string };
}

export function QuestionBankManager({
  initialQuestions,
  initialTotal,
  initialTopics,
  initialLimit = 20,
}: {
  initialQuestions: QuestionDto[];
  initialTotal: number;
  initialTopics: string[];
  initialLimit?: number;
}) {
  const [questions, setQuestions] = useState<QuestionDto[]>(initialQuestions);
  const [total, setTotal] = useState(initialTotal);
  const [topics, setTopics] = useState<string[]>(initialTopics);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<"ALL" | Difficulty>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | QuestionType>("ALL");
  const [loadingList, setLoadingList] = useState(false);

  const [editing, setEditing] = useState<QuestionDto | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<QuestionDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuestionDto | null>(null);
  const [showImport, setShowImport] = useState(false);

  const [topic, setTopic] = useState("Algorithms");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [type, setType] = useState<QuestionType>("SINGLE_MCQ");
  const [prompt, setPrompt] = useState("");
  const [maxMarks, setMaxMarks] = useState("2");
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<QuestionOption[]>(DEFAULT_OPTIONS);
  const [correctIds, setCorrectIds] = useState<string[]>(["a"]);

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const didMountRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchQuestions = useCallback(
    async (
      targetPage: number,
      targetLimit: number,
      searchText: string,
      selectedTopic: string,
      selectedDifficulty: "ALL" | Difficulty,
      selectedType: "ALL" | QuestionType,
    ) => {
      setLoadingList(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(targetLimit),
        });
        if (searchText) params.set("search", searchText);
        if (selectedTopic !== "ALL") params.set("topic", selectedTopic);
        if (selectedDifficulty !== "ALL") params.set("difficulty", selectedDifficulty);
        if (selectedType !== "ALL") params.set("type", selectedType);

        const response = await fetch(`/api/questions?${params.toString()}`);
        const body = await readApiJson<QuestionsListResponse>(response);
        if (!response.ok || !body?.questions) {
          throw new Error(parseApiError(body, "Unable to load questions").message);
        }
        setQuestions(body.questions);
        if (body.topics) setTopics(body.topics);
        setTotal(body.pagination?.total ?? body.questions.length);
      } catch (err: unknown) {
        setBanner({
          type: "error",
          text: err instanceof Error ? err.message : "Unable to load questions",
        });
      } finally {
        setLoadingList(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    void fetchQuestions(page, limit, debouncedSearch, topicFilter, difficultyFilter, typeFilter);
  }, [page, limit, debouncedSearch, topicFilter, difficultyFilter, typeFilter, fetchQuestions]);

  function openCreate() {
    setEditing(null);
    setTopic("Algorithms");
    setDifficulty("MEDIUM");
    setType("SINGLE_MCQ");
    setPrompt("");
    setMaxMarks("2");
    setExplanation("");
    setOptions(DEFAULT_OPTIONS.map((opt) => ({ ...opt })));
    setCorrectIds(["a"]);
    setEditorError(null);
    setFieldErrors({});
    setShowEditor(true);
  }

  function openEdit(question: QuestionDto) {
    setEditing(question);
    setTopic(question.topic);
    setDifficulty(question.difficulty);
    setType(question.type);
    setPrompt(question.prompt);
    setMaxMarks(String(question.maxMarks));
    setExplanation(question.explanation ?? "");
    setOptions(
      question.options && question.options.length > 0
        ? question.options.map((opt) => ({ ...opt }))
        : DEFAULT_OPTIONS.map((opt) => ({ ...opt })),
    );
    setCorrectIds(question.correctIds ?? ["a"]);
    setEditorError(null);
    setFieldErrors({});
    setShowEditor(true);
  }

  function toggleCorrectId(id: string) {
    if (type === "SINGLE_MCQ") {
      setCorrectIds([id]);
      return;
    }
    setCorrectIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function addOptionRow() {
    const nextLetter = String.fromCharCode(97 + options.length);
    setOptions((current) => [...current, { id: nextLetter, text: "" }]);
  }

  function removeOptionRow(id: string) {
    setOptions((current) => current.filter((opt) => opt.id !== id));
    setCorrectIds((current) => current.filter((item) => item !== id));
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault();
    setEditorError(null);
    setFieldErrors({});

    const cleanOptions =
      type === "WRITTEN"
        ? null
        : options.map((opt) => ({ id: opt.id.trim(), text: opt.text.trim() })).filter((opt) => opt.id && opt.text);

    if (type !== "WRITTEN") {
      if (!cleanOptions || cleanOptions.length < 2) {
        setEditorError("Provide at least 2 non-empty answer options.");
        return;
      }
      const validIds = new Set(cleanOptions.map((o) => o.id));
      const matchingCorrect = correctIds.filter((id) => validIds.has(id));
      if (matchingCorrect.length === 0) {
        setEditorError("Select at least one correct option key.");
        return;
      }
    }

    setBusy(true);
    setBanner(null);

    const payload = {
      topic,
      difficulty,
      type,
      prompt,
      maxMarks: Number(maxMarks),
      explanation: explanation.trim() || null,
      options: cleanOptions,
      correctIds: type === "WRITTEN" ? null : correctIds,
    };

    try {
      const response = await fetch(editing ? `/api/questions/${editing.id}` : "/api/questions", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await readApiJson<{ question?: QuestionDto; error?: { message?: string; details?: unknown } }>(response);
      if (!response.ok || !body?.question) {
        const parsed = parseApiError(body, "Unable to save question");
        setFieldErrors(parsed.fieldErrors);
        setEditorError(parsed.formErrors[0] ?? parsed.message);
        return;
      }

      setShowEditor(false);
      setBanner({
        type: "success",
        text: editing
          ? "Question updated in bank (active attempt snapshots remain preserved)."
          : "Question added to bank.",
      });
      await fetchQuestions(editing ? page : 1, limit, debouncedSearch, topicFilter, difficultyFilter, typeFilter);
      if (!editing) setPage(1);
    } catch (err: unknown) {
      setEditorError(err instanceof Error ? err.message : "Failed to save question");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteQuestion() {
    if (!deleteTarget) return;
    setBusy(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/questions/${deleteTarget.id}`, { method: "DELETE" });
      const body = await readApiJson<{ error?: { message?: string } }>(response);
      if (!response.ok) {
        throw new Error(parseApiError(body, "Unable to delete question").message);
      }
      setDeleteTarget(null);
      setBanner({ type: "success", text: "Question deleted." });
      await fetchQuestions(page, limit, debouncedSearch, topicFilter, difficultyFilter, typeFilter);
    } catch (err: unknown) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Delete failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <DataTableToolbar
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => setShowImport(true)} type="button">
              <FileUp size={16} /> Bulk import
            </button>
            <button className="btn-primary" onClick={openCreate} type="button">
              <Plus size={16} /> New question
            </button>
          </div>
        }
        filters={
          <>
            <select
              aria-label="Filter by topic"
              className="field w-auto min-w-36"
              onChange={(event) => {
                setTopicFilter(event.target.value);
                setPage(1);
              }}
              value={topicFilter}
            >
              <option value="ALL">All topics</option>
              {topics.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by difficulty"
              className="field w-auto min-w-32"
              onChange={(event) => {
                setDifficultyFilter(event.target.value as "ALL" | Difficulty);
                setPage(1);
              }}
              value={difficultyFilter}
            >
              <option value="ALL">All difficulties</option>
              {DIFFICULTIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by type"
              className="field w-auto min-w-32"
              onChange={(event) => {
                setTypeFilter(event.target.value as "ALL" | QuestionType);
                setPage(1);
              }}
              value={typeFilter}
            >
              <option value="ALL">All types</option>
              {TYPES.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </>
        }
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        search={search}
        searchLabel="Search questions"
        searchPlaceholder="Search prompt or topic"
      />

      {banner ? (
        <AlertBanner onDismiss={() => setBanner(null)} variant={banner.type}>
          {banner.text}
        </AlertBanner>
      ) : null}

      <section className="card overflow-hidden">
        {questions.length === 0 ? (
          <EmptyState
            action={
              <button className="btn-primary" onClick={openCreate} type="button">
                <Plus size={16} /> Add first question
              </button>
            }
            description={
              loadingList
                ? "Loading questions…"
                : "No questions match your current filters."
            }
            icon={BookOpenCheck}
            title={loadingList ? "Loading question bank" : "No questions found"}
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="hidden bg-[var(--bg-surface-subtle)] text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] md:table-header-group">
              <tr>
                <th className="p-4">Prompt</th>
                <th className="p-4">Topic</th>
                <th className="p-4">Difficulty</th>
                <th className="p-4">Type</th>
                <th className="p-4 text-right">Marks</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] md:divide-y-0">
              {questions.map((q) => (
                <tr className="block space-y-2 p-4 md:table-row md:space-y-0 md:border-t md:border-[var(--border-subtle)] md:p-0" key={q.id}>
                  <td className="block max-w-md md:table-cell md:p-4">
                    <p className="line-clamp-2 font-semibold text-[var(--text-primary)]">{q.prompt}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Used in {q.assignedExamCount} exam{q.assignedExamCount === 1 ? "" : "s"}
                    </p>
                  </td>
                  <td className="block font-medium md:table-cell md:p-4">{q.topic}</td>
                  <td className="inline-block pr-2 md:table-cell md:p-4">
                    <StatusBadge status={q.difficulty} />
                  </td>
                  <td className="inline-block text-xs font-semibold text-[var(--text-secondary)] md:table-cell md:p-4">
                    {q.type.replaceAll("_", " ")}
                  </td>
                  <td className="font-mono-tabular inline-block pl-2 font-bold md:table-cell md:p-4 md:text-right">
                    {q.maxMarks}
                    <span className="md:hidden">m</span>
                  </td>
                  <td className="block md:table-cell md:p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        aria-label={`Preview question ${q.topic}`}
                        className="btn-secondary h-9 px-2.5"
                        onClick={() => setPreviewTarget(q)}
                        type="button"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        aria-label={`Edit question ${q.topic}`}
                        className="btn-secondary h-9 px-2.5"
                        onClick={() => openEdit(q)}
                        type="button"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label={`Delete question ${q.topic}`}
                        className="btn-danger h-9 px-2.5"
                        disabled={busy}
                        onClick={() => setDeleteTarget(q)}
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <PaginationControls
          limit={limit}
          loading={loadingList}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          onPageChange={(nextPage) => setPage(nextPage)}
          page={page}
          total={total}
        />
      </section>

      <Modal
        closeDisabled={busy}
        closeLabel="Close question editor"
        eyebrow="Question bank"
        onClose={() => setShowEditor(false)}
        open={showEditor}
        size="lg"
        title={editing ? "Edit question" : "Create question"}
      >
        <form className="space-y-4" onSubmit={saveQuestion}>
          {editorError ? <AlertBanner variant="error">{editorError}</AlertBanner> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <FormField error={fieldErrors.topic} label="Topic / Category" required>
              <input
                aria-invalid={Boolean(fieldErrors.topic)}
                className="field"
                onChange={(e) => setTopic(e.target.value)}
                required
                value={topic}
              />
            </FormField>
            <FormField error={fieldErrors.difficulty} label="Difficulty" required>
              <select
                className="field"
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                value={difficulty}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField error={fieldErrors.type} label="Question Type" required>
              <select
                className="field"
                onChange={(e) => {
                  const nextType = e.target.value as QuestionType;
                  setType(nextType);
                  if (nextType === "SINGLE_MCQ" && correctIds.length > 1) {
                    setCorrectIds([correctIds[0]]);
                  }
                }}
                value={type}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField error={fieldErrors.maxMarks} label="Default Marks" required>
              <input
                aria-invalid={Boolean(fieldErrors.maxMarks)}
                className="field font-mono-tabular"
                min={0.5}
                onChange={(e) => setMaxMarks(e.target.value)}
                required
                step="0.5"
                type="number"
                value={maxMarks}
              />
            </FormField>
          </div>

          <FormField error={fieldErrors.prompt} label="Question Prompt" required>
            <textarea
              aria-invalid={Boolean(fieldErrors.prompt)}
              className="field min-h-24"
              onChange={(e) => setPrompt(e.target.value)}
              required
              value={prompt}
            />
          </FormField>

          {type !== "WRITTEN" ? (
            <div className="space-y-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  Options &amp; Answer Key (
                  {type === "SINGLE_MCQ" ? "select 1 correct" : "select 1 or more correct"})
                </p>
                <button className="btn-secondary h-8 px-2.5 text-xs" onClick={addOptionRow} type="button">
                  <Plus size={14} /> Add option
                </button>
              </div>
              {options.map((opt, idx) => (
                <div className="flex items-center gap-2" key={`${opt.id}-${idx}`}>
                  <input
                    aria-label={`Mark option ${opt.id} correct`}
                    checked={correctIds.includes(opt.id)}
                    onChange={() => toggleCorrectId(opt.id)}
                    type={type === "SINGLE_MCQ" ? "radio" : "checkbox"}
                  />
                  <input
                    aria-label="Option ID"
                    className="field font-mono-tabular w-16 text-xs"
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setOptions((current) =>
                        current.map((item, i) => (i === idx ? { ...item, id: nextId } : item)),
                      );
                    }}
                    required
                    value={opt.id}
                  />
                  <input
                    aria-label={`Option ${opt.id} text`}
                    className="field flex-1"
                    onChange={(e) => {
                      const textVal = e.target.value;
                      setOptions((current) =>
                        current.map((item, i) => (i === idx ? { ...item, text: textVal } : item)),
                      );
                    }}
                    placeholder={`Choice ${opt.id}`}
                    required
                    value={opt.text}
                  />
                  {options.length > 2 ? (
                    <button
                      aria-label={`Remove option ${opt.id}`}
                      className="btn-danger h-9 px-2.5"
                      onClick={() => removeOptionRow(opt.id)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <FormField hint="Optional explanation shown only if answer key reveal is enabled after publish." label="Explanation / Grading Note">
            <textarea
              className="field min-h-16"
              onChange={(e) => setExplanation(e.target.value)}
              value={explanation}
            />
          </FormField>

          <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            <button className="btn-secondary" disabled={busy} onClick={() => setShowEditor(false)} type="button">
              Cancel
            </button>
            <button className="btn-primary" disabled={busy} type="submit">
              {busy ? "Saving…" : editing ? "Save changes" : "Create question"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        closeLabel="Close preview"
        eyebrow={previewTarget ? `${previewTarget.topic} · ${previewTarget.difficulty} · ${previewTarget.maxMarks} marks` : undefined}
        onClose={() => setPreviewTarget(null)}
        open={Boolean(previewTarget)}
        size="md"
        title={previewTarget ? `Question preview (${previewTarget.type.replaceAll("_", " ")})` : "Question preview"}
      >
        {previewTarget ? (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap text-base font-semibold text-[var(--text-primary)]">
              {previewTarget.prompt}
            </p>
            {previewTarget.options ? (
              <ul className="space-y-2">
                {previewTarget.options.map((opt) => {
                  const isCorrect = previewTarget.correctIds?.includes(opt.id);
                  return (
                    <li
                      className={`rounded-lg border px-3 py-2.5 text-sm ${
                        isCorrect
                          ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] font-semibold text-[var(--status-success-text)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      }`}
                      key={opt.id}
                    >
                      <span className="font-mono-tabular mr-2 text-xs uppercase">{opt.id}.</span>
                      {opt.text}
                      {isCorrect ? <span className="ml-2 text-xs font-bold">(Correct key)</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-4 text-sm text-[var(--text-secondary)]">
                Candidate written-response field
              </p>
            )}
            {previewTarget.explanation ? (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-xs text-[var(--text-secondary)]">
                <strong>Explanation:</strong> {previewTarget.explanation}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        busy={busy}
        confirmLabel="Delete question"
        consequence={
          deleteTarget && deleteTarget.assignedExamCount > 0
            ? `This question is linked to ${deleteTarget.assignedExamCount} exam(s). Deletion may be rejected if referenced by published/active exams.`
            : "This permanently removes the question from your bank."
        }
        description={
          deleteTarget
            ? `Delete "${deleteTarget.prompt.slice(0, 100)}${deleteTarget.prompt.length > 100 ? "…" : ""}" (${deleteTarget.topic})?`
            : ""
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteQuestion()}
        open={Boolean(deleteTarget)}
        title="Delete question"
        variant="danger"
      />

      {showImport ? (
        <BulkImportModal
          mode="questions"
          onClose={() => setShowImport(false)}
          onSuccess={(summary) => {
            setBanner({ type: "success", text: summary });
            void fetchQuestions(1, limit, debouncedSearch, topicFilter, difficultyFilter, typeFilter);
            setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}
