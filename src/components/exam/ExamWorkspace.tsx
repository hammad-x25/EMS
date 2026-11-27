"use client";

/* eslint-disable react-hooks/exhaustive-deps -- mutable refs deliberately keep timers and queue retries on the latest attempt state */

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BellRing, CheckCircle2, Flag, RotateCcw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { ExamHeader } from "@/components/exam/ExamHeader";
import { type SyncState } from "@/components/exam/NetworkStatusPill";
import { QuestionPalette } from "@/components/exam/QuestionPalette";
import { ReviewSubmitModal } from "@/components/exam/ReviewSubmitModal";
import { ScratchpadDrawer } from "@/components/exam/ScratchpadDrawer";
import { WorkspacePreferencesDrawer } from "@/components/exam/WorkspacePreferencesDrawer";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Drawer } from "@/components/ui/Drawer";
import type { AttemptDto, AttemptQuestionDto } from "@/lib/attempts";
import {
  getTimerMilestone,
  resolveOfflineSyncState,
  shouldIgnoreExamShortcut,
} from "@/lib/exam-workspace-helpers";
import {
  clearAttemptLocalData,
  getQueuedMutations,
  queueAnswerMutation,
  removeAcknowledgedMutations,
  type QueuedAnswerMutation,
} from "@/lib/offline-queue";
import type { WorkspacePreferences } from "@/lib/preferences";

const defaultPreferences: WorkspacePreferences = {
  fontSize: "md",
  theme: "light",
  palettePos: "right",
  compactMode: false,
  hideTimer: false,
};

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return fallback;
}

function mergeQueued(attempt: AttemptDto, queued: QueuedAnswerMutation[]): AttemptDto {
  const bySnapshot = new Map(queued.map((mutation) => [mutation.snapshotId, mutation]));
  return {
    ...attempt,
    questions: attempt.questions.map((question) => {
      const mutation = bySnapshot.get(question.snapshotId);
      if (!mutation || (question.answer?.clientSeq ?? -1) >= mutation.clientSeq) return question;
      return {
        ...question,
        answer: {
          selectedIds: mutation.selectedIds ?? null,
          writtenText: mutation.writtenText ?? null,
          markedForReview: mutation.markedForReview,
          clientSeq: mutation.clientSeq,
          savedAt: mutation.capturedAt,
        },
      };
    }),
  };
}

