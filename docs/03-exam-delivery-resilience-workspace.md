# Plan 3 — Exam Delivery, Failure-Resilience, Workspace & Sandbox

> Parent Specification: [Master Specification & Architecture](./00-master-specification.md)

## Goal Description
Build the distraction-free **Examination Workspace** (3.5), backed by **Server-Authoritative Timing**, **Network-Aware Offline Synchronization** (4.1 + Innovation 5.3), persistent **Digital Scratchpad** (4.8), **Customizable Workspace Preferences** (4.7), and isolated **Examiner Sandbox Mode** (4.3).

**Covers PDF Requirements**: `3.5 Examination Interface`, `4.1 Network-Aware Interface`, `4.3 Examination Sandbox`, `4.7 Customizable Examination Workspace`, `4.8 Digital Scratchpad`, `5.3 Failure-Resilient Examinations`.

---

## Proposed Changes

### 1. Attempt Initialization, Server Clock & Anti-Cheat DTOs
#### [NEW] `src/app/api/exams/[id]/start/route.ts`
- Verifies eligibility (`Enrollment` exists, exam is `ONGOING` or within active window, not already `SUBMITTED`/`EXPIRED`).
- If an `IN_PROGRESS` attempt already exists for `(examId, userId, isSandbox: false)`, resumes it seamlessly (preserving snapshots, saved answers, and remaining server time across page refreshes).
- Otherwise creates `Attempt` inside a DB transaction:
  - Computes `hardDeadlineAt = min(now + durationMinutes, exam.scheduledEnd)`.
  - Generates `AttemptQuestionSnapshot` rows via `generateBalancedAttemptPaper()`.
- Returns sanitized payload: **excludes `correctIdsSnap` and `explanation`**, includes `serverNow` for client clock-skew calculation.

#### [NEW] `src/app/api/attempts/[id]/route.ts` & `src/app/api/attempts/[id]/submit/route.ts`
- `GET /api/attempts/[id]`: returns current attempt state, snapshots, saved answers, `serverNow`, `hardDeadlineAt`, and active announcements. Auto-transitions to `EXPIRED` if `now > hardDeadlineAt`.
- `POST /api/attempts/[id]/submit`: transactional finalization (`WHERE status = 'IN_PROGRESS'`) and duplicate-submission prevention. Plan 4 grades finalized attempts and owns grading-state transitions.

---

### 2. Innovation 5.3 + 4.1 — Network-Aware Offline Queue & Audited Resilience
#### [NEW] `src/lib/offline-queue.ts` (Client IndexedDB via `idb`)
- Stores pending answer mutations keyed by `(attemptId, snapshotId)` with monotonic `clientSeq`, `capturedAt`, and payload (`selectedIds`, `writtenText`, `markedForReview`).
- Maintains a live reactive sync state exposed to the UI:
  - `SYNCED` (green): all local mutations acknowledged by server.
  - `SAVING` (indigo pulse): request in flight.
  - `OFFLINE_QUEUED` (amber): `navigator.onLine === false` or network error; displays exact count (`"Offline — 3 answers safely queued locally"`).
  - `SYNC_ERROR` (red): retry with exponential backoff + manual "Retry Now" button.
- Automatically flushes queued mutations in `clientSeq` order on `window` `online` event or 5s reconnect probe.

#### [NEW] `src/app/api/attempts/[id]/sync/route.ts`
- Batch-idempotent endpoint accepting `{ mutations: AnswerMutation[] }`.
- Server calculates `effectiveDeadlineAt = hardDeadlineAt + timeExtensionMinutes` and checks `serverNow <= effectiveDeadlineAt + 5000ms`:
  - Rejects mutations after expiry (`EXPIRED`) so candidates **cannot** disconnect Wi-Fi to gain extra exam time.
  - Compares `mutation.clientSeq > existingAnswer.clientSeq` to prevent stale out-of-order overwrites.
  - Logs `RECONNECTED` event in `AttemptEvent` when resuming after a gap > 15s (`lastHeartbeatAt`).

