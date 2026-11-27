import { BellRing, Clock3, FileCheck2, Settings2, StickyNote } from "lucide-react";
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
  announcementCount,
  onRetry,
  onOpenSettings,
  onOpenScratchpad,
  onOpenAnnouncements,
  onReview,
}: {
  title: string;
  remainingSeconds: number;
  hideTimer: boolean;
  syncState: SyncState;
  queuedCount: number;
  announcementCount: number;
  onRetry: () => void;
  onOpenSettings: () => void;
  onOpenScratchpad: () => void;
  onOpenAnnouncements: () => void;
  onReview: () => void;
}) {
  const timerTone =
    remainingSeconds < 60
      ? "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
      : remainingSeconds < 300
        ? "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
        : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]";

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 shadow-xs">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Examination workspace</p>
          <h1 className="truncate text-base font-bold text-[var(--text-primary)] sm:text-lg">{title}</h1>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <NetworkStatusPill onRetry={onRetry} queuedCount={queuedCount} state={syncState} />

          {!hideTimer ? (
            <span
              aria-label={`${remainingSeconds} seconds remaining`}
              className={`status-pill ${timerTone}`}
            >
              <Clock3 aria-hidden="true" size={14} />
              <span className="font-mono-tabular text-sm font-bold">{formatRemaining(remainingSeconds)}</span>
            </span>
          ) : (
            <span className="status-pill border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
              Timer hidden
            </span>
          )}

          {announcementCount > 0 ? (
            <button
              aria-label={`View announcements (${announcementCount})`}
              className="btn-secondary h-9 px-2.5 text-xs"
              onClick={onOpenAnnouncements}
              type="button"
            >
              <BellRing aria-hidden="true" size={15} />
              <span className="hidden md:inline">Notices</span>
              <span className="font-mono-tabular rounded-full bg-[var(--accent-soft)] px-1.5 text-xs font-bold text-[var(--accent-soft-text)]">
                {announcementCount}
              </span>
            </button>
          ) : null}

          <button
            aria-label="Workspace settings"
            className="btn-secondary h-9 px-2.5 text-xs sm:px-3"
            onClick={onOpenSettings}
            type="button"
          >
            <Settings2 aria-hidden="true" size={15} />
            <span className="hidden sm:inline">Settings</span>
          </button>

          <button
            aria-label="Open digital scratchpad"
            className="btn-secondary h-9 px-2.5 text-xs sm:px-3"
            onClick={onOpenScratchpad}
            type="button"
          >
            <StickyNote aria-hidden="true" size={15} />
            <span className="hidden sm:inline">Scratchpad</span>
          </button>

          <button className="btn-primary h-9 px-3 text-xs sm:px-3.5 sm:text-sm" onClick={onReview} type="button">
            <FileCheck2 aria-hidden="true" size={15} />
            <span>Review &amp; Submit</span>
          </button>
        </div>
      </div>
    </header>
  );
}
