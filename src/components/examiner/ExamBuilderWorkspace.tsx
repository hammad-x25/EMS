"use client";

import { Difficulty, ExamStatus, MultiSelectScoring } from "@prisma/client";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Activity, BarChart3, GraduationCap, Play } from "lucide-react";
import { BulkImportModal } from "@/components/examiner/BulkImportModal";
import { CompositionTab } from "@/components/examiner/builder/CompositionTab";
import { DetailsTab } from "@/components/examiner/builder/DetailsTab";
import { EnrollmentsTab } from "@/components/examiner/builder/EnrollmentsTab";
import { FairnessTab } from "@/components/examiner/builder/FairnessTab";
import { PublishTab } from "@/components/examiner/builder/PublishTab";
import {
  toLocalDateTimeInput,
  type AssignedQuestionDraft,
  type BlueprintRuleDraft,
  type BuilderTab,
  type EnrollmentEntry,
} from "@/components/examiner/builder/types";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import type { ExamDto } from "@/lib/exam-dto";
import type { FairnessSimulationReport } from "@/lib/fairness";
import { parseApiError, readApiJson } from "@/lib/form-errors";
import type { QuestionDto } from "@/lib/question-bank";
import type { UserDto } from "@/lib/user-dto";

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
  const [pendingTab, setPendingTab] = useState<BuilderTab | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Details state
  const [title, setTitle] = useState(initialExam.title);
  const [instructions, setInstructions] = useState(initialExam.instructions);
  const [scheduledStart, setScheduledStart] = useState(toLocalDateTimeInput(initialExam.scheduledStart));
  const [scheduledEnd, setScheduledEnd] = useState(toLocalDateTimeInput(initialExam.scheduledEnd));
  const [durationMinutes, setDurationMinutes] = useState(String(initialExam.durationMinutes));
  const [totalMarks, setTotalMarks] = useState(String(initialExam.totalMarks));
  const [passingMarks, setPassingMarks] = useState(String(initialExam.passingMarks));
  const [shuffleQuestions, setShuffleQuestions] = useState(initialExam.shuffleQuestions);
  const [shuffleOptions, setShuffleOptions] = useState(initialExam.shuffleOptions);
  const [useStratifiedBlueprint, setUseStratifiedBlueprint] = useState(initialExam.useStratifiedBlueprint);
  const [multiSelectRule, setMultiSelectRule] = useState<MultiSelectScoring>(initialExam.multiSelectRule);
  const [negativeMarkRatio, setNegativeMarkRatio] = useState(String(initialExam.negativeMarkRatio));
  const [revealAnswersAfterPublish, setRevealAnswersAfterPublish] = useState(initialExam.revealAnswersAfterPublish);
  const [detailsDirty, setDetailsDirty] = useState(false);

  // Composition state
  const [assignedItems, setAssignedItems] = useState<AssignedQuestionDraft[]>(
    (initialExam.assignedQuestions ?? []).map((item) => ({
      questionId: item.questionId,
      marks: item.marks,
    })),
  );
  const [blueprintRules, setBlueprintRules] = useState<BlueprintRuleDraft[]>(
    (initialExam.blueprintRules ?? []).map((rule) => ({
      topic: rule.topic,
      difficulty: rule.difficulty,
      pickCount: rule.pickCount,
      marksEach: rule.marksEach,
    })),
  );
  const [compositionDirty, setCompositionDirty] = useState(false);

  // Fairness preview state
  const [fairnessReport, setFairnessReport] = useState<FairnessSimulationReport | null>(null);

  // Enrollment state
  const [enrollments, setEnrollments] = useState<EnrollmentEntry[]>(initialEnrollments);
  const [availableCandidates, setAvailableCandidates] = useState<UserDto[]>(initialAvailableCandidates);
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
    () => Number(blueprintRules.reduce((sum, r) => sum + r.pickCount * r.marksEach, 0).toFixed(2)),
    [blueprintRules],
  );

  function requestTabChange(nextTab: BuilderTab) {
    if (nextTab === tab) return;
    if ((tab === "details" && detailsDirty) || (tab === "questions" && compositionDirty)) {
      setPendingTab(nextTab);
      return;
    }
    setTab(nextTab);
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setBanner(null);

    if (new Date(scheduledEnd) <= new Date(scheduledStart)) {
      setFieldErrors({ scheduledEnd: "Scheduled end must be after scheduled start." });
      setBanner({ type: "error", text: "Scheduled end must be after scheduled start." });
      return;
    }
    if (Number(passingMarks) > Number(totalMarks)) {
      setFieldErrors({ passingMarks: "Passing marks cannot exceed total marks." });
      setBanner({ type: "error", text: "Passing marks cannot exceed total marks." });
      return;
    }

    setBusy(true);
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
      const body = await readApiJson<{ exam?: ExamDto; error?: { message?: string; details?: unknown } }>(response);
      if (!response.ok || !body?.exam) {
        const parsed = parseApiError(body, "Failed to update examination");
        setFieldErrors(parsed.fieldErrors);
        throw new Error(parsed.formErrors[0] ?? parsed.message);
      }
      setExam(body.exam);
      setDetailsDirty(false);
      setBanner({ type: "success", text: "Examination settings saved." });
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
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
      const body = await readApiJson<{ exam?: ExamDto; error?: { message?: string } }>(response);
      if (!response.ok || !body?.exam) {
        throw new Error(parseApiError(body, "Failed to save assigned questions").message);
      }
      setExam(body.exam);
      setCompositionDirty(false);
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
          setBlueprintRules((current) => [...current, { topic, difficulty: diff, pickCount: 1, marksEach: 2 }]);
          setCompositionDirty(true);
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
      const body = await readApiJson<{ exam?: ExamDto; error?: { message?: string } }>(response);
      if (!response.ok || !body?.exam) {
        throw new Error(parseApiError(body, "Failed to save blueprint").message);
      }
      setExam(body.exam);
      setUseStratifiedBlueprint(true);
      setCompositionDirty(false);
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
      const body = await readApiJson<{ report?: FairnessSimulationReport; error?: { message?: string } }>(response);
      if (!response.ok || !body?.report) {
        throw new Error(parseApiError(body, "Fairness preview failed").message);
      }
      setFairnessReport(body.report);
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Simulation failed" });
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
      const body = await readApiJson<{ enrolledCount?: number; error?: { message?: string } }>(response);
      if (!response.ok) {
        throw new Error(parseApiError(body, "Enrollment failed").message);
      }
      setSelectedCandidateIds([]);
      await reloadEnrollments();
      setBanner({ type: "success", text: `Enrolled ${body?.enrolledCount ?? 0} candidate(s).` });
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Enrollment failed" });
    } finally {
      setBusy(false);
    }
  }

  async function removeEnrollment(userId: string) {
    setBusy(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/exams/${exam.id}/enrollments?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const body = await readApiJson<{ error?: { message?: string } }>(response);
      if (!response.ok) {
        throw new Error(parseApiError(body, "Failed to unenroll candidate").message);
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
      const body = await readApiJson<{ exam?: ExamDto; error?: { message?: string } }>(response);
      if (!response.ok || !body?.exam) {
        throw new Error(parseApiError(body, "Status transition failed").message);
      }
      setExam(body.exam);
      setScheduledStart(toLocalDateTimeInput(body.exam.scheduledStart));
      setScheduledEnd(toLocalDateTimeInput(body.exam.scheduledEnd));
      setBanner({ type: "success", text: `Examination is now ${body.exam.status}.` });
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Transition failed" });
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { id: "details" as const, label: "1. Details & Rules", dirty: detailsDirty },
    {
      id: "questions" as const,
      label: useStratifiedBlueprint ? "2. Stratified Blueprint" : "2. Questions",
      dirty: compositionDirty,
    },
    { id: "fairness" as const, label: "3. Fairness Inspector" },
    { id: "enrollments" as const, label: "4. Candidates", badge: enrollments.length },
    { id: "publish" as const, label: "5. Review & Publish" },
  ];

  const marksReady = useStratifiedBlueprint
    ? blueprintRules.length > 0 && Math.abs(blueprintMarksTotal - exam.totalMarks) < 0.01
    : assignedItems.length > 0 && Math.abs(assignedMarksTotal - exam.totalMarks) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: "Examinations", href: "/examiner/exams" }, { label: exam.title }]} />
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary h-9 px-3 text-xs" href={`/examiner/exams/${exam.id}/monitor`}>
            <Activity size={14} /> Monitor
          </Link>
          <Link className="btn-secondary h-9 px-3 text-xs" href={`/examiner/exams/${exam.id}/grading`}>
            <GraduationCap size={14} /> Grade
          </Link>
          <Link className="btn-secondary h-9 px-3 text-xs" href={`/examiner/exams/${exam.id}/analytics`}>
            <BarChart3 size={14} /> Analytics
          </Link>
          {exam.status !== ExamStatus.COMPLETED ? (
            <Link className="btn-secondary h-9 px-3 text-xs" href={`/examiner/exams/${exam.id}/sandbox`}>
              <Play size={14} /> Preview in sandbox
            </Link>
          ) : null}
        </div>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Examination builder</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-3xl">
            {exam.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={exam.status} />
          <span className="font-mono-tabular text-xs font-semibold text-[var(--text-secondary)]">
            {exam.totalMarks} marks · {exam.durationMinutes} min
          </span>
        </div>
      </header>

      <Tabs
        activeId={tab}
        ariaLabel="Examination builder sections"
        idPrefix="exam-builder"
        items={tabs}
        onSelect={requestTabChange}
      />

      {banner ? (
        <AlertBanner onDismiss={() => setBanner(null)} variant={banner.type}>
          {banner.text}
        </AlertBanner>
      ) : null}

      {isLocked && (tab === "details" || tab === "questions") ? (
        <AlertBanner variant="warning">
          This examination is <strong>{exam.status}</strong>. Core configuration, questions, and marks are locked to protect candidate integrity.
        </AlertBanner>
      ) : null}

      <div id={`exam-builder-panel-${tab}`} role="tabpanel">
        {tab === "details" ? (
          <DetailsTab
            busy={busy}
            durationMinutes={durationMinutes}
            fieldErrors={fieldErrors}
            instructions={instructions}
            isLocked={isLocked}
            multiSelectRule={multiSelectRule}
            negativeMarkRatio={negativeMarkRatio}
            onDurationMinutesChange={(v) => {
              setDurationMinutes(v);
              setDetailsDirty(true);
            }}
            onInstructionsChange={(v) => {
              setInstructions(v);
              setDetailsDirty(true);
            }}
            onMultiSelectRuleChange={(v) => {
              setMultiSelectRule(v);
              setDetailsDirty(true);
            }}
            onNegativeMarkRatioChange={(v) => {
              setNegativeMarkRatio(v);
              setDetailsDirty(true);
            }}
            onPassingMarksChange={(v) => {
              setPassingMarks(v);
              setDetailsDirty(true);
            }}
            onRevealAnswersAfterPublishChange={(v) => {
              setRevealAnswersAfterPublish(v);
              setDetailsDirty(true);
            }}
            onScheduledEndChange={(v) => {
              setScheduledEnd(v);
              setDetailsDirty(true);
            }}
            onScheduledStartChange={(v) => {
              setScheduledStart(v);
              setDetailsDirty(true);
            }}
            onShuffleOptionsChange={(v) => {
              setShuffleOptions(v);
              setDetailsDirty(true);
            }}
            onShuffleQuestionsChange={(v) => {
              setShuffleQuestions(v);
              setDetailsDirty(true);
            }}
            onSubmit={saveDetails}
            onTitleChange={(v) => {
              setTitle(v);
              setDetailsDirty(true);
            }}
            onTotalMarksChange={(v) => {
              setTotalMarks(v);
              setDetailsDirty(true);
            }}
            onUseStratifiedBlueprintChange={(v) => {
              setUseStratifiedBlueprint(v);
              setDetailsDirty(true);
            }}
            passingMarks={passingMarks}
            revealAnswersAfterPublish={revealAnswersAfterPublish}
            scheduledEnd={scheduledEnd}
            scheduledStart={scheduledStart}
            shuffleOptions={shuffleOptions}
            shuffleQuestions={shuffleQuestions}
            title={title}
            totalMarks={totalMarks}
            useStratifiedBlueprint={useStratifiedBlueprint}
          />
        ) : null}

        {tab === "questions" ? (
          <CompositionTab
            assignedItems={assignedItems}
            assignedMarksTotal={assignedMarksTotal}
            bankQuestions={bankQuestions}
            bankTopics={bankTopics}
            blueprintMarksTotal={blueprintMarksTotal}
            blueprintRules={blueprintRules}
            busy={busy}
            isLocked={isLocked}
            onAddRule={addBlueprintRule}
            onRemoveRule={(idx) => {
              setBlueprintRules((current) => current.filter((_, i) => i !== idx));
              setCompositionDirty(true);
            }}
            onSaveAssigned={() => void saveAssignedQuestions()}
            onSaveBlueprint={() => void saveBlueprintRules()}
            onToggleAssigned={(question) => {
              setAssignedItems((current) => {
                const exists = current.some((item) => item.questionId === question.id);
                return exists
                  ? current.filter((item) => item.questionId !== question.id)
                  : [...current, { questionId: question.id, marks: question.maxMarks }];
              });
              setCompositionDirty(true);
            }}
            onUpdateAssignedMarks={(questionId, marks) => {
              setAssignedItems((current) =>
                current.map((item) => (item.questionId === questionId ? { ...item, marks } : item)),
              );
              setCompositionDirty(true);
            }}
            onUpdateRule={(idx, patch) => {
              setBlueprintRules((current) => current.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
              setCompositionDirty(true);
            }}
            poolAvailability={poolAvailability}
            totalMarks={exam.totalMarks}
            useStratifiedBlueprint={useStratifiedBlueprint}
          />
        ) : null}

        {tab === "fairness" ? (
          <FairnessTab busy={busy} fairnessReport={fairnessReport} onRunSimulation={() => void runFairnessPreview()} />
        ) : null}

        {tab === "enrollments" ? (
          <EnrollmentsTab
            availableCandidates={availableCandidates}
            busy={busy}
            enrollments={enrollments}
            onEnrollSelected={() => void enrollSelected()}
            onOpenImport={() => setShowCandidateImport(true)}
            onRemoveEnrollment={removeEnrollment}
            onSelectedCandidateIdsChange={setSelectedCandidateIds}
            selectedCandidateIds={selectedCandidateIds}
          />
        ) : null}

        {tab === "publish" ? (
          <PublishTab
            assignedMarksTotal={assignedMarksTotal}
            blueprintMarksTotal={blueprintMarksTotal}
            busy={busy}
            enrollmentCount={enrollments.length}
            exam={exam}
            marksReady={marksReady}
            onTransitionStatus={transitionStatus}
            useStratifiedBlueprint={useStratifiedBlueprint}
          />
        ) : null}
      </div>

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

      <ConfirmDialog
        confirmLabel="Discard edits & switch"
        consequence="Unsaved edits on the current tab remain unsaved on the server until you return and save."
        description="You have unsaved changes on this tab. Continue switching tabs?"
        onClose={() => setPendingTab(null)}
        onConfirm={() => {
          if (pendingTab) {
            if (tab === "details") setDetailsDirty(false);
            if (tab === "questions") setCompositionDirty(false);
            setTab(pendingTab);
            setPendingTab(null);
          }
        }}
        open={Boolean(pendingTab)}
        title="Unsaved builder changes"
      />
    </div>
  );
}
