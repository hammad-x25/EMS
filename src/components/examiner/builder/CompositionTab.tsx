"use client";

import { Difficulty } from "@prisma/client";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AssignedQuestionDraft, BlueprintRuleDraft } from "@/components/examiner/builder/types";
import { DataTableToolbar, PaginationControls } from "@/components/ui/DataTableControls";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { QuestionDto } from "@/lib/question-bank";

const PAGE_SIZE = 15;

export function CompositionTab({
  isLocked,
  busy,
  totalMarks,
  useStratifiedBlueprint,
  bankQuestions,
  bankTopics,
  poolAvailability,
  blueprintRules,
  blueprintMarksTotal,
  assignedItems,
  assignedMarksTotal,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  onSaveBlueprint,
  onToggleAssigned,
  onUpdateAssignedMarks,
  onSaveAssigned,
}: {
  isLocked: boolean;
  busy: boolean;
  totalMarks: number;
  useStratifiedBlueprint: boolean;
  bankQuestions: QuestionDto[];
  bankTopics: string[];
  poolAvailability: Map<string, number>;
  blueprintRules: BlueprintRuleDraft[];
  blueprintMarksTotal: number;
  assignedItems: AssignedQuestionDraft[];
  assignedMarksTotal: number;
  onAddRule: () => void;
  onUpdateRule: (index: number, patch: Partial<BlueprintRuleDraft>) => void;
  onRemoveRule: (index: number) => void;
  onSaveBlueprint: () => void;
  onToggleAssigned: (question: QuestionDto) => void;
  onUpdateAssignedMarks: (questionId: string, marks: number) => void;
  onSaveAssigned: () => void;
}) {
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const filteredBank = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bankQuestions.filter(
      (item) =>
        (topicFilter === "ALL" || item.topic === topicFilter) &&
        (!q || `${item.prompt} ${item.topic}`.toLowerCase().includes(q)),
    );
  }, [bankQuestions, search, topicFilter]);

  const pagedBank = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredBank.slice(start, start + PAGE_SIZE);
  }, [filteredBank, page]);

  if (useStratifiedBlueprint) {
    return (
      <section className="card space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Stratified Fairness Blueprint Rules</h2>
            <p className="muted mt-1 text-sm">
              Each candidate receives a distinct set matching exact topic and difficulty quotas. Configured marks:{" "}
              <strong className="font-mono-tabular text-[var(--text-primary)]">{blueprintMarksTotal}</strong> /{" "}
              <span className="font-mono-tabular">{totalMarks}</span>
            </p>
          </div>
          {!isLocked ? (
            <button className="btn-secondary" onClick={onAddRule} type="button">
              <Plus size={16} /> Add stratum rule
            </button>
          ) : null}
        </div>

        <div className="space-y-3">
          {blueprintRules.map((rule, idx) => {
            const available = poolAvailability.get(`${rule.topic}::${rule.difficulty}`) ?? 0;
            const insufficient = available < rule.pickCount;
            return (
              <div
                className="grid items-end gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 md:grid-cols-5"
                key={`${rule.topic}-${rule.difficulty}-${idx}`}
              >
                <label className="text-xs font-bold">
                  Topic
                  <select
                    className="field mt-1"
                    disabled={isLocked}
                    onChange={(e) => onUpdateRule(idx, { topic: e.target.value })}
                    value={rule.topic}
                  >
                    {bankTopics.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-bold">
                  Difficulty
                  <select
                    className="field mt-1"
                    disabled={isLocked}
                    onChange={(e) => onUpdateRule(idx, { difficulty: e.target.value as Difficulty })}
                    value={rule.difficulty}
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </label>

                <label className="text-xs font-bold">
                  Pick count (pool: {available})
                  <input
                    className="field font-mono-tabular mt-1"
                    disabled={isLocked}
                    min={1}
                    onChange={(e) => onUpdateRule(idx, { pickCount: Math.max(1, Number(e.target.value) || 1) })}
                    type="number"
                    value={rule.pickCount}
                  />
                </label>

                <label className="text-xs font-bold">
                  Marks each
                  <input
                    className="field font-mono-tabular mt-1"
                    disabled={isLocked}
                    min={0.5}
                    onChange={(e) => onUpdateRule(idx, { marksEach: Math.max(0.5, Number(e.target.value) || 0.5) })}
                    step="0.5"
                    type="number"
                    value={rule.marksEach}
                  />
                </label>

                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono-tabular text-xs font-bold ${
                      insufficient ? "text-[var(--status-danger-text)]" : "text-[var(--status-success-text)]"
                    }`}
                  >
                    {insufficient ? `Short by ${rule.pickCount - available}` : `Subtotal: ${rule.pickCount * rule.marksEach}`}
                  </span>
                  {!isLocked ? (
                    <button
                      aria-label="Remove blueprint rule"
                      className="btn-danger h-9 px-2.5"
                      onClick={() => onRemoveRule(idx)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}

          {blueprintRules.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-8 text-center text-sm text-[var(--text-secondary)]">
              No blueprint rules configured yet. Add stratum rules matching your question bank topics.
            </p>
          ) : null}
        </div>

        {!isLocked ? (
          <div className="flex justify-end border-t border-[var(--border-subtle)] pt-4">
            <button className="btn-primary" disabled={busy} onClick={onSaveBlueprint} type="button">
              {busy ? "Saving…" : "Save blueprint rules"}
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="card overflow-hidden">
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Fixed Question Selection</h2>
            <p className="muted mt-1 text-sm">
              Selected: <strong className="font-mono-tabular">{assignedItems.length}</strong> questions · Marks sum:{" "}
              <strong className="font-mono-tabular">{assignedMarksTotal}</strong> /{" "}
              <span className="font-mono-tabular">{totalMarks}</span>
            </p>
          </div>
          {!isLocked ? (
            <button className="btn-primary" disabled={busy} onClick={onSaveAssigned} type="button">
              {busy ? "Saving…" : "Save assigned questions"}
            </button>
          ) : null}
        </div>

        <DataTableToolbar
          filters={
            <select
              aria-label="Filter question pool by topic"
              className="field w-auto min-w-36"
              onChange={(event) => {
                setTopicFilter(event.target.value);
                setPage(1);
              }}
              value={topicFilter}
            >
              <option value="ALL">All topics</option>
              {bankTopics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          }
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          search={search}
          searchLabel="Search question bank"
          searchPlaceholder="Filter available questions…"
        />

        <div className="space-y-2">
          {pagedBank.map((q) => {
            const selected = assignedItems.find((item) => item.questionId === q.id);
            return (
              <div
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
                  selected
                    ? "border-[var(--accent-primary)] bg-[var(--accent-soft)]/50"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                }`}
                key={q.id}
              >
                <label className="flex flex-1 cursor-pointer items-start gap-3">
                  <input
                    checked={Boolean(selected)}
                    className="mt-1"
                    disabled={isLocked}
                    onChange={() => onToggleAssigned(q)}
                    type="checkbox"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{q.prompt}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span>{q.topic}</span>
                      <StatusBadge status={q.difficulty} />
                      <span>{q.type.replaceAll("_", " ")}</span>
                    </div>
                  </div>
                </label>
                {selected ? (
                  <label className="flex items-center gap-2 text-xs font-bold">
                    Marks
                    <input
                      className="field font-mono-tabular h-9 w-20 py-1 text-xs"
                      disabled={isLocked}
                      min={0.5}
                      onChange={(e) => onUpdateAssignedMarks(q.id, Math.max(0.5, Number(e.target.value) || 0.5))}
                      step="0.5"
                      type="number"
                      value={selected.marks}
                    />
                  </label>
                ) : (
                  <span className="font-mono-tabular text-xs text-[var(--text-muted)]">Default {q.maxMarks}m</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <PaginationControls
        limit={PAGE_SIZE}
        onPageChange={setPage}
        page={page}
        total={filteredBank.length}
      />
    </section>
  );
}
