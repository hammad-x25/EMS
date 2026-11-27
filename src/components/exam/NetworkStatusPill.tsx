import { Cloud, CloudOff, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";

export type SyncState = "SYNCED" | "SAVING" | "OFFLINE_QUEUED" | "SYNC_ERROR";

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
      <span className="status-pill bg-indigo-50 text-indigo-700" role="status">
        <LoaderCircle className="animate-spin" size={13} /> Saving…
      </span>
    );
  }
  if (state === "OFFLINE_QUEUED") {
    return (
      <span className="status-pill bg-amber-50 text-amber-800" role="status">
        <CloudOff size={13} /> Offline — {queuedCount} answer{queuedCount === 1 ? "" : "s"} safely queued locally
      </span>
    );
  }
  if (state === "SYNC_ERROR") {
    return (
      <button className="status-pill bg-rose-50 text-rose-800" onClick={onRetry} type="button">
        <TriangleAlert size={13} /> Sync error <RefreshCw size={12} /> Retry now
      </button>
    );
  }
  return (
    <span className="status-pill bg-emerald-50 text-emerald-700" role="status">
      <Cloud size={13} /> Synced
    </span>
  );
}
