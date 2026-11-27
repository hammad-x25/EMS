import { AlertTriangle, CheckCircle2, Flag, X } from "lucide-react";
import type { AttemptQuestionDto } from "@/lib/attempts";

export function ReviewSubmitModal({
  open,
  questions,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  questions: AttemptQuestionDto[];
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;
  const answered = questions.filter((question) => Boolean(question.answer?.selectedIds?.length || question.answer?.writtenText?.trim())).length;
  const marked = questions.filter((question) => question.answer?.markedForReview).length;
  const unanswered = questions.length - answered;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="review-submit-title">
      <section className="card w-full max-w-lg p-6">
        <div className="flex items-start justify-between">
          <div><p className="eyebrow">Final check</p><h2 className="mt-1 text-xl font-black" id="review-submit-title">Review &amp; submit</h2></div>
          <button aria-label="Close review" className="rounded-lg p-2 hover:bg-slate-100" onClick={onClose} type="button"><X size={20} /></button>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-emerald-50 p-4"><CheckCircle2 className="mx-auto text-emerald-600" /><p className="mt-2 text-2xl font-black">{answered}</p><p className="text-xs">Answered</p></div>
          <div className="rounded-xl bg-slate-100 p-4"><AlertTriangle className="mx-auto text-slate-600" /><p className="mt-2 text-2xl font-black">{unanswered}</p><p className="text-xs">Unanswered</p></div>
          <div className="rounded-xl bg-amber-50 p-4"><Flag className="mx-auto text-amber-600" /><p className="mt-2 text-2xl font-black">{marked}</p><p className="text-xs">For review</p></div>
        </div>
        {unanswered > 0 || marked > 0 ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">You can still return and review flagged or unanswered questions before final submission.</p> : null}
        <p className="mt-5 text-sm text-slate-600">Submission is final. Any safely queued local answers will be synchronized first.</p>
        <div className="mt-6 flex justify-end gap-3"><button className="btn-secondary" disabled={busy} onClick={onClose} type="button">Return to exam</button><button className="btn-primary" disabled={busy} onClick={onSubmit} type="button">{busy ? "Submitting…" : "Confirm final submission"}</button></div>
      </section>
    </div>
  );
}
