import { Clock3, FileCheck2, Settings2, StickyNote } from "lucide-react";
import { NetworkStatusPill, type SyncState } from "@/components/exam/NetworkStatusPill";

function formatRemaining(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function ExamHeader({
  title,
  remainingSeconds,
  hideTimer,
  syncState,
  queuedCount,
  onRetry,
  onOpenSettings,
  onOpenScratchpad,
  onReview,
}: {
  title: string;
  remainingSeconds: number;
  hideTimer: boolean;
  syncState: SyncState;
  queuedCount: number;
  onRetry: () => void;
  onOpenSettings: () => void;
  onOpenScratchpad: () => void;
  onReview: () => void;
}) {
  const timerTone = remainingSeconds < 60
    ? "bg-rose-100 text-rose-800"
    : remainingSeconds < 300
      ? "bg-amber-100 text-amber-800"
      : "bg-slate-100 text-slate-700";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Examination workspace</p>
          <h1 className="truncate text-lg font-black">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <NetworkStatusPill onRetry={onRetry} queuedCount={queuedCount} state={syncState} />
          {!hideTimer ? (
            <span className={`status-pill ${timerTone}`} aria-label={`${remainingSeconds} seconds remaining`}>
              <Clock3 size={14} />
              <span className="font-mono text-sm tabular-nums">{formatRemaining(remainingSeconds)}</span>
            </span>
          ) : (
            <span className="status-pill bg-slate-100 text-slate-600">Timer hidden</span>
          )}
          <button aria-label="Workspace settings" className="btn-secondary px-3 py-2" onClick={onOpenSettings} type="button">
            <Settings2 size={16} /> <span className="hidden sm:inline">Settings</span>
          </button>
          <button aria-label="Open digital scratchpad" className="btn-secondary px-3 py-2" onClick={onOpenScratchpad} type="button">
            <StickyNote size={16} /> <span className="hidden sm:inline">Scratchpad</span>
          </button>
          <button className="btn-primary px-3 py-2" onClick={onReview} type="button">
            <FileCheck2 size={16} /> Review &amp; Submit
          </button>
        </div>
      </div>
    </header>
  );
}
