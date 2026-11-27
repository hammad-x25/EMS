import { Cloud, CloudOff, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";

export type SyncState = "SYNCED" | "SAVING" | "OFFLINE_QUEUED" | "OFFLINE_IDLE" | "SYNC_ERROR";

export function NetworkStatusPill({
  state,
  queuedCount,
  onRetry,
}: {
  state: SyncState;
  queuedCount: number;
  onRetry: () => void;
}) {
  if (state === "SAVING") {
    return (
      <span
        className="status-pill border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]"
        role="status"
      >
        <LoaderCircle aria-hidden="true" className="animate-spin" size={13} />
        <span>Saving…</span>
      </span>
    );
  }

  if (state === "OFFLINE_QUEUED") {
    return (
      <span
        className="status-pill border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
        role="status"
      >
        <CloudOff aria-hidden="true" size={13} />
        <span>
          Offline — {queuedCount} answer{queuedCount === 1 ? "" : "s"} safely queued locally
        </span>
      </span>
    );
  }

  if (state === "OFFLINE_IDLE") {
    return (
      <span
        className="status-pill border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
        role="status"
      >
        <CloudOff aria-hidden="true" size={13} />
        <span>Offline — reconnection pending</span>
      </span>
    );
  }

  if (state === "SYNC_ERROR") {
    return (
      <button
        className="status-pill border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
        onClick={onRetry}
        type="button"
      >
        <TriangleAlert aria-hidden="true" size={13} />
        <span>Sync error</span>
        <RefreshCw aria-hidden="true" size={12} />
        <span>Retry now</span>
      </button>
    );
  }

  return (
    <span
      className="status-pill border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
      role="status"
    >
      <Cloud aria-hidden="true" size={13} />
      <span>Synced</span>
    </span>
  );
}