#### [NEW] `src/app/api/attempts/[id]/heartbeat/route.ts` & `events/route.ts`
- Periodic 10s heartbeat updating `Attempt.lastHeartbeatAt` and returning `{ serverNow, hardDeadlineAt, timeExtensionMinutes, announcements }`.
- Captures non-intrusive browser signals (`TAB_BLUR`, `FULLSCREEN_EXIT`, `PASTE_ATTEMPT`) as `AttemptEvent` records (`severity: 'NOTICE'`), never auto-blocking or auto-failing the candidate.

---

### 3. Accessible Exam Workspace, Preferences (4.7) & Scratchpad (4.8)
#### [NEW] `src/app/candidate/exams/[id]/take/page.tsx` & `src/components/exam/**`
- **`ExamHeader.tsx`**: Exam title, Server-synced countdown timer (`tabular-nums`, amber warning < 5 min, red < 1 min), `NetworkStatusPill`, Workspace Settings trigger, Scratchpad toggle, Review & Submit button.
- **`QuestionPalette.tsx`**: Color-coded & icon-distinct grid for **Answered**, **Unanswered**, **Marked for Review**, and **Answered + Review** (accessibility: never relies on color alone). Keyboard shortcuts (`N`/`P` next/prev, `M` toggle review).
- **`WorkspacePreferencesDrawer.tsx` (4.7)**:
  - Font size (`sm`, `md`, `lg`), Theme (`light`, `dark`, `high-contrast`), Palette position (`left`, `right`), Compact mode, Timer visibility toggle (reduces test anxiety).
  - Persists immediately to `PATCH /api/preferences` (`UserPreference` table) + localStorage fallback.
- **`ScratchpadDrawer.tsx` (4.8)**:
  - Slide-over / split-pane drawer inside the exam workspace offering two tabs:
    1. **Freehand Canvas** (pen, eraser, clear, undo stroke)
    2. **Quick Notes** (plain/math text area)
  - Persisted per `attemptId` in IndexedDB so browser refreshes never erase rough work.
- **`ReviewSubmitModal.tsx`**: Shows summary counts (Answered / Unanswered / Marked for Review) before final confirmation.

---

### 4. Examiner Examination Sandbox (4.3)
#### [NEW] `src/app/api/exams/[id]/sandbox/route.ts` & `src/app/examiner/exams/[id]/sandbox/page.tsx`
- Allows Examiners to launch the exact Candidate Exam Workspace for any `DRAFT`, `PUBLISHED`, or `ONGOING` exam with `isSandbox: true`.
- Displays a prominent **"SANDBOX PREVIEW MODE — Does not affect real submissions or analytics"** banner and a "Reset Sandbox Attempt" button.
- Backend filters `isSandbox: false` on all monitoring, grading, result publication, and analytics queries.

---

## Verification Plan

### Automated Tests
1. `npx vitest run src/lib/__tests__/attempts-sync.test.ts` — verify:
   - Out-of-order `clientSeq` mutations do not overwrite newer answers.
   - Mutations sent after `hardDeadlineAt` are rejected and attempt finalizes cleanly.
   - Duplicate `/submit` calls return identical finalized result without creating duplicate records.
   - `isSandbox: true` attempts are excluded from real exam statistics.

### Manual Verification
1. Start an ongoing exam as Candidate → answer 2 questions → **disconnect network** in Chrome DevTools (`Offline`) → answer 2 more questions & draw in Scratchpad → verify amber `"Offline — queued locally"` badge → reconnect → verify auto-sync and persistence across `F5` refresh.
2. Adjust Workspace Preferences (High-Contrast + Large Font + Left Palette) → refresh page → confirm settings persist.
3. Launch Examiner Sandbox on a `DRAFT` exam → submit answers → confirm real Candidate Submissions & Analytics remain at `0`.
