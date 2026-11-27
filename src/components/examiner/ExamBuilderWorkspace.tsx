"use client";

import { Difficulty, ExamStatus, MultiSelectScoring } from "@prisma/client";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  FileUp,
  GraduationCap,
  Play,
  Plus,
  Scale,
  Send,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { BulkImportModal } from "@/components/examiner/BulkImportModal";
import type { ExamDto } from "@/lib/exam-dto";
import type { FairnessSimulationReport } from "@/lib/fairness";
import type { QuestionDto } from "@/lib/question-bank";
import type { UserDto } from "@/lib/user-dto";

type BuilderTab = "details" | "questions" | "fairness" | "enrollments" | "publish";

interface EnrollmentEntry {
  id: string;
  enrolledAt: string;
  candidate: UserDto;
}

function toLocalDateTimeInput(isoString: string): string {
  const date = new Date(isoString);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function ExamBuilderWorkspace({
  initialExam,
  bankQuestions,
  initialEnrollments,
  initialAvailableCandidates,
}: {
  initialExam: ExamDto;
  bankQuestions: QuestionDto[];
  initialEnrollments: EnrollmentEntry[];
  initialAvailableCandidates: UserDto[];
}) {
  const [exam, setExam] = useState<ExamDto>(initialExam);
  const [tab, setTab] = useState<BuilderTab>("details");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Details state
  const [title, setTitle] = useState(initialExam.title);
  const [instructions, setInstructions] = useState(initialExam.instructions);
  const [scheduledStart, setScheduledStart] = useState(
    toLocalDateTimeInput(initialExam.scheduledStart),
  );
  const [scheduledEnd, setScheduledEnd] = useState(
    toLocalDateTimeInput(initialExam.scheduledEnd),
  );
  const [durationMinutes, setDurationMinutes] = useState(String(initialExam.durationMinutes));
  const [totalMarks, setTotalMarks] = useState(String(initialExam.totalMarks));
  const [passingMarks, setPassingMarks] = useState(String(initialExam.passingMarks));
  const [shuffleQuestions, setShuffleQuestions] = useState(initialExam.shuffleQuestions);
  const [shuffleOptions, setShuffleOptions] = useState(initialExam.shuffleOptions);
  const [useStratifiedBlueprint, setUseStratifiedBlueprint] = useState(
    initialExam.useStratifiedBlueprint,
  );
  const [multiSelectRule, setMultiSelectRule] = useState<MultiSelectScoring>(
    initialExam.multiSelectRule,
  );
  const [negativeMarkRatio, setNegativeMarkRatio] = useState(
    String(initialExam.negativeMarkRatio),
  );
  const [revealAnswersAfterPublish, setRevealAnswersAfterPublish] = useState(
    initialExam.revealAnswersAfterPublish,
  );

  // Assigned fixed questions state
  const [assignedItems, setAssignedItems] = useState<Array<{ questionId: string; marks: number }>>(
    (initialExam.assignedQuestions ?? []).map((item) => ({
      questionId: item.questionId,
      marks: item.marks,
    })),
  );

  // Blueprint rules state
  const [blueprintRules, setBlueprintRules] = useState<
    Array<{ topic: string; difficulty: Difficulty; pickCount: number; marksEach: number }>
  >(
    (initialExam.blueprintRules ?? []).map((rule) => ({
      topic: rule.topic,
      difficulty: rule.difficulty,
      pickCount: rule.pickCount,
      marksEach: rule.marksEach,
    })),
  );

  // Fairness preview state
  const [fairnessReport, setFairnessReport] = useState<FairnessSimulationReport | null>(null);

  // Enrollment state
  const [enrollments, setEnrollments] = useState<EnrollmentEntry[]>(initialEnrollments);
  const [availableCandidates, setAvailableCandidates] =
    useState<UserDto[]>(initialAvailableCandidates);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [showCandidateImport, setShowCandidateImport] = useState(false);

  const isLocked = exam.status !== ExamStatus.DRAFT;

  const bankTopics = useMemo(
    () => Array.from(new Set(bankQuestions.map((q) => q.topic))).sort((a, b) => a.localeCompare(b)),
    [bankQuestions],
  );

  const poolAvailability = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of bankQuestions) {
      const key = `${q.topic}::${q.difficulty}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [bankQuestions]);

  const assignedMarksTotal = useMemo(
    () => Number(assignedItems.reduce((sum, item) => sum + item.marks, 0).toFixed(2)),
    [assignedItems],
  );

  const blueprintMarksTotal = useMemo(
    () =>
      Number(
        blueprintRules.reduce((sum, r) => sum + r.pickCount * r.marksEach, 0).toFixed(2),
      ),
    [blueprintRules],
  );

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/exams/${exam.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          instructions,
          scheduledStart: new Date(scheduledStart).toISOString(),
          scheduledEnd: new Date(scheduledEnd).toISOString(),
          durationMinutes: Number(durationMinutes),
          totalMarks: Number(totalMarks),
          passingMarks: Number(passingMarks),
          shuffleQuestions,
          shuffleOptions,
          useStratifiedBlueprint,
          multiSelectRule,
          negativeMarkRatio: Number(negativeMarkRatio),
          revealAnswersAfterPublish,
        }),
      });
      const body = (await response.json()) as { exam?: ExamDto; error?: { message?: string } };
      if (!response.ok || !body.exam) {
        throw new Error(body.error?.message ?? "Failed to update examination");
      }
      setExam(body.exam);
      setBanner({ type: "success", text: "Examination settings saved." });
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  function toggleAssignedQuestion(question: QuestionDto) {
    setAssignedItems((current) => {
      const exists = current.some((item) => item.questionId === question.id);
      if (exists) {
        return current.filter((item) => item.questionId !== question.id);
      }
      return [...current, { questionId: question.id, marks: question.maxMarks }];
    });
  }

  async function saveAssignedQuestions() {
    setBusy(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/exams/${exam.id}/questions`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: assignedItems.map((item, idx) => ({
            questionId: item.questionId,
            marks: item.marks,
            orderIndex: idx,
          })),
        }),
      });
      const body = (await response.json()) as { exam?: ExamDto; error?: { message?: string } };
      if (!response.ok || !body.exam) {
        throw new Error(body.error?.message ?? "Failed to save assigned questions");
      }
      setExam(body.exam);
      setBanner({ type: "success", text: "Assigned questions saved." });
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  function addBlueprintRule() {
    const defaultTopic = bankTopics[0] ?? "Algorithms";
    const candidates: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
    for (const topic of bankTopics.length > 0 ? bankTopics : [defaultTopic]) {
      for (const diff of candidates) {
        if (!blueprintRules.some((r) => r.topic === topic && r.difficulty === diff)) {
          setBlueprintRules((current) => [
            ...current,
            { topic, difficulty: diff, pickCount: 1, marksEach: 2 },
          ]);
          return;
        }
      }
    }
  }

  async function saveBlueprintRules() {
    setBusy(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/exams/${exam.id}/blueprint`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules: blueprintRules }),
      });
      const body = (await response.json()) as { exam?: ExamDto; error?: { message?: string } };
      if (!response.ok || !body.exam) {
        throw new Error(body.error?.message ?? "Failed to save blueprint");
      }
      setExam(body.exam);
      setUseStratifiedBlueprint(true);
      setBanner({ type: "success", text: "Stratified fairness blueprint saved." });
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  async function runFairnessPreview() {
    setBusy(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/exams/${exam.id}/fairness-preview?count=20`);
      const body = (await response.json()) as {
        report?: FairnessSimulationReport;
        error?: { message?: string };
      };
      if (!response.ok || !body.report) {
        throw new Error(body.error?.message ?? "Fairness preview failed");
      }
      setFairnessReport(body.report);
    } catch (err: unknown) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Simulation failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function reloadEnrollments() {
    const response = await fetch(`/api/exams/${exam.id}/enrollments`);
    if (!response.ok) return;
    const body = (await response.json()) as {
      enrollments: EnrollmentEntry[];
      availableCandidates: UserDto[];
    };
    setEnrollments(body.enrollments);
    setAvailableCandidates(body.availableCandidates);
  }

  async function enrollSelected() {
    if (selectedCandidateIds.length === 0) return;
    setBusy(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/exams/${exam.id}/enrollments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userIds: selectedCandidateIds }),
      });
      const body = (await response.json()) as {
        enrolledCount?: number;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Enrollment failed");
      }
      setSelectedCandidateIds([]);
      await reloadEnrollments();
      setBanner({
        type: "success",
        text: `Enrolled ${body.enrolledCount ?? 0} candidate(s).`,
      });
    } catch (err: unknown) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Enrollment failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeEnrollment(userId: string) {
    setBusy(true);
    setBanner(null);
    try {
      const response = await fetch(
        `/api/exams/${exam.id}/enrollments?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Failed to unenroll candidate");
      }
      await reloadEnrollments();
      setBanner({ type: "success", text: "Candidate unenrolled." });
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Unenroll failed" });
    } finally {
      setBusy(false);
    }
  }

  async function transitionStatus(targetStatus: ExamStatus) {
    setBusy(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/exams/${exam.id}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetStatus }),
      });
      const body = (await response.json()) as { exam?: ExamDto; error?: { message?: string } };
      if (!response.ok || !body.exam) {
        throw new Error(body.error?.message ?? "Status transition failed");
      }
      setExam(body.exam);
      setScheduledStart(toLocalDateTimeInput(body.exam.scheduledStart));
      setScheduledEnd(toLocalDateTimeInput(body.exam.scheduledEnd));
      setBanner({
        type: "success",
        text: `Examination is now ${body.exam.status}.`,
      });
    } catch (err: unknown) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Transition failed",
      });
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ id: BuilderTab; label: string }> = [
    { id: "details", label: "1. Details & Rules" },
    {
      id: "questions",
      label: useStratifiedBlueprint ? "2. Stratified Blueprint" : "2. Questions",
    },
    { id: "fairness", label: "3. Fairness Inspector" },
    { id: "enrollments", label: `4. Candidates (${enrollments.length})` },
    { id: "publish", label: "5. Review & Publish" },
  ];

  const marksReady = useStratifiedBlueprint
    ? blueprintRules.length > 0 && Math.abs(blueprintMarksTotal - exam.totalMarks) < 0.01
    : assignedItems.length > 0 && Math.abs(assignedMarksTotal - exam.totalMarks) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="btn-secondary px-3 py-1.5 text-sm" href="/examiner/exams">
          <ArrowLeft size={16} /> Back to examinations
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="btn-secondary px-3 py-1.5 text-sm" href={`/examiner/exams/${exam.id}/monitor`}>
            <Activity size={15} /> Monitor
          </Link>
          <Link className="btn-secondary px-3 py-1.5 text-sm" href={`/examiner/exams/${exam.id}/grading`}>
            <GraduationCap size={15} /> Grade
          </Link>
          <Link className="btn-secondary px-3 py-1.5 text-sm" href={`/examiner/exams/${exam.id}/analytics`}>
            <BarChart3 size={15} /> Analytics
          </Link>
          {exam.status !== ExamStatus.COMPLETED ? (
            <Link className="btn-secondary px-3 py-1.5 text-sm" href={`/examiner/exams/${exam.id}/sandbox`}>
              <Play size={15} /> Preview in sandbox
            </Link>
          ) : null}
          <span className="status-pill bg-indigo-50 text-indigo-700">{exam.status}</span>
          <span className="text-xs font-semibold text-slate-500">
            Total marks: {exam.totalMarks} · Duration: {exam.durationMinutes} min
          </span>
        </div>
      </div>

      <header>
        <p className="eyebrow">Examination builder</p>
        <h1 className="mt-1 text-3xl font-black">{exam.title}</h1>
      </header>

      <nav aria-label="Examination builder sections" className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            className={
              tab === item.id
                ? "btn-primary px-4 py-2 text-sm"
                : "btn-secondary px-4 py-2 text-sm"
            }
            key={item.id}
            onClick={() => setTab(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      {banner ? (
        <div
          aria-live="polite"
          className={`rounded-xl border p-3 text-sm ${
            banner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      {isLocked && (tab === "details" || tab === "questions") ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This examination is <strong>{exam.status}</strong>. Core configuration, questions, and marks are locked to protect candidate integrity.
        </div>
      ) : null}

      {tab === "details" ? (
        <form className="card grid gap-4 p-6 md:grid-cols-2" onSubmit={saveDetails}>
          <label className="text-sm font-bold md:col-span-2">
            Title
            <input
              className="field mt-1.5"
              disabled={isLocked}
              onChange={(e) => setTitle(e.target.value)}
              required
              value={title}
            />
          </label>
          <label className="text-sm font-bold md:col-span-2">
            Instructions
            <textarea
              className="field mt-1.5 min-h-24"
              disabled={isLocked}
              onChange={(e) => setInstructions(e.target.value)}
              required
              value={instructions}
            />
          </label>
          <label className="text-sm font-bold">
            Scheduled Start
            <input
              className="field mt-1.5"
              disabled={isLocked}
              onChange={(e) => setScheduledStart(e.target.value)}
              required
              type="datetime-local"
              value={scheduledStart}
            />
          </label>
          <label className="text-sm font-bold">
            Scheduled End
            <input
              className="field mt-1.5"
              disabled={isLocked}
              onChange={(e) => setScheduledEnd(e.target.value)}
              required
              type="datetime-local"
              value={scheduledEnd}
            />
          </label>
          <label className="text-sm font-bold">
            Duration (minutes)
            <input
              className="field mt-1.5"
              disabled={isLocked}
              min={1}
              onChange={(e) => setDurationMinutes(e.target.value)}
              required
              type="number"
              value={durationMinutes}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-bold">
              Total marks
              <input
                className="field mt-1.5"
                disabled={isLocked}
                min={1}
                onChange={(e) => setTotalMarks(e.target.value)}
                required
                step="0.5"
                type="number"
                value={totalMarks}
              />
            </label>
            <label className="text-sm font-bold">
              Passing marks
              <input
                className="field mt-1.5"
                disabled={isLocked}
                min={0}
                onChange={(e) => setPassingMarks(e.target.value)}
                required
                step="0.5"
                type="number"
                value={passingMarks}
              />
            </label>
          </div>
          <label className="text-sm font-bold">
            Multi-select scoring
            <select
              className="field mt-1.5"
              disabled={isLocked}
              onChange={(e) => setMultiSelectRule(e.target.value as MultiSelectScoring)}
              value={multiSelectRule}
            >
              <option value="PARTIAL_NO_NEGATIVE">Partial credit (no negative)</option>
              <option value="ALL_OR_NOTHING">All or nothing</option>
              <option value="PARTIAL_WITH_NEGATIVE">Partial credit with negative penalty</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Wrong-answer negative ratio (0–1)
            <input
              className="field mt-1.5"
              disabled={isLocked}
              max={1}
              min={0}
              onChange={(e) => setNegativeMarkRatio(e.target.value)}
              step="0.05"
              type="number"
              value={negativeMarkRatio}
            />
          </label>
          <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold">
              <input
                checked={useStratifiedBlueprint}
                disabled={isLocked}
                onChange={(e) => setUseStratifiedBlueprint(e.target.checked)}
                type="checkbox"
              />
              Use Stratified Fairness Blueprint (5.2)
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold">
              <input
                checked={shuffleQuestions}
                disabled={isLocked}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                type="checkbox"
              />
              Randomize question order per attempt
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold">
              <input
                checked={shuffleOptions}
                disabled={isLocked}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                type="checkbox"
              />
              Randomize answer choices per attempt
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold">
              <input
                checked={revealAnswersAfterPublish}
                disabled={isLocked}
                onChange={(e) => setRevealAnswersAfterPublish(e.target.checked)}
                type="checkbox"
              />
              Reveal answer keys after results publish
            </label>
          </div>
          {!isLocked ? (
            <div className="md:col-span-2 flex justify-end">
              <button className="btn-primary" disabled={busy} type="submit">
                {busy ? "Saving…" : "Save details & rules"}
              </button>
            </div>
          ) : null}
        </form>
      ) : null}

      {tab === "questions" ? (
        useStratifiedBlueprint ? (
          <section className="card space-y-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Stratified Fairness Blueprint Rules</h2>
                <p className="muted mt-1 text-sm">
                  Each candidate receives a distinct set matching exact topic and difficulty quotas.
                  Configured marks: <strong>{blueprintMarksTotal}</strong> / {exam.totalMarks}
                </p>
              </div>
              {!isLocked ? (
                <button className="btn-secondary" onClick={addBlueprintRule} type="button">
                  <Plus size={16} /> Add stratum rule
                </button>
              ) : null}
            </div>

            <div className="space-y-3">
              {blueprintRules.map((rule, idx) => {
                const available = poolAvailability.get(`${rule.topic}::${rule.difficulty}`) ?? 0;
                const insufficient = available < rule.pickCount;
                return (
                  <div
                    className="grid items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5"
                    key={`${rule.topic}-${rule.difficulty}-${idx}`}
                  >
                    <label className="text-xs font-bold">
                      Topic
                      <select
                        className="field mt-1"
                        disabled={isLocked}
                        onChange={(e) => {
                          const topicVal = e.target.value;
                          setBlueprintRules((current) =>
                            current.map((item, i) =>
                              i === idx ? { ...item, topic: topicVal } : item,
                            ),
                          );
                        }}
                        value={rule.topic}
                      >
                        {bankTopics.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-bold">
                      Difficulty
                      <select
                        className="field mt-1"
                        disabled={isLocked}
                        onChange={(e) => {
                          const diffVal = e.target.value as Difficulty;
                          setBlueprintRules((current) =>
                            current.map((item, i) =>
                              i === idx ? { ...item, difficulty: diffVal } : item,
                            ),
                          );
                        }}
                        value={rule.difficulty}
                      >
                        <option value="EASY">EASY</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HARD">HARD</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold">
                      Pick count (pool: {available})
                      <input
                        className="field mt-1"
                        disabled={isLocked}
                        min={1}
                        onChange={(e) => {
                          const pickCount = Math.max(1, Number(e.target.value) || 1);
                          setBlueprintRules((current) =>
                            current.map((item, i) =>
                              i === idx ? { ...item, pickCount } : item,
                            ),
                          );
                        }}
                        type="number"
                        value={rule.pickCount}
                      />
                    </label>
                    <label className="text-xs font-bold">
                      Marks each
                      <input
                        className="field mt-1"
                        disabled={isLocked}
                        min={0.5}
                        onChange={(e) => {
                          const marksEach = Math.max(0.5, Number(e.target.value) || 0.5);
                          setBlueprintRules((current) =>
                            current.map((item, i) =>
                              i === idx ? { ...item, marksEach } : item,
                            ),
                          );
                        }}
                        step="0.5"
                        type="number"
                        value={rule.marksEach}
                      />
                    </label>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-bold ${
                          insufficient ? "text-rose-700" : "text-emerald-700"
                        }`}
                      >
                        {insufficient
                          ? `Short by ${rule.pickCount - available}`
                          : `Subtotal: ${rule.pickCount * rule.marksEach}`}
                      </span>
                      {!isLocked ? (
                        <button
                          aria-label="Remove blueprint rule"
                          className="btn-danger px-2.5 py-2"
                          onClick={() =>
                            setBlueprintRules((current) => current.filter((_, i) => i !== idx))
                          }
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {blueprintRules.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  No blueprint rules yet. Add rules to sample balanced questions across topics and difficulties.
                </p>
              ) : null}
            </div>

            {!isLocked ? (
              <div className="flex justify-end">
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => void saveBlueprintRules()}
                  type="button"
                >
                  {busy ? "Saving…" : "Save blueprint rules"}
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="card space-y-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Fixed Question Selection</h2>
                <p className="muted mt-1 text-sm">
                  Selected: <strong>{assignedItems.length}</strong> questions · Marks sum:{" "}
                  <strong>{assignedMarksTotal}</strong> / {exam.totalMarks}
                </p>
              </div>
              {!isLocked ? (
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => void saveAssignedQuestions()}
                  type="button"
                >
                  {busy ? "Saving…" : "Save assigned questions"}
                </button>
              ) : null}
            </div>

            <div className="space-y-2">
              {bankQuestions.map((q) => {
                const selected = assignedItems.find((item) => item.questionId === q.id);
                return (
                  <div
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                      selected ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200"
                    }`}
                    key={q.id}
                  >
                    <label className="flex flex-1 cursor-pointer items-start gap-3">
                      <input
                        checked={Boolean(selected)}
                        className="mt-1"
                        disabled={isLocked}
                        onChange={() => toggleAssignedQuestion(q)}
                        type="checkbox"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{q.prompt}</p>
                        <p className="text-xs text-slate-500">
                          {q.topic} · {q.difficulty} · {q.type}
                        </p>
                      </div>
                    </label>
                    {selected ? (
                      <label className="flex items-center gap-2 text-xs font-bold">
                        Marks
                        <input
                          className="field w-20 py-1 text-xs"
                          disabled={isLocked}
                          min={0.5}
                          onChange={(e) => {
                            const val = Math.max(0.5, Number(e.target.value) || 0.5);
                            setAssignedItems((current) =>
                              current.map((item) =>
                                item.questionId === q.id ? { ...item, marks: val } : item,
                              ),
                            );
                          }}
                          step="0.5"
                          type="number"
                          value={selected.marks}
                        />
                      </label>
                    ) : (
                      <span className="text-xs text-slate-400">Default {q.maxMarks}m</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )
      ) : null}

      {tab === "fairness" ? (
        <section className="card space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Open Innovation 5.2</p>
              <h2 className="mt-1 text-xl font-black">Paper Fairness Variance Inspector</h2>
              <p className="muted mt-1 text-sm">
                Simulates 20 candidate papers using deterministic cryptographic seeds to verify equivalent difficulty and 100% topic coverage.
              </p>
            </div>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => void runFairnessPreview()}
              type="button"
            >
              <Scale size={17} /> {busy ? "Simulating…" : "Run 20-paper simulation"}
            </button>
          </div>

          {fairnessReport ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Mean Difficulty (1–3)</p>
                  <p className="mt-1 text-2xl font-black">{fairnessReport.simulatedMeanDifficulty}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs text-emerald-700">Difficulty Std Dev (σ)</p>
                  <p className="mt-1 text-2xl font-black text-emerald-900">
                    {fairnessReport.difficultyStdDev}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Difficulty Spread</p>
                  <p className="mt-1 text-2xl font-black">
                    {fairnessReport.minDifficultyAvg} – {fairnessReport.maxDifficultyAvg}
                  </p>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <p className="text-xs text-indigo-700">Topic Coverage</p>
                  <p className="mt-1 text-2xl font-black text-indigo-900">
                    {fairnessReport.topicCoveragePercent}%
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {fairnessReport.samplePapers.map((sample) => (
                  <div
                    className="rounded-xl border border-slate-200 p-4"
                    key={sample.sampleLabel}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-black">{sample.sampleLabel}</h3>
                      <span className="text-xs font-bold text-indigo-700">
                        Avg difficulty: {sample.fairnessDifficultyAvg}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-2 text-xs">
                      {sample.items.map((item) => (
                        <li
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                          key={`${sample.sampleLabel}-${item.questionId}`}
                        >
                          <span>
                            <strong>Q{item.displayOrder}</strong> · {item.topic} ({item.difficulty})
                          </span>
                          <span className="font-mono text-slate-500">
                            {item.optionOrder.length > 0
                              ? `opts [${item.optionOrder.join(",")}]`
                              : `${item.maxMarks}m written`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              Save your questions or blueprint rules first, then click &ldquo;Run 20-paper simulation&rdquo; to inspect difficulty variance.
            </p>
          )}
        </section>
      ) : null}

      {tab === "enrollments" ? (
        <section className="space-y-5">
          <div className="card space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Candidate Enrollment</h2>
                <p className="muted mt-1 text-sm">
                  Only enrolled candidates can view and start this examination inside its scheduled window.
                </p>
              </div>
              <button
                className="btn-secondary"
                onClick={() => setShowCandidateImport(true)}
                type="button"
              >
                <FileUp size={16} /> Bulk CSV/JSON import &amp; enroll
              </button>
            </div>

            {availableCandidates.length > 0 ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Available active candidates ({availableCandidates.length})
                </p>
                <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                  {availableCandidates.map((candidate) => (
                    <label
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                      key={candidate.id}
                    >
                      <input
                        checked={selectedCandidateIds.includes(candidate.id)}
                        onChange={(e) => {
                          setSelectedCandidateIds((current) =>
                            e.target.checked
                              ? [...current, candidate.id]
                              : current.filter((id) => id !== candidate.id),
                          );
                        }}
                        type="checkbox"
                      />
                      <span className="truncate font-semibold">{candidate.name}</span>
                      <span className="truncate text-slate-500">({candidate.email})</span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    className="btn-secondary px-3 py-1.5 text-xs"
                    onClick={() =>
                      setSelectedCandidateIds(availableCandidates.map((c) => c.id))
                    }
                    type="button"
                  >
                    Select all
                  </button>
                  <button
                    className="btn-primary px-3.5 py-1.5 text-xs"
                    disabled={busy || selectedCandidateIds.length === 0}
                    onClick={() => void enrollSelected()}
                    type="button"
                  >
                    <UserPlus size={14} /> Enroll selected ({selectedCandidateIds.length})
                  </button>
                </div>
              </div>
            ) : null}

            <div className="desktop-table">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Student ID</th>
                    <th className="p-3">Enrolled At</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((entry) => (
                    <tr className="border-t border-slate-100" key={entry.id}>
                      <td className="p-3">
                        <p className="font-bold">{entry.candidate.name}</p>
                        <p className="text-xs text-slate-500">{entry.candidate.email}</p>
                      </td>
                      <td className="p-3 font-mono text-xs">{entry.candidate.studentId ?? "—"}</td>
                      <td className="p-3 text-xs text-slate-500">
                        {new Date(entry.enrolledAt).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          className="btn-danger px-2.5 py-1 text-xs"
                          disabled={busy}
                          onClick={() => void removeEnrollment(entry.candidate.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {enrollments.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  No candidates enrolled yet.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "publish" ? (
        <section className="card space-y-5 p-6">
          <div>
            <h2 className="text-xl font-black">Pre-Publication Review &amp; Lifecycle Controls</h2>
            <p className="muted mt-1 text-sm">
              Verify schedule, paper marks, and enrollments before releasing this examination.
            </p>
          </div>

          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 rounded-xl border border-slate-200 p-3">
              <CheckCircle2
                className={
                  new Date(exam.scheduledEnd) > new Date(exam.scheduledStart)
                    ? "text-emerald-600"
                    : "text-rose-600"
                }
                size={18}
              />
              Schedule window: {new Date(exam.scheduledStart).toLocaleString()} →{" "}
              {new Date(exam.scheduledEnd).toLocaleString()} ({exam.durationMinutes} min)
            </li>
            <li className="flex items-center gap-2 rounded-xl border border-slate-200 p-3">
              <CheckCircle2
                className={marksReady ? "text-emerald-600" : "text-rose-600"}
                size={18}
              />
              {useStratifiedBlueprint
                ? `Stratified Blueprint marks: ${blueprintMarksTotal} / ${exam.totalMarks}`
                : `Assigned question marks: ${assignedMarksTotal} / ${exam.totalMarks}`}
            </li>
            <li className="flex items-center gap-2 rounded-xl border border-slate-200 p-3">
              <Users className="text-indigo-600" size={18} />
              Enrolled candidates: <strong>{enrollments.length}</strong>
            </li>
          </ul>

          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            {exam.status === ExamStatus.DRAFT ? (
              <button
                className="btn-primary"
                disabled={busy || !marksReady}
                onClick={() => void transitionStatus(ExamStatus.PUBLISHED)}
                type="button"
              >
                <Send size={16} /> Publish examination
              </button>
            ) : null}

            {exam.status === ExamStatus.PUBLISHED ? (
              <>
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => void transitionStatus(ExamStatus.ONGOING)}
                  type="button"
                >
                  <Play size={16} /> Open now (mark ONGOING)
                </button>
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void transitionStatus(ExamStatus.DRAFT)}
                  type="button"
                >
                  Revert to DRAFT
                </button>
              </>
            ) : null}

            {exam.status === ExamStatus.ONGOING ? (
              <button
                className="btn-danger"
                disabled={busy}
                onClick={() => void transitionStatus(ExamStatus.COMPLETED)}
                type="button"
              >
                Close &amp; mark COMPLETED
              </button>
            ) : null}

            {exam.status === ExamStatus.COMPLETED ? (
              <p className="text-sm font-semibold text-slate-600">
                This examination is completed and sealed.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {showCandidateImport ? (
        <BulkImportModal
          enrollExamId={exam.id}
          mode="candidates"
          onClose={() => setShowCandidateImport(false)}
          onSuccess={(summary) => {
            setBanner({ type: "success", text: summary });
            void reloadEnrollments();
          }}
        />
      ) : null}
    </div>
  );
}
