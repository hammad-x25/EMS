"use client";

import { Difficulty, QuestionType } from "@prisma/client";
import { FormEvent, useMemo, useState } from "react";
import {
  Eye,
  FileUp,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { BulkImportModal } from "@/components/examiner/BulkImportModal";
import type { QuestionDto, QuestionOption } from "@/lib/question-bank";

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
const TYPES: QuestionType[] = ["SINGLE_MCQ", "MULTI_SELECT", "WRITTEN"];

const difficultyBadge: Record<Difficulty, string> = {
  EASY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  HARD: "bg-rose-50 text-rose-700 border-rose-200",
};

const DEFAULT_OPTIONS: QuestionOption[] = [
  { id: "a", text: "" },
  { id: "b", text: "" },
  { id: "c", text: "" },
  { id: "d", text: "" },
];

export function QuestionBankManager({
  initialQuestions,
}: {
  initialQuestions: QuestionDto[];
}) {
  const [questions, setQuestions] = useState<QuestionDto[]>(initialQuestions);
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<"ALL" | Difficulty>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | QuestionType>("ALL");

  const [editing, setEditing] = useState<QuestionDto | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<QuestionDto | null>(null);
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

  const topics = useMemo(
    () => Array.from(new Set(questions.map((q) => q.topic))).sort((a, b) => a.localeCompare(b)),
    [questions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter(
      (item) =>
        (topicFilter === "ALL" || item.topic === topicFilter) &&
        (difficultyFilter === "ALL" || item.difficulty === difficultyFilter) &&
        (typeFilter === "ALL" || item.type === typeFilter) &&
        (!q || `${item.prompt} ${item.topic}`.toLowerCase().includes(q)),
    );
  }, [questions, search, topicFilter, difficultyFilter, typeFilter]);

  async function refreshQuestions() {
    const response = await fetch("/api/questions");
    if (!response.ok) return;
    const body = (await response.json()) as { questions: QuestionDto[] };
    setQuestions(body.questions);
  }

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
    setBusy(true);
    setBanner(null);

    const cleanOptions =
      type === "WRITTEN"
        ? null
        : options.map((opt) => ({ id: opt.id.trim(), text: opt.text.trim() })).filter((opt) => opt.id && opt.text);

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
      const body = (await response.json()) as {
        question?: QuestionDto;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Unable to save question");
      }

      if (body.question) {
        setQuestions((current) =>
          editing
            ? current.map((q) => (q.id === body.question!.id ? body.question! : q))
            : [body.question!, ...current],
        );
      }
      setShowEditor(false);
      setBanner({
        type: "success",
        text: editing
          ? "Question updated in bank (active attempt snapshots remain preserved)."
          : "Question added to bank.",
      });
    } catch (err: unknown) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save question",
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuestion(question: QuestionDto) {
    setBusy(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/questions/${question.id}`, { method: "DELETE" });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Unable to delete question");
      }
      setQuestions((current) => current.filter((q) => q.id !== question.id));
      setBanner({ type: "success", text: "Question deleted." });
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
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Search questions</span>
          <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
          <input
            className="field pl-10"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search question prompt or topic"
            value={search}
          />
        </label>
        <select
          aria-label="Filter by topic"
          className="field w-auto"
          onChange={(event) => setTopicFilter(event.target.value)}
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
          className="field w-auto"
          onChange={(event) => setDifficultyFilter(event.target.value as "ALL" | Difficulty)}
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
          className="field w-auto"
          onChange={(event) => setTypeFilter(event.target.value as "ALL" | QuestionType)}
          value={typeFilter}
        >
          <option value="ALL">All types</option>
          {TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          className="btn-secondary"
          onClick={() => setShowImport(true)}
          type="button"
        >
          <FileUp size={17} /> Bulk import
        </button>
        <button className="btn-primary" onClick={openCreate} type="button">
          <Plus size={17} /> New question
        </button>
      </div>

      {banner ? (
        <div
          aria-live="polite"
          className={`rounded-xl border p-3 text-sm ${
            banner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <section className="card overflow-hidden">
        <div className="desktop-table">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-4">Question</th>
                <th className="p-4">Topic</th>
                <th className="p-4">Difficulty</th>
                <th className="p-4">Type</th>
                <th className="p-4">Marks</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr className="border-t border-slate-100" key={q.id}>
                  <td className="max-w-md p-4">
                    <p className="line-clamp-2 font-semibold text-slate-900">{q.prompt}</p>
                    {q.assignedExamCount > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Used in {q.assignedExamCount} examination{q.assignedExamCount === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </td>
                  <td className="p-4 font-medium">{q.topic}</td>
                  <td className="p-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${difficultyBadge[q.difficulty]}`}
                    >
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-bold text-slate-600">{q.type}</td>
                  <td className="p-4 font-bold">{q.maxMarks}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        aria-label={`Preview question ${q.id}`}
                        className="btn-secondary px-2.5 py-1.5"
                        onClick={() => setPreviewTarget(q)}
                        type="button"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        aria-label={`Edit question ${q.id}`}
                        className="btn-secondary px-2.5 py-1.5"
                        onClick={() => openEdit(q)}
                        type="button"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label={`Delete question ${q.id}`}
                        className="btn-danger px-2.5 py-1.5"
                        disabled={busy}
                        onClick={() => void deleteQuestion(q)}
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
        </div>
        {filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">
            No questions match your current filters.
          </p>
        ) : null}
      </section>

      {showEditor ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="question-editor-title"
        >
          <form
            className="card max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto p-6"
            onSubmit={saveQuestion}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Question bank</p>
                <h2 className="mt-1 text-xl font-black" id="question-editor-title">
                  {editing ? "Edit question" : "Create question"}
                </h2>
              </div>
              <button
                aria-label="Close question editor"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setShowEditor(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold">
                Topic / Category
                <input
                  className="field mt-1.5"
                  onChange={(e) => setTopic(e.target.value)}
                  required
                  value={topic}
                />
              </label>
              <label className="text-sm font-bold">
                Difficulty
                <select
                  className="field mt-1.5"
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  value={difficulty}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Question Type
                <select
                  className="field mt-1.5"
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
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Default Marks
                <input
                  className="field mt-1.5"
                  min={0.5}
                  onChange={(e) => setMaxMarks(e.target.value)}
                  required
                  step="0.5"
                  type="number"
                  value={maxMarks}
                />
              </label>
            </div>

            <label className="block text-sm font-bold">
              Question Prompt
              <textarea
                className="field mt-1.5 min-h-24"
                onChange={(e) => setPrompt(e.target.value)}
                required
                value={prompt}
              />
            </label>

            {type !== "WRITTEN" ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">
                    Options &amp; Answer Key (
                    {type === "SINGLE_MCQ" ? "select 1 correct" : "select 1 or more correct"})
                  </p>
                  <button
                    className="btn-secondary px-2.5 py-1 text-xs"
                    onClick={addOptionRow}
                    type="button"
                  >
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
                      className="field w-16 font-mono text-xs"
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
                      aria-label="Option text"
                      className="field flex-1"
                      onChange={(e) => {
                        const nextText = e.target.value;
                        setOptions((current) =>
                          current.map((item, i) => (i === idx ? { ...item, text: nextText } : item)),
                        );
                      }}
                      placeholder={`Option ${opt.id} text`}
                      required
                      value={opt.text}
                    />
                    {options.length > 2 ? (
                      <button
                        aria-label={`Remove option ${opt.id}`}
                        className="btn-danger px-2 py-2"
                        onClick={() => removeOptionRow(opt.id)}
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <label className="block text-sm font-bold">
              Explanation / Grading Note <span className="font-normal text-slate-400">(optional)</span>
              <textarea
                className="field mt-1.5 min-h-16"
                onChange={(e) => setExplanation(e.target.value)}
                value={explanation}
              />
            </label>

            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowEditor(false)} type="button">
                Cancel
              </button>
              <button className="btn-primary" disabled={busy} type="submit">
                {busy ? "Saving…" : editing ? "Save changes" : "Create question"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {previewTarget ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
        >
          <div className="card w-full max-w-xl space-y-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">
                  {previewTarget.topic} · {previewTarget.difficulty} · {previewTarget.maxMarks} marks
                </p>
                <h2 className="mt-1 text-lg font-black" id="preview-title">
                  Question preview ({previewTarget.type})
                </h2>
              </div>
              <button
                aria-label="Close preview"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setPreviewTarget(null)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-slate-900">{previewTarget.prompt}</p>
            {previewTarget.options ? (
              <ul className="space-y-2">
                {previewTarget.options.map((opt) => {
                  const isCorrect = previewTarget.correctIds?.includes(opt.id);
                  return (
                    <li
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        isCorrect
                          ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-900"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                      key={opt.id}
                    >
                      <span className="mr-2 font-mono text-xs uppercase">{opt.id}.</span>
                      {opt.text}
                      {isCorrect ? <span className="ml-2 text-xs font-bold">(Correct key)</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                Candidate written-response field
              </p>
            )}
            {previewTarget.explanation ? (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <strong>Explanation:</strong> {previewTarget.explanation}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {showImport ? (
        <BulkImportModal
          mode="questions"
          onClose={() => setShowImport(false)}
          onSuccess={(summary) => {
            setBanner({ type: "success", text: summary });
            void refreshQuestions();
          }}
        />
      ) : null}
    </div>
  );
}
