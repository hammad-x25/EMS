export interface ShortcutContext {
  targetTagName?: string | null;
  isContentEditable?: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  hasOverlayOpen: boolean;
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Prevents live exam shortcuts (N/P/M) from triggering inside inputs, browser hotkeys, or open overlays.
 */
export function shouldIgnoreExamShortcut(context: ShortcutContext): boolean {
  if (context.hasOverlayOpen) return true;
  if (context.ctrlKey || context.metaKey || context.altKey) return true;
  if (context.isContentEditable) return true;
  const tag = context.targetTagName?.toUpperCase() ?? "";
  return EDITABLE_TAGS.has(tag);
}

export type TimerMilestone = "5m" | "1m" | null;

/**
 * Emits non-intrusive deadline cues once when crossing 5-minute (300s) or 1-minute (60s) thresholds.
 */
export function getTimerMilestone(previousSeconds: number | null, nextSeconds: number): TimerMilestone {
  if (previousSeconds === null || nextSeconds <= 0) return null;
  if (previousSeconds > 60 && nextSeconds <= 60) return "1m";
  if (previousSeconds > 300 && nextSeconds <= 300) return "5m";
  return null;
}

/**
 * Resolves the network sync pill state accurately even when the offline queue is empty.
 */
export function resolveOfflineSyncState(queuedCount: number): "OFFLINE_QUEUED" | "OFFLINE_IDLE" {
  return queuedCount > 0 ? "OFFLINE_QUEUED" : "OFFLINE_IDLE";
}
