"use client";

import { MultiSelectScoring } from "@prisma/client";
import type { FormEvent } from "react";
import { FormField } from "@/components/ui/FormField";

export function DetailsTab({
  isLocked,
  busy,
  title,
  instructions,
  scheduledStart,
  scheduledEnd,
  durationMinutes,
  totalMarks,
  passingMarks,
  multiSelectRule,
  negativeMarkRatio,
  useStratifiedBlueprint,
  shuffleQuestions,
  shuffleOptions,
  revealAnswersAfterPublish,
  fieldErrors,
  onTitleChange,
  onInstructionsChange,
  onScheduledStartChange,
  onScheduledEndChange,
  onDurationMinutesChange,
  onTotalMarksChange,
  onPassingMarksChange,
  onMultiSelectRuleChange,
  onNegativeMarkRatioChange,
  onUseStratifiedBlueprintChange,
  onShuffleQuestionsChange,
  onShuffleOptionsChange,
  onRevealAnswersAfterPublishChange,
  onSubmit,
}: {
  isLocked: boolean;
  busy: boolean;
  title: string;
  instructions: string;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: string;
  totalMarks: string;
  passingMarks: string;
  multiSelectRule: MultiSelectScoring;
  negativeMarkRatio: string;
  useStratifiedBlueprint: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  revealAnswersAfterPublish: boolean;
  fieldErrors: Record<string, string>;
  onTitleChange: (value: string) => void;
  onInstructionsChange: (value: string) => void;
  onScheduledStartChange: (value: string) => void;
  onScheduledEndChange: (value: string) => void;
  onDurationMinutesChange: (value: string) => void;
  onTotalMarksChange: (value: string) => void;
  onPassingMarksChange: (value: string) => void;
  onMultiSelectRuleChange: (value: MultiSelectScoring) => void;
  onNegativeMarkRatioChange: (value: string) => void;
  onUseStratifiedBlueprintChange: (value: boolean) => void;
  onShuffleQuestionsChange: (value: boolean) => void;
  onShuffleOptionsChange: (value: boolean) => void;
  onRevealAnswersAfterPublishChange: (value: boolean) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="card grid gap-4 p-6 md:grid-cols-2" onSubmit={onSubmit}>
      <FormField className="md:col-span-2" error={fieldErrors.title} label="Title" required>
        <input
          aria-invalid={Boolean(fieldErrors.title)}
          className="field"
          disabled={isLocked}
          onChange={(e) => onTitleChange(e.target.value)}
          required
          value={title}
        />
      </FormField>

      <FormField className="md:col-span-2" error={fieldErrors.instructions} label="Instructions" required>
        <textarea
          aria-invalid={Boolean(fieldErrors.instructions)}
          className="field min-h-24"
          disabled={isLocked}
          onChange={(e) => onInstructionsChange(e.target.value)}
          required
          value={instructions}
        />
      </FormField>

      <FormField error={fieldErrors.scheduledStart} label="Scheduled Start" required>
        <input
          aria-invalid={Boolean(fieldErrors.scheduledStart)}
          className="field"
          disabled={isLocked}
          onChange={(e) => onScheduledStartChange(e.target.value)}
          required
          type="datetime-local"
          value={scheduledStart}
        />
      </FormField>

      <FormField error={fieldErrors.scheduledEnd} label="Scheduled End" required>
        <input
          aria-invalid={Boolean(fieldErrors.scheduledEnd)}
          className="field"
          disabled={isLocked}
          onChange={(e) => onScheduledEndChange(e.target.value)}
          required
          type="datetime-local"
          value={scheduledEnd}
        />
      </FormField>

      <FormField error={fieldErrors.durationMinutes} label="Duration (minutes)" required>
        <input
          aria-invalid={Boolean(fieldErrors.durationMinutes)}
          className="field font-mono-tabular"
          disabled={isLocked}
          min={1}
          onChange={(e) => onDurationMinutesChange(e.target.value)}
          required
          type="number"
          value={durationMinutes}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField error={fieldErrors.totalMarks} label="Total marks" required>
          <input
            aria-invalid={Boolean(fieldErrors.totalMarks)}
            className="field font-mono-tabular"
            disabled={isLocked}
            min={1}
            onChange={(e) => onTotalMarksChange(e.target.value)}
            required
            step="0.5"
            type="number"
            value={totalMarks}
          />
        </FormField>
        <FormField error={fieldErrors.passingMarks} label="Passing marks" required>
          <input
            aria-invalid={Boolean(fieldErrors.passingMarks)}
            className="field font-mono-tabular"
            disabled={isLocked}
            min={0}
            onChange={(e) => onPassingMarksChange(e.target.value)}
            required
            step="0.5"
            type="number"
            value={passingMarks}
          />
        </FormField>
      </div>

      <FormField error={fieldErrors.multiSelectRule} label="Multi-select scoring">
        <select
          className="field"
          disabled={isLocked}
          onChange={(e) => onMultiSelectRuleChange(e.target.value as MultiSelectScoring)}
          value={multiSelectRule}
        >
          <option value="PARTIAL_NO_NEGATIVE">Partial credit (no negative)</option>
          <option value="ALL_OR_NOTHING">All or nothing</option>
          <option value="PARTIAL_WITH_NEGATIVE">Partial credit with negative penalty</option>
        </select>
      </FormField>

      <FormField error={fieldErrors.negativeMarkRatio} label="Wrong-answer negative ratio (0–1)">
        <input
          aria-invalid={Boolean(fieldErrors.negativeMarkRatio)}
          className="field font-mono-tabular"
          disabled={isLocked}
          max={1}
          min={0}
          onChange={(e) => onNegativeMarkRatioChange(e.target.value)}
          step="0.05"
          type="number"
          value={negativeMarkRatio}
        />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
        <label className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] p-3 text-sm font-semibold">
          <input
            checked={useStratifiedBlueprint}
            disabled={isLocked}
            onChange={(e) => onUseStratifiedBlueprintChange(e.target.checked)}
            type="checkbox"
          />
          <span>Use Stratified Fairness Blueprint (5.2)</span>
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] p-3 text-sm font-semibold">
          <input
            checked={shuffleQuestions}
            disabled={isLocked}
            onChange={(e) => onShuffleQuestionsChange(e.target.checked)}
            type="checkbox"
          />
          <span>Randomize question order per attempt</span>
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] p-3 text-sm font-semibold">
          <input
            checked={shuffleOptions}
            disabled={isLocked}
            onChange={(e) => onShuffleOptionsChange(e.target.checked)}
            type="checkbox"
          />
          <span>Randomize answer choices per attempt</span>
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] p-3 text-sm font-semibold">
          <input
            checked={revealAnswersAfterPublish}
            disabled={isLocked}
            onChange={(e) => onRevealAnswersAfterPublishChange(e.target.checked)}
            type="checkbox"
          />
          <span>Reveal answer keys after results publish</span>
        </label>
      </div>

      {!isLocked ? (
        <div className="flex justify-end border-t border-[var(--border-subtle)] pt-4 md:col-span-2">
          <button className="btn-primary" disabled={busy} type="submit">
            {busy ? "Saving…" : "Save details & rules"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
