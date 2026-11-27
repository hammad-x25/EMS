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
    <aside className="card h-fit p-4" aria-label="Question palette">
      <h2 className="font-black">Question palette</h2>
      <p className="mt-1 text-xs text-slate-500">N/P navigate · M marks for review</p>
      <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-7 lg:grid-cols-5">
        {questions.map((question, index) => {
          const selected = question.answer?.selectedIds?.length || question.answer?.writtenText?.trim();
          const marked = question.answer?.markedForReview ?? false;
          const Icon = selected && marked ? FlagTriangleRight : marked ? Flag : selected ? Check : Circle;
          const tone = selected && marked
            ? "border-violet-500 bg-violet-100 text-violet-900"
            : marked
              ? "border-amber-500 bg-amber-100 text-amber-900"
              : selected
                ? "border-emerald-500 bg-emerald-100 text-emerald-900"
                : "border-slate-300 bg-white text-slate-600";
          return (
            <button
              aria-current={activeIndex === index ? "step" : undefined}
              aria-label={`Question ${index + 1}: ${selected ? "answered" : "unanswered"}${marked ? ", marked for review" : ""}`}
              className={`flex aspect-square items-center justify-center gap-1 rounded-lg border-2 text-xs font-black ${tone} ${activeIndex === index ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
              key={question.snapshotId}
              onClick={() => onSelect(index)}
              type="button"
            >
              <Icon aria-hidden size={13} /> {index + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-5 space-y-2 text-xs text-slate-600">
        <p className="flex items-center gap-2"><Check className="text-emerald-600" size={13} /> Answered</p>
        <p className="flex items-center gap-2"><Circle size={13} /> Unanswered</p>
        <p className="flex items-center gap-2"><Flag className="text-amber-600" size={13} /> Marked for review</p>
        <p className="flex items-center gap-2"><FlagTriangleRight className="text-violet-600" size={13} /> Answered + review</p>
      </div>
    </aside>
  );
}
