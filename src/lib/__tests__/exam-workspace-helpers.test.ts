import { describe, expect, it } from "vitest";
import {
  getTimerMilestone,
  resolveOfflineSyncState,
  shouldIgnoreExamShortcut,
} from "@/lib/exam-workspace-helpers";

describe("exam workspace helpers", () => {
  it("ignores exam keyboard shortcuts inside fields, modifiers, or open overlays", () => {
    expect(
      shouldIgnoreExamShortcut({
        targetTagName: "TEXTAREA",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        hasOverlayOpen: false,
      }),
    ).toBe(true);

    expect(
      shouldIgnoreExamShortcut({
        targetTagName: "DIV",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        hasOverlayOpen: false,
      }),
    ).toBe(true);

    expect(
      shouldIgnoreExamShortcut({
        targetTagName: "BODY",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        hasOverlayOpen: true,
      }),
    ).toBe(true);

    expect(
      shouldIgnoreExamShortcut({
        targetTagName: "BUTTON",
        isContentEditable: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        hasOverlayOpen: false,
      }),
    ).toBe(false);
  });

  it("detects 5-minute and 1-minute countdown threshold crossings cleanly", () => {
    expect(getTimerMilestone(null, 290)).toBeNull();
    expect(getTimerMilestone(301, 300)).toBe("5m");
    expect(getTimerMilestone(299, 298)).toBeNull();
    expect(getTimerMilestone(61, 60)).toBe("1m");
    expect(getTimerMilestone(1, 0)).toBeNull();
  });

  it("distinguishes offline queued vs offline idle states", () => {
    expect(resolveOfflineSyncState(2)).toBe("OFFLINE_QUEUED");
    expect(resolveOfflineSyncState(0)).toBe("OFFLINE_IDLE");
  });
});
