import { Check, Circle, Flag, FlagTriangleRight } from "lucide-react";
import type { AttemptQuestionDto } from "@/lib/attempts";

export function QuestionPalette({
  questions,
  activeIndex,
  onSelect,
}: {
  questions: AttemptQuestionDto[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <aside aria-label="Question palette" className="card h-fit p-4">
      <h2 className="text-base font-bold text-[var(--text-primary)]">Question palette</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">N/P navigate · M marks for review</p>

      <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-7 lg:grid-cols-5">
        {questions.map((question, index) => {
          const selected = Boolean(question.answer?.selectedIds?.length || question.answer?.writtenText?.trim());
          const marked = question.answer?.markedForReview ?? false;
          const Icon = selected && marked ? FlagTriangleRight : marked ? Flag : selected ? Check : Circle;
          const tone =
            selected && marked
              ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-soft-text)]"
              : marked
                ? "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                : selected
                  ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                  : "border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)]";

          return (
            <button
              aria-current={activeIndex === index ? "step" : undefined}
              aria-label={`Question ${index + 1}: ${selected ? "answered" : "unanswered"}${marked ? ", marked for review" : ""}`}
              className={`font-mono-tabular flex aspect-square min-h-10 items-center justify-center gap-1 rounded-md border-2 text-xs font-bold ${tone} ${
                activeIndex === index ? "ring-2 ring-[var(--focus-ring)] ring-offset-2" : ""
              }`}
              key={question.snapshotId}
              onClick={() => onSelect(index)}
              type="button"
            >
              <Icon aria-hidden="true" size={12} />
              <span>{index + 1}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-2 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-secondary)]">
        <p className="flex items-center gap-2">
          <Check aria-hidden="true" className="text-[var(--status-success-text)]" size={13} /> Answered
        </p>
        <p className="flex items-center gap-2">
          <Circle aria-hidden="true" className="text-[var(--text-muted)]" size={13} /> Unanswered
        </p>
        <p className="flex items-center gap-2">
          <Flag aria-hidden="true" className="text-[var(--status-warning-text)]" size={13} /> Marked for review
        </p>
        <p className="flex items-center gap-2">
          <FlagTriangleRight aria-hidden="true" className="text-[var(--accent-soft-text)]" size={13} /> Answered + review
        </p>
      </div>
    </aside>
  );
}