export function ExamWorkspace({ examId, mode }: { examId: string; mode: "candidate" | "sandbox" }) {
  const attemptRef = useRef<AttemptDto | null>(null);
  const flushInFlightRef = useRef(false);
  const clientSeqRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(1000);
  const submitInFlightRef = useRef(false);

  const syncStateRef = useRef<SyncState>("SYNCED");
  const queuedCountRef = useRef(0);
  const prevRemainingRef = useRef<number | null>(null);
  const writtenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWrittenRef = useRef<{ snapshotId: string; writtenText: string; markedForReview: boolean; selectedIds: string[] | null } | null>(null);

  const [attempt, setAttemptState] = useState<AttemptDto | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [syncState, setSyncStateValue] = useState<SyncState>("SYNCED");
  const [queuedCount, setQueuedCountValue] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [milestoneNotice, setMilestoneNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function setSyncState(next: SyncState) {
    syncStateRef.current = next;
    setSyncStateValue(next);
  }

  function setQueuedCount(next: number) {
    queuedCountRef.current = next;
    setQueuedCountValue(next);
  }

  function setAttempt(next: AttemptDto | null | ((current: AttemptDto | null) => AttemptDto | null)) {
    setAttemptState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      attemptRef.current = value;
      return value;
    });
  }

  async function flushQueue(attemptId = attemptRef.current?.id): Promise<boolean> {
    if (!attemptId || flushInFlightRef.current) return false;
    flushInFlightRef.current = true;
    try {
      if (!navigator.onLine) {
        const queued = await getQueuedMutations(attemptId);
        setQueuedCount(queued.length);
        setSyncState(resolveOfflineSyncState(queued.length));
        return false;
      }
      const queued = await getQueuedMutations(attemptId);
      setQueuedCount(queued.length);
      if (queued.length === 0) {
        setSyncState("SYNCED");
        return true;
      }
      setSyncState("SAVING");
      try {
        const response = await fetch(`/api/attempts/${attemptId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mutations: queued }),
        });
        const body = (await response.json().catch(() => null)) as { attempt?: AttemptDto } | null;
        if (!response.ok || !body?.attempt) throw new Error(errorMessage(body, "Unable to synchronize answers"));
        await removeAcknowledgedMutations(attemptId, queued);
        const remaining = await getQueuedMutations(attemptId);
        setQueuedCount(remaining.length);
        setAttempt(mergeQueued(body.attempt, remaining));
        setServerOffsetMs(new Date(body.attempt.serverNow).getTime() - Date.now());
        retryDelayRef.current = 1000;
        setSyncState(remaining.length === 0 ? "SYNCED" : "SAVING");
        return remaining.length === 0;
      } catch (syncError: unknown) {
        const pending = await getQueuedMutations(attemptId);
        setQueuedCount(pending.length);
        if (!navigator.onLine) {
          setSyncState(resolveOfflineSyncState(pending.length));
        } else {
          setSyncState("SYNC_ERROR");
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            void flushQueue(attemptId);
          }, retryDelayRef.current);
          retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30_000);
        }
        console.warn(syncError);
        return false;
      }
    } finally {
      flushInFlightRef.current = false;
      const remaining = await getQueuedMutations(attemptId);
      if (remaining.length > 0 && navigator.onLine && !retryTimerRef.current) {
        window.setTimeout(() => void flushQueue(attemptId), 50);
      }
    }
  }

  async function flushPendingWritten(triggerNetwork = true): Promise<void> {
    if (writtenTimerRef.current) {
      clearTimeout(writtenTimerRef.current);
      writtenTimerRef.current = null;
    }
    const pending = pendingWrittenRef.current;
    const currentAttempt = attemptRef.current;
    if (!pending || !currentAttempt || currentAttempt.status !== "IN_PROGRESS") return;
    pendingWrittenRef.current = null;

    const mutation: QueuedAnswerMutation = {
      snapshotId: pending.snapshotId,
      selectedIds: pending.selectedIds,
      writtenText: pending.writtenText,
      markedForReview: pending.markedForReview,
      clientSeq: ++clientSeqRef.current,
      capturedAt: new Date().toISOString(),
    };
    await queueAnswerMutation(currentAttempt.id, mutation);
    const queued = await getQueuedMutations(currentAttempt.id);
    setQueuedCount(queued.length);
    if (!navigator.onLine) {
      setSyncState(resolveOfflineSyncState(queued.length));
    } else if (triggerNetwork) {
      await flushQueue(currentAttempt.id);
    }
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(mode === "sandbox" ? `/api/exams/${examId}/sandbox` : `/api/exams/${examId}/start`, {
          method: "POST",
        });
        const body = (await response.json().catch(() => null)) as { attempt?: AttemptDto } | null;
        if (!response.ok || !body?.attempt) throw new Error(errorMessage(body, "Unable to open this examination"));
        const queued = await getQueuedMutations(body.attempt.id);
        if (!active) return;
        clientSeqRef.current = Math.max(body.attempt.lastClientSeq, ...queued.map((item) => item.clientSeq), 0);
        setQueuedCount(queued.length);
        setAttempt(mergeQueued(body.attempt, queued));
        setServerOffsetMs(new Date(body.attempt.serverNow).getTime() - Date.now());
        if (!navigator.onLine) {
          setSyncState(resolveOfflineSyncState(queued.length));
        } else if (queued.length > 0) {
          setSyncState("SAVING");
          void flushQueue(body.attempt.id);
        } else {
          setSyncState("SYNCED");
        }
      } catch (initialError: unknown) {
        if (active) setError(initialError instanceof Error ? initialError.message : "Unable to open this examination");
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [examId, mode]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("aegis-workspace-preferences");
      if (saved) setPreferences({ ...defaultPreferences, ...(JSON.parse(saved) as Partial<WorkspacePreferences>) });
    } catch {
      /* retain safe defaults */
    }
    void fetch("/api/preferences").then(async (response) => {
      if (!response.ok) return;
      const body = (await response.json()) as { preferences: WorkspacePreferences };
      setPreferences(body.preferences);
      localStorage.setItem("aegis-workspace-preferences", JSON.stringify(body.preferences));
    });
  }, []);

  useEffect(() => {
    if (!attempt) return;
    prevRemainingRef.current = null;
    const update = () => {
      const serverNow = Date.now() + serverOffsetMs;
      const seconds = Math.max(0, Math.ceil((new Date(attempt.effectiveDeadlineAt).getTime() - serverNow) / 1000));
      const milestone = getTimerMilestone(prevRemainingRef.current, seconds);
      prevRemainingRef.current = seconds;
      if (milestone === "5m") {
        setMilestoneNotice("5 minutes remaining before your examination window closes.");
      } else if (milestone === "1m") {
        setMilestoneNotice("1 minute remaining — check unanswered items and prepare for submission.");
      }
      setRemainingSeconds(seconds);
      if (seconds === 0 && attemptRef.current?.status === "IN_PROGRESS") void finalizeAttempt();
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.effectiveDeadlineAt, attempt?.id, serverOffsetMs]);

  useEffect(() => {
    const attemptId = attempt?.id;
    if (!attemptId || attempt.status !== "IN_PROGRESS") return;

    const heartbeat = async () => {
      if (!navigator.onLine || flushInFlightRef.current) return;
      try {
        const response = await fetch(`/api/attempts/${attemptId}/heartbeat`, { method: "POST" });
        const body = (await response.json().catch(() => null)) as { attempt?: AttemptDto } | null;
        if (!response.ok || !body?.attempt) return;
        setServerOffsetMs(new Date(body.attempt.serverNow).getTime() - Date.now());
        setAttempt((current) =>
          current
            ? {
                ...current,
                status: body.attempt!.status,
                submittedAt: body.attempt!.submittedAt,
                effectiveDeadlineAt: body.attempt!.effectiveDeadlineAt,
                announcements: body.attempt!.announcements,
                serverNow: body.attempt!.serverNow,
              }
            : body.attempt!,
        );
      } catch {
        /* answer queue owns visible connection state */
      }
    };

    const heartbeatTimer = window.setInterval(() => void heartbeat(), 10_000);
    const reconnectProbe = window.setInterval(() => {
      if (
        navigator.onLine &&
        (syncStateRef.current === "OFFLINE_QUEUED" ||
          syncStateRef.current === "OFFLINE_IDLE" ||
          syncStateRef.current === "SYNC_ERROR")
      ) {
        void flushPendingWritten(false).then(() => flushQueue(attemptId));
      }
    }, 5_000);

    const online = () => {
      void flushPendingWritten(false).then(() => flushQueue(attemptId));
    };
    const offline = () => {
      setSyncState(resolveOfflineSyncState(queuedCountRef.current));
    };

    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.clearInterval(heartbeatTimer);
      window.clearInterval(reconnectProbe);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [attempt?.id, attempt?.status]);

  useEffect(() => {
    if (mode !== "candidate" || !attempt?.id || attempt.status !== "IN_PROGRESS") return;
    const source = new EventSource(`/api/exams/${examId}/stream`);
    const announcement = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as { payload?: { id?: string; message?: string }; occurredAt?: string };
      if (!event.payload?.id || !event.payload.message) return;
      const payload = { id: event.payload.id, message: event.payload.message };
      setAttempt((current) =>
        current
          ? {
              ...current,
              announcements: current.announcements.some((item) => item.id === payload.id)
                ? current.announcements
                : [...current.announcements, { ...payload, createdAt: event.occurredAt ?? new Date().toISOString() }],
            }
          : current,
      );
    };
    const extended = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as { payload?: { effectiveDeadlineAt?: string; totalExtensionMinutes?: number } };
      if (!event.payload?.effectiveDeadlineAt) return;
      setAttempt((current) =>
        current
          ? {
              ...current,
              effectiveDeadlineAt: event.payload!.effectiveDeadlineAt!,
              timeExtensionMinutes: event.payload!.totalExtensionMinutes ?? current.timeExtensionMinutes,
            }
          : current,
      );
    };
    const snapshot = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as {
        serverNow?: string;
        attempt?: { effectiveDeadlineAt?: string; timeExtensionMinutes?: number; status?: AttemptDto["status"] };
        announcements?: AttemptDto["announcements"];
      };
      if (event.serverNow) setServerOffsetMs(new Date(event.serverNow).getTime() - Date.now());
      setAttempt((current) =>
        current
          ? {
              ...current,
              effectiveDeadlineAt: event.attempt?.effectiveDeadlineAt ?? current.effectiveDeadlineAt,
              timeExtensionMinutes: event.attempt?.timeExtensionMinutes ?? current.timeExtensionMinutes,
              status: event.attempt?.status ?? current.status,
              announcements: event.announcements ?? current.announcements,
            }
          : current,
      );
    };
    source.addEventListener("ANNOUNCEMENT", announcement as EventListener);
    source.addEventListener("TIME_EXTENDED", extended as EventListener);
    source.addEventListener("SNAPSHOT", snapshot as EventListener);
    return () => source.close();
  }, [attempt?.id, attempt?.status, examId, mode]);

  useEffect(() => {
    const attemptId = attempt?.id;
    if (!attemptId || attempt.status !== "IN_PROGRESS") return;
    const report = (eventType: "TAB_BLUR" | "FULLSCREEN_EXIT" | "PASTE_ATTEMPT") => {
      void fetch(`/api/attempts/${attemptId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType }),
        keepalive: true,
      }).catch(() => undefined);
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") report("TAB_BLUR");
    };
    const fullscreen = () => {
      if (!document.fullscreenElement) report("FULLSCREEN_EXIT");
    };
    const paste = () => report("PASTE_ATTEMPT");
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", fullscreen);
    document.addEventListener("paste", paste);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", fullscreen);
      document.removeEventListener("paste", paste);
    };
  }, [attempt?.id, attempt?.status]);

  useEffect(() => {
    if (!attempt || attempt.status !== "IN_PROGRESS") return;
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const ignored = shouldIgnoreExamShortcut({
        targetTagName: target?.tagName,
        isContentEditable: target?.isContentEditable,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        hasOverlayOpen: settingsOpen || scratchpadOpen || reviewOpen || announcementsOpen,
      });
      if (ignored) return;
      const key = event.key.toLowerCase();
      if (key === "n") navigateQuestion(Math.min(attempt.questions.length - 1, activeIndex + 1));
      if (key === "p") navigateQuestion(Math.max(0, activeIndex - 1));
      if (key === "m") {
        event.preventDefault();
        const question = attemptRef.current?.questions[activeIndex];
        if (question) void updateAnswer(question, { markedForReview: !(question.answer?.markedForReview ?? false) });
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [activeIndex, attempt?.id, attempt?.status, settingsOpen, scratchpadOpen, reviewOpen, announcementsOpen]);

  useEffect(
    () => () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (writtenTimerRef.current) clearTimeout(writtenTimerRef.current);
    },
    [],
  );

  function navigateQuestion(nextIndex: number) {
    void flushPendingWritten();
    setActiveIndex(nextIndex);
  }

  async function updateAnswer(
    question: AttemptQuestionDto,
    patch: { selectedIds?: string[]; writtenText?: string; markedForReview?: boolean },
  ) {
    const currentAttempt = attemptRef.current;
    if (!currentAttempt || currentAttempt.status !== "IN_PROGRESS") return;

    // Debounce frequent network sync on written textarea keystrokes while preserving instant React state + flush on leave/submit.
    if (patch.writtenText !== undefined && patch.selectedIds === undefined && patch.markedForReview === undefined) {
      const nextWritten = patch.writtenText;
      const marked = question.answer?.markedForReview ?? false;
      const selectedIds = question.answer?.selectedIds ?? null;
      setAttempt((current) =>
        current
          ? {
              ...current,
              questions: current.questions.map((item) =>
                item.snapshotId === question.snapshotId
                  ? {
                      ...item,
                      answer: {
                        selectedIds,
                        writtenText: nextWritten,
                        markedForReview: marked,
                        clientSeq: clientSeqRef.current + 1,
                        savedAt: new Date().toISOString(),
                      },
                    }
                  : item,
              ),
            }
          : current,
      );
      pendingWrittenRef.current = {
        snapshotId: question.snapshotId,
        writtenText: nextWritten,
        markedForReview: marked,
        selectedIds,
      };
      if (writtenTimerRef.current) clearTimeout(writtenTimerRef.current);
      writtenTimerRef.current = setTimeout(() => {
        void flushPendingWritten();
      }, 220);
      return;
    }

    await flushPendingWritten(false);

    const mutation: QueuedAnswerMutation = {
      snapshotId: question.snapshotId,
      selectedIds: patch.selectedIds ?? question.answer?.selectedIds ?? null,
      writtenText: patch.writtenText ?? question.answer?.writtenText ?? null,
      markedForReview: patch.markedForReview ?? question.answer?.markedForReview ?? false,
      clientSeq: ++clientSeqRef.current,
      capturedAt: new Date().toISOString(),
    };
    setAttempt((current) => (current ? mergeQueued(current, [mutation]) : current));
    await queueAnswerMutation(currentAttempt.id, mutation);
    const queued = await getQueuedMutations(currentAttempt.id);
    setQueuedCount(queued.length);
    if (!navigator.onLine) setSyncState(resolveOfflineSyncState(queued.length));
    else void flushQueue(currentAttempt.id);
  }

  async function finalizeAttempt() {
    const current = attemptRef.current;
    if (!current || submitInFlightRef.current || current.status !== "IN_PROGRESS") return;
    submitInFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await flushPendingWritten(false);
      let pending = await getQueuedMutations(current.id);
      for (let attemptNumber = 0; attemptNumber < 3 && pending.length > 0 && navigator.onLine; attemptNumber += 1) {
        await flushQueue(current.id);
        await new Promise((resolve) => window.setTimeout(resolve, 100));
        pending = await getQueuedMutations(current.id);
      }
      if (pending.length > 0 && !automatic) {
        throw new Error("Reconnect and synchronize queued answers before final submission.");
      }
      const response = await fetch(`/api/attempts/${current.id}/submit`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { attempt?: AttemptDto } | null;
      if (!response.ok || !body?.attempt) throw new Error(errorMessage(body, "Unable to submit this attempt"));
      await removeAcknowledgedMutations(current.id, pending);
      setQueuedCount(0);
      setSyncState("SYNCED");
      setAttempt(body.attempt);
      setReviewOpen(false);
    } catch (submitError: unknown) {
      const pending = await getQueuedMutations(current.id);
      setQueuedCount(pending.length);
      if (pending.length > 0) setSyncState(navigator.onLine ? "SYNC_ERROR" : "OFFLINE_QUEUED");
      setError(submitError instanceof Error ? submitError.message : "Unable to submit this attempt");
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  function changePreferences(patch: Partial<WorkspacePreferences>) {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem("aegis-workspace-preferences", JSON.stringify(next));
      return next;
    });
    void fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => undefined);
  }

  async function resetSandbox() {
    setResetting(true);
    try {
      const response = await fetch(`/api/exams/${examId}/sandbox`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to reset sandbox");
      if (attemptRef.current) await clearAttemptLocalData(attemptRef.current.id);
      window.location.reload();
    } catch (resetError: unknown) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset sandbox");
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="card mx-auto max-w-xl p-8 text-center">
          <p className="font-bold text-[var(--text-primary)]">Preparing your secure paper…</p>
          <p className="muted mt-2 text-sm">
            Generating immutable question snapshots and synchronizing the server clock.
          </p>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="p-6">
        <div className="card mx-auto max-w-xl space-y-4 p-8">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Examination unavailable</h1>
          <AlertBanner variant="error">{error ?? "Unable to load examination attempt."}</AlertBanner>
          <div className="flex flex-wrap gap-3">
            <Link
              className="btn-secondary"
              href={mode === "sandbox" ? `/examiner/exams/${examId}` : "/candidate/dashboard"}
            >
              Return
            </Link>
            {mode === "sandbox" ? (
              <button
                className="btn-primary"
                disabled={resetting}
                onClick={() => void resetSandbox()}
                type="button"
              >
                <RotateCcw size={16} /> {resetting ? "Resetting…" : "Reset sandbox attempt"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const question = attempt.questions[activeIndex];
  const palette = <QuestionPalette activeIndex={activeIndex} onSelect={navigateQuestion} questions={attempt.questions} />;
  const themeClass =
    preferences.theme === "dark"
      ? "exam-theme-dark"
      : preferences.theme === "high-contrast"
        ? "exam-theme-contrast"
        : "";
  const fontClass =
    preferences.fontSize === "sm" ? "text-sm" : preferences.fontSize === "lg" ? "text-lg" : "text-base";
  const spacing = preferences.compactMode ? "gap-3 p-3" : "gap-6 p-4 lg:p-8";

  if (attempt.status !== "IN_PROGRESS") {
    const answeredCount = attempt.questions.filter((q) =>
      Boolean(q.answer?.selectedIds?.length || q.answer?.writtenText?.trim()),
    ).length;
    return (
      <div className={`min-h-screen p-6 ${themeClass} ${fontClass}`}>
        <div className="card mx-auto max-w-xl space-y-5 p-8 text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto text-[var(--status-success-text)]" size={48} />
          <div>
            <p className="eyebrow">Attempt finalized</p>
            <h1 className="mt-1 text-2xl font-extrabold text-[var(--text-primary)]">
              {attempt.status === "SUBMITTED" ? "Submission received" : "Time has expired"}
            </h1>
            <p className="muted mt-2 text-sm">
              Your final responses for <strong>{attempt.examTitle}</strong> are sealed on the server. Grading and result publication are handled separately.
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 text-left text-xs sm:grid-cols-3">
            <div>
              <dt className="text-[var(--text-muted)]">Attempt reference</dt>
              <dd className="font-mono-tabular mt-0.5 truncate font-bold text-[var(--text-primary)]" title={attempt.id}>
                {attempt.id}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Recorded responses</dt>
              <dd className="font-mono-tabular mt-0.5 font-bold text-[var(--text-primary)]">
                {answeredCount} / {attempt.questions.length}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Finalized at</dt>
              <dd className="font-mono-tabular mt-0.5 font-bold text-[var(--text-primary)]">
                {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "Recorded"}
              </dd>
            </div>
          </dl>

          <div className="space-y-3 pt-2">
            <Link
              className="btn-primary w-full"
              href={mode === "sandbox" ? `/examiner/exams/${examId}` : "/candidate/dashboard"}
            >
              Return to {mode === "sandbox" ? "exam builder" : "my examinations"}
            </Link>
            {mode === "sandbox" ? (
              <button
                className="btn-secondary w-full"
                disabled={resetting}
                onClick={() => void resetSandbox()}
                type="button"
              >
                <RotateCcw size={16} /> {resetting ? "Resetting…" : "Reset sandbox attempt"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClass} ${fontClass}`}>
      {mode === "sandbox" ? (
        <div className="flex flex-wrap items-center justify-center gap-2 bg-amber-300 px-4 py-2 text-center text-sm font-bold text-amber-950">
          <ShieldAlert aria-hidden="true" size={17} />
          <span>SANDBOX PREVIEW MODE — Does not affect real submissions or analytics</span>
          <button
            className="rounded-md border border-amber-900 bg-amber-200/80 px-2.5 py-1 text-xs font-bold hover:bg-amber-100"
            disabled={resetting}
            onClick={() => void resetSandbox()}
            type="button"
          >
            <RotateCcw className="inline" size={13} /> Reset sandbox attempt
          </button>
        </div>
      ) : null}

      <ExamHeader
        announcementCount={attempt.announcements.length}
        hideTimer={preferences.hideTimer}
        onOpenAnnouncements={() => setAnnouncementsOpen(true)}
        onOpenScratchpad={() => setScratchpadOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onRetry={() => void flushPendingWritten().then(() => flushQueue())}
        onReview={() => {
          setError(null);
          void flushPendingWritten();
          setReviewOpen(true);
        }}
        queuedCount={queuedCount}
        remainingSeconds={remainingSeconds}
        syncState={syncState}
        title={attempt.examTitle}
      />

      {attempt.announcements.length > 0 ? (
        <div
          aria-live="polite"
          className="border-b border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-4 py-2 text-center text-sm font-semibold text-[var(--status-info-text)]"
          role="status"
        >
          <span>Latest announcement: {attempt.announcements.at(-1)?.message}</span>
          {attempt.announcements.length > 1 ? (
            <button
              className="ml-3 underline underline-offset-4"
              onClick={() => setAnnouncementsOpen(true)}
              type="button"
            >
              View all ({attempt.announcements.length})
            </button>
          ) : null}
        </div>
      ) : null}

      {milestoneNotice ? (
        <div className="mx-auto mt-3 max-w-[1500px] px-4">
          <AlertBanner live="polite" onDismiss={() => setMilestoneNotice(null)} variant="warning">
            {milestoneNotice}
          </AlertBanner>
        </div>
      ) : null}

      {error && !reviewOpen ? (
        <div className="mx-auto mt-3 max-w-[1500px] px-4">
          <AlertBanner onDismiss={() => setError(null)} variant="error">
            {error}
          </AlertBanner>
        </div>
      ) : null}

      <main className={`mx-auto grid max-w-[1500px] lg:grid-cols-[280px_minmax(0,1fr)] ${spacing}`}>
        <div className={preferences.palettePos === "left" ? "lg:order-1" : "lg:order-2"}>{palette}</div>

        <section
          className={`card ${preferences.compactMode ? "p-4" : "p-6 lg:p-8"} ${
            preferences.palettePos === "left" ? "lg:order-2" : "lg:order-1"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <p className="eyebrow">
                Question {activeIndex + 1} of {attempt.questions.length}
              </p>
              <p className="font-mono-tabular mt-1 text-xs font-semibold text-[var(--text-secondary)]">
                {question.topic} · {question.difficulty} · {question.maxMarks} mark{question.maxMarks === 1 ? "" : "s"}
              </p>
            </div>
            <button
              aria-pressed={question.answer?.markedForReview ?? false}
              className={
                question.answer?.markedForReview
                  ? "btn-secondary border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                  : "btn-secondary"
              }
              onClick={() =>
                void updateAnswer(question, { markedForReview: !(question.answer?.markedForReview ?? false) })
              }
              type="button"
            >
              <Flag aria-hidden="true" size={15} />
              <span>{question.answer?.markedForReview ? "Marked for review" : "Mark for review"}</span>
            </button>
          </div>

          <h2 className="mt-6 whitespace-pre-wrap text-lg font-bold leading-relaxed text-[var(--text-primary)] sm:text-xl">
            {question.prompt}
          </h2>

          {question.type === "WRITTEN" ? (
            <label className="mt-6 block text-sm font-bold text-[var(--text-primary)]">
              Your response
              <textarea
                className="field mt-2 min-h-56 resize-y leading-7"
                onBlur={() => void flushPendingWritten()}
                onChange={(event) => void updateAnswer(question, { writtenText: event.target.value })}
                placeholder="Write your answer here…"
                value={question.answer?.writtenText ?? ""}
              />
            </label>
          ) : (
            <fieldset className="mt-6 space-y-3">
              <legend className="sr-only">Answer options</legend>
              {question.options?.map((option) => {
                const selected = question.answer?.selectedIds?.includes(option.id) ?? false;
                return (
                  <label
                    className={`flex cursor-pointer items-start gap-3 p-4 ${
                      selected ? "exam-option exam-option-selected" : "exam-option"
                    }`}
                    key={option.id}
                  >
                    <input
                      checked={selected}
                      className="mt-1"
                      name={question.type === "SINGLE_MCQ" ? question.snapshotId : undefined}
                      onChange={(event) => {
                        const current = question.answer?.selectedIds ?? [];
                        const selectedIds =
                          question.type === "SINGLE_MCQ"
                            ? event.target.checked
                              ? [option.id]
                              : []
                            : event.target.checked
                              ? [...current, option.id]
                              : current.filter((id) => id !== option.id);
                        void updateAnswer(question, { selectedIds });
                      }}
                      type={question.type === "SINGLE_MCQ" ? "radio" : "checkbox"}
                    />
                    <span className="leading-6">
                      <strong className="font-mono-tabular mr-2">{option.id.toUpperCase()}.</strong>
                      {option.text}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-[var(--border-subtle)] pt-5">
            <button
              className="btn-secondary"
              disabled={activeIndex === 0}
              onClick={() => navigateQuestion(Math.max(0, activeIndex - 1))}
              type="button"
            >
              <ArrowLeft size={16} /> Previous
            </button>
            <button
              className="btn-primary"
              disabled={activeIndex === attempt.questions.length - 1}
              onClick={() => navigateQuestion(Math.min(attempt.questions.length - 1, activeIndex + 1))}
              type="button"
            >
              Next <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>

      <WorkspacePreferencesDrawer
        onChange={changePreferences}
        onClose={() => setSettingsOpen(false)}
        open={settingsOpen}
        preferences={preferences}
      />

      <ScratchpadDrawer attemptId={attempt.id} onClose={() => setScratchpadOpen(false)} open={scratchpadOpen} />

      <Drawer
        closeLabel="Close announcements"
        eyebrow="Examiner broadcasts"
        maxWidthClass="max-w-md"
        onClose={() => setAnnouncementsOpen(false)}
        open={announcementsOpen}
        title={`Announcements (${attempt.announcements.length})`}
      >
        <div className="space-y-3">
          {[...attempt.announcements].reverse().map((item) => (
            <article
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4"
              key={item.id}
            >
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <BellRing aria-hidden="true" size={13} />
                <span className="font-mono-tabular">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--text-primary)]">{item.message}</p>
            </article>
          ))}
        </div>
      </Drawer>

      <ReviewSubmitModal
        busy={submitting}
        onClose={() => setReviewOpen(false)}
        onSubmit={() => void finalizeAttempt(false)}
        open={reviewOpen}
        queuedCount={queuedCount}
        questions={attempt.questions}
        submitError={error}
      />
    </div>
  );
}
