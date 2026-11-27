"use client";

/* eslint-disable react-hooks/exhaustive-deps -- mutable refs deliberately keep timers and queue retries on the latest attempt state */

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Flag, RotateCcw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { ExamHeader } from "@/components/exam/ExamHeader";
import { QuestionPalette } from "@/components/exam/QuestionPalette";
import { ReviewSubmitModal } from "@/components/exam/ReviewSubmitModal";
import { ScratchpadDrawer } from "@/components/exam/ScratchpadDrawer";
import { type SyncState } from "@/components/exam/NetworkStatusPill";
import { WorkspacePreferencesDrawer } from "@/components/exam/WorkspacePreferencesDrawer";
import type { AttemptDto, AttemptQuestionDto } from "@/lib/attempts";
import {
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
  const [attempt, setAttemptState] = useState<AttemptDto | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [syncState, setSyncState] = useState<SyncState>("SYNCED");
  const [queuedCount, setQueuedCount] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function setAttempt(next: AttemptDto | null | ((current: AttemptDto | null) => AttemptDto | null)) {
    setAttemptState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      attemptRef.current = value;
      return value;
    });
  }

  async function flushQueue(attemptId = attemptRef.current?.id): Promise<boolean> {
    if (!attemptId || flushInFlightRef.current) return false;
    if (!navigator.onLine) {
      const queued = await getQueuedMutations(attemptId);
      setQueuedCount(queued.length);
      setSyncState(queued.length > 0 ? "OFFLINE_QUEUED" : "SYNCED");
      return false;
    }
    const queued = await getQueuedMutations(attemptId);
    setQueuedCount(queued.length);
    if (queued.length === 0) {
      setSyncState("SYNCED");
      return true;
    }
    flushInFlightRef.current = true;
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
        setSyncState("OFFLINE_QUEUED");
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
    } finally {
      flushInFlightRef.current = false;
      const remaining = await getQueuedMutations(attemptId);
      if (remaining.length > 0 && navigator.onLine && !retryTimerRef.current) {
        window.setTimeout(() => void flushQueue(attemptId), 50);
      }
    }
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(mode === "sandbox" ? `/api/exams/${examId}/sandbox` : `/api/exams/${examId}/start`, { method: "POST" });
        const body = (await response.json().catch(() => null)) as { attempt?: AttemptDto } | null;
        if (!response.ok || !body?.attempt) throw new Error(errorMessage(body, "Unable to open this examination"));
        const queued = await getQueuedMutations(body.attempt.id);
        if (!active) return;
        clientSeqRef.current = Math.max(body.attempt.lastClientSeq, ...queued.map((item) => item.clientSeq), 0);
        setQueuedCount(queued.length);
        setAttempt(mergeQueued(body.attempt, queued));
        setServerOffsetMs(new Date(body.attempt.serverNow).getTime() - Date.now());
        if (queued.length > 0) setSyncState(navigator.onLine ? "SAVING" : "OFFLINE_QUEUED");
        if (navigator.onLine) void flushQueue(body.attempt.id);
      } catch (initialError: unknown) {
        if (active) setError(initialError instanceof Error ? initialError.message : "Unable to open this examination");
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => { active = false; };
  }, [examId, mode]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("aegis-workspace-preferences");
      if (saved) setPreferences({ ...defaultPreferences, ...(JSON.parse(saved) as Partial<WorkspacePreferences>) });
    } catch { /* retain safe defaults */ }
    void fetch("/api/preferences").then(async (response) => {
      if (!response.ok) return;
      const body = (await response.json()) as { preferences: WorkspacePreferences };
      setPreferences(body.preferences);
      localStorage.setItem("aegis-workspace-preferences", JSON.stringify(body.preferences));
    });
  }, []);

  useEffect(() => {
    if (!attempt) return;
    const update = () => {
      const serverNow = Date.now() + serverOffsetMs;
      const seconds = Math.max(0, Math.ceil((new Date(attempt.effectiveDeadlineAt).getTime() - serverNow) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0 && attemptRef.current?.status === "IN_PROGRESS") void finalizeAttempt(true);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.effectiveDeadlineAt, attempt?.id, serverOffsetMs]);

  useEffect(() => {
    const attemptId = attempt?.id;
    if (!attemptId || attempt.status !== "IN_PROGRESS") return;
    const heartbeat = async () => {
      try {
        const response = await fetch(`/api/attempts/${attemptId}/heartbeat`, { method: "POST" });
        const body = (await response.json().catch(() => null)) as { attempt?: AttemptDto } | null;
        if (!response.ok || !body?.attempt) return;
        setServerOffsetMs(new Date(body.attempt.serverNow).getTime() - Date.now());
        setAttempt((current) => current ? {
          ...current,
          status: body.attempt!.status,
          submittedAt: body.attempt!.submittedAt,
          effectiveDeadlineAt: body.attempt!.effectiveDeadlineAt,
          announcements: body.attempt!.announcements,
          serverNow: body.attempt!.serverNow,
        } : body.attempt!);
      } catch { /* answer queue owns visible connection state */ }
    };
    const heartbeatTimer = window.setInterval(() => void heartbeat(), 10_000);
    const reconnectProbe = window.setInterval(() => {
      if (navigator.onLine && (syncState === "OFFLINE_QUEUED" || syncState === "SYNC_ERROR")) void flushQueue(attemptId);
    }, 5_000);
    const online = () => void flushQueue(attemptId);
    const offline = () => setSyncState(queuedCount > 0 ? "OFFLINE_QUEUED" : "SYNCED");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.clearInterval(heartbeatTimer);
      window.clearInterval(reconnectProbe);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [attempt?.id, attempt?.status, queuedCount, syncState]);

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
    const visibility = () => { if (document.visibilityState === "hidden") report("TAB_BLUR"); };
    const fullscreen = () => { if (!document.fullscreenElement) report("FULLSCREEN_EXIT"); };
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
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key.toLowerCase() === "n") setActiveIndex((current) => Math.min(attempt.questions.length - 1, current + 1));
      if (event.key.toLowerCase() === "p") setActiveIndex((current) => Math.max(0, current - 1));
      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        const question = attemptRef.current?.questions[activeIndex];
        if (question) void updateAnswer(question, { markedForReview: !(question.answer?.markedForReview ?? false) });
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [activeIndex, attempt?.id, attempt?.status]);

  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  async function updateAnswer(question: AttemptQuestionDto, patch: { selectedIds?: string[]; writtenText?: string; markedForReview?: boolean }) {
    const currentAttempt = attemptRef.current;
    if (!currentAttempt || currentAttempt.status !== "IN_PROGRESS") return;
    const mutation: QueuedAnswerMutation = {
      snapshotId: question.snapshotId,
      selectedIds: patch.selectedIds ?? question.answer?.selectedIds ?? null,
      writtenText: patch.writtenText ?? question.answer?.writtenText ?? null,
      markedForReview: patch.markedForReview ?? question.answer?.markedForReview ?? false,
      clientSeq: ++clientSeqRef.current,
      capturedAt: new Date().toISOString(),
    };
    setAttempt((current) => current ? mergeQueued(current, [mutation]) : current);
    await queueAnswerMutation(currentAttempt.id, mutation);
    const queued = await getQueuedMutations(currentAttempt.id);
    setQueuedCount(queued.length);
    if (!navigator.onLine) setSyncState("OFFLINE_QUEUED");
    else void flushQueue(currentAttempt.id);
  }

  async function finalizeAttempt(automatic = false) {
    const current = attemptRef.current;
    if (!current || submitInFlightRef.current || current.status !== "IN_PROGRESS") return;
    submitInFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      let pending = await getQueuedMutations(current.id);
      for (let attemptNumber = 0; attemptNumber < 3 && pending.length > 0 && navigator.onLine; attemptNumber += 1) {
        await flushQueue(current.id);
        await new Promise((resolve) => window.setTimeout(resolve, 100));
        pending = await getQueuedMutations(current.id);
      }
      if (pending.length > 0 && !automatic) throw new Error("Reconnect and synchronize queued answers before final submission.");
      const response = await fetch(`/api/attempts/${current.id}/submit`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { attempt?: AttemptDto } | null;
      if (!response.ok || !body?.attempt) throw new Error(errorMessage(body, "Unable to submit this attempt"));
      setAttempt(body.attempt);
      setReviewOpen(false);
    } catch (submitError: unknown) {
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
      window.location.reload();
    } catch (resetError: unknown) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset sandbox");
      setResetting(false);
    }
  }

  if (loading) return <div className="card mx-auto max-w-xl p-8 text-center"><p className="font-black">Preparing your secure paper…</p><p className="muted mt-2 text-sm">Generating immutable question snapshots and synchronizing the server clock.</p></div>;
  if (!attempt) return <div className="card mx-auto max-w-xl p-8"><h1 className="text-xl font-black">Examination unavailable</h1><p className="mt-2 text-sm text-rose-700">{error}</p><Link className="btn-secondary mt-5" href={mode === "sandbox" ? `/examiner/exams/${examId}` : "/candidate/dashboard"}>Return</Link></div>;

  const question = attempt.questions[activeIndex];
  const palette = <QuestionPalette activeIndex={activeIndex} onSelect={setActiveIndex} questions={attempt.questions} />;
  const themeClass = preferences.theme === "dark" ? "exam-theme-dark" : preferences.theme === "high-contrast" ? "exam-theme-contrast" : "";
  const fontClass = preferences.fontSize === "sm" ? "text-sm" : preferences.fontSize === "lg" ? "text-lg" : "text-base";
  const spacing = preferences.compactMode ? "gap-3 p-3" : "gap-6 p-5 lg:p-8";

  if (attempt.status !== "IN_PROGRESS") {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={52} />
        <p className="eyebrow mt-4">Attempt finalized</p>
        <h1 className="mt-1 text-2xl font-black">{attempt.status === "SUBMITTED" ? "Submission received" : "Time has expired"}</h1>
        <p className="muted mt-3 text-sm">Your final answers are sealed. Grading and result publication are handled separately.</p>
        <Link className="btn-primary mt-6" href={mode === "sandbox" ? `/examiner/exams/${examId}` : "/candidate/dashboard"}>Return to {mode === "sandbox" ? "exam builder" : "my examinations"}</Link>
        {mode === "sandbox" ? <button className="btn-secondary mt-3 w-full" disabled={resetting} onClick={() => void resetSandbox()} type="button"><RotateCcw size={16} /> {resetting ? "Resetting…" : "Reset sandbox attempt"}</button> : null}
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClass} ${fontClass}`}>
      {mode === "sandbox" ? <div className="flex flex-wrap items-center justify-center gap-2 bg-amber-300 px-4 py-2 text-center text-sm font-black text-amber-950"><ShieldAlert size={18} /> SANDBOX PREVIEW MODE — Does not affect real submissions or analytics <button className="rounded-lg border border-amber-900 px-2 py-1 text-xs" disabled={resetting} onClick={() => void resetSandbox()} type="button"><RotateCcw className="inline" size={13} /> Reset sandbox attempt</button></div> : null}
      <ExamHeader hideTimer={preferences.hideTimer} onOpenScratchpad={() => setScratchpadOpen(true)} onOpenSettings={() => setSettingsOpen(true)} onRetry={() => void flushQueue()} onReview={() => setReviewOpen(true)} queuedCount={queuedCount} remainingSeconds={remainingSeconds} syncState={syncState} title={attempt.examTitle} />
      {attempt.announcements.length > 0 ? <div className="border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-center text-sm font-semibold text-indigo-900">Latest announcement: {attempt.announcements.at(-1)?.message}</div> : null}
      {error ? <div className="mx-auto mt-4 max-w-4xl rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</div> : null}
      <main className={`mx-auto grid max-w-[1500px] lg:grid-cols-[280px_minmax(0,1fr)] ${spacing}`}>
        <div className={preferences.palettePos === "left" ? "lg:order-1" : "lg:order-2"}>{palette}</div>
        <section className={`card ${preferences.compactMode ? "p-4" : "p-6 lg:p-9"} ${preferences.palettePos === "left" ? "lg:order-2" : "lg:order-1"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div><p className="eyebrow">Question {activeIndex + 1} of {attempt.questions.length}</p><p className="mt-1 text-xs font-bold text-slate-500">{question.topic} · {question.difficulty} · {question.maxMarks} mark{question.maxMarks === 1 ? "" : "s"}</p></div>
            <button className={question.answer?.markedForReview ? "btn-primary bg-amber-600" : "btn-secondary"} onClick={() => void updateAnswer(question, { markedForReview: !(question.answer?.markedForReview ?? false) })} type="button"><Flag size={16} /> {question.answer?.markedForReview ? "Marked for review" : "Mark for review"}</button>
          </div>
          <h2 className="mt-7 whitespace-pre-wrap text-xl font-black leading-relaxed">{question.prompt}</h2>
          {question.type === "WRITTEN" ? (
            <label className="mt-7 block text-sm font-black">Your response<textarea className="field mt-2 min-h-52 resize-y leading-7" onChange={(event) => void updateAnswer(question, { writtenText: event.target.value })} placeholder="Write your answer here…" value={question.answer?.writtenText ?? ""} /></label>
          ) : (
            <fieldset className="mt-7 space-y-3"><legend className="sr-only">Answer options</legend>{question.options?.map((option) => {
              const selected = question.answer?.selectedIds?.includes(option.id) ?? false;
              return <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 ${selected ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`} key={option.id}><input checked={selected} className="mt-1" name={question.type === "SINGLE_MCQ" ? question.snapshotId : undefined} onChange={(event) => {
                const current = question.answer?.selectedIds ?? [];
                const selectedIds = question.type === "SINGLE_MCQ" ? (event.target.checked ? [option.id] : []) : event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id);
                void updateAnswer(question, { selectedIds });
              }} type={question.type === "SINGLE_MCQ" ? "radio" : "checkbox"} /><span><strong className="mr-2">{option.id.toUpperCase()}.</strong>{option.text}</span></label>;
            })}</fieldset>
          )}
          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
            <button className="btn-secondary" disabled={activeIndex === 0} onClick={() => setActiveIndex((current) => Math.max(0, current - 1))} type="button"><ArrowLeft size={16} /> Previous</button>
            <button className="btn-primary" disabled={activeIndex === attempt.questions.length - 1} onClick={() => setActiveIndex((current) => Math.min(attempt.questions.length - 1, current + 1))} type="button">Next <ArrowRight size={16} /></button>
          </div>
        </section>
      </main>
      <WorkspacePreferencesDrawer onChange={changePreferences} onClose={() => setSettingsOpen(false)} open={settingsOpen} preferences={preferences} />
      <ScratchpadDrawer attemptId={attempt.id} onClose={() => setScratchpadOpen(false)} open={scratchpadOpen} />
      <ReviewSubmitModal busy={submitting} onClose={() => setReviewOpen(false)} onSubmit={() => void finalizeAttempt(false)} open={reviewOpen} questions={attempt.questions} />
    </div>
  );
}
