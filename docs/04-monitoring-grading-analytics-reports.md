# Plan 4 — Live Monitoring, Grading, Analytics & QR-Verifiable PDF Reports

> Parent Specification: [Master Specification & Architecture](./00-master-specification.md)

## Goal Description
Implement real-time **Examination Monitoring & Announcements** (3.6), the **Objective + Manual Grading Engine** (3.7), **Results & Question Analytics** (3.8, 4.5), and **Downloadable QR-Verifiable PDF Reports** (4.2, 4.6), plus Examiner **Audited Time Accommodation** for verified outages (5.3).

**Covers PDF Requirements**: `3.6 Examination Monitoring`, `3.7 Evaluation & Grading`, `3.8 Results & Analytics`, `4.2 PDF Report Generation`, `4.5 Question Analytics`, `4.6 Verifiable Reports`, `5.3 Audited Outage Extension`.

---

## Proposed Changes

### 1. Real-Time Monitoring & Announcements via SSE (3.6)
#### [NEW] `src/lib/event-bus.ts` & `src/app/api/exams/[id]/stream/route.ts`
- Single-instance Node `EventEmitter` bus (`exam:${examId}`) + periodic 5s DB snapshot refresh fallback.
- Server-Sent Events endpoint streams:
  - To **Candidates** (enrolled/active): `ANNOUNCEMENT`, `TIME_EXTENDED`, `EXAM_ENDED`.
  - To **Examiner/Admin**: `ATTEMPT_PROGRESS`, `INCIDENT_LOGGED`, `ATTEMPT_SUBMITTED`, `CONNECTIVITY_CHANGE`.

#### [NEW] `src/app/examiner/exams/[id]/monitor/page.tsx` & `src/app/api/exams/[id]/announcements/route.ts`
- Live proctoring dashboard (strictly `isSandbox: false`):
  - Active candidate table: Progress (`8/15 answered`), Connection state (`Online`, `Gap 22s`), Remaining time, Incident indicator count.
  - Incident Drawer: chronological timeline (`TAB_BLUR`, `HEARTBEAT_LOST`, `RECONNECTED`) with explicit banner: *"Monitoring indicators are review signals only and do not constitute conclusive proof of misconduct."*
  - **Grant Audited Time Extension (5.3)**: Examiner can add `+N` minutes to a candidate who suffered a verified `HEARTBEAT_LOST` outage, requiring a written justification logged to `AuditLog` and pushing a live `TIME_EXTENDED` SSE event to the candidate's timer.
  - Live Announcement composer broadcasting immediately to all active workspaces.

---

### 2. Evaluation & Grading Engine (3.7)
#### [NEW] `src/lib/grading.ts`
- Pure, thoroughly unit-tested grading functions:
  - `gradeObjectiveSnapshot(snapshot, answer)`:
    - `SINGLE_MCQ`: full `maxMarks` if selected matches `correctIdsSnap[0]`, else `-maxMarks * negativeRatio` (if wrong & answered, 0 if skipped).
    - `MULTI_SELECT`:
      - `ALL_OR_NOTHING`: exact set equality → `maxMarks`, else `0`.
      - `PARTIAL_NO_NEGATIVE`: `max(0, (correctSelected / totalCorrect - wrongSelected / totalCorrect) * maxMarks)`.
      - `PARTIAL_WITH_NEGATIVE`: allows configured penalty floored at `-maxMarks * negativeRatio`.
  - `recomputeAttemptTotals(attemptId)`: sums `autoScore` + `manualScore` across all snapshots and sets `Attempt.status = 'GRADED'` once all `WRITTEN` items have `manualScore !== null`.

#### [NEW] `src/app/api/exams/[id]/grading/route.ts` & `src/app/examiner/exams/[id]/grading/page.tsx`
- Examiner Grading Workbench:
  - Side-by-side candidate written response, question prompt, and max marks.
  - Backend Zod validation: `0 <= manualScore <= snapshot.maxMarks`.
  - "Preview Result Summary" state before explicit **Publish Results** action (`POST /api/exams/[id]/publish-results`).

---

### 3. Results, Exam Summaries & Question Analytics (3.8 & 4.5)
#### [NEW] `src/lib/analytics.ts` & `src/app/api/exams/[id]/analytics/route.ts`
- Computes real metrics from `Attempt` (`isSandbox: false`, `status IN ('SUBMITTED', 'EXPIRED', 'GRADED', 'PUBLISHED')`):
  - **Exam Summary**: submission count, mean, median, min/max, pass rate, score histogram buckets.
  - **Question Analytics (4.5)**:
    - `skipRate` (% unanswered)
    - `correctnessRate` / **Observed Difficulty Index ($p$-value)**
    - **Distractor Analysis**: selection frequency per option ID (highlights misleading distractors)
    - Flags questions with abnormally low correctness (`< 25%`) or high skip rate (`> 30%`) for examiner review.

#### [NEW] `src/app/candidate/results/[attemptId]/page.tsx` & `src/app/examiner/exams/[id]/analytics/page.tsx`
- Candidate Results view (strictly gated by `attempt.userId === session.userId` and `exam.resultsPublishedAt !== null`): score breakdown, feedback on written answers, download PDF report button, and "Raise Dispute" action (Plan 5).

---

### 4. PDF Report Generation (4.2) & Verifiable QR Reports (4.6)
#### [NEW] `src/lib/pdf-reports.ts` & `src/lib/verification.ts`
- **Verification Record (`4.6`)**:
  - Generates unique short code (`AEG-XXXX-XXXX`) and `HMAC-SHA256` signature over `{ code, attemptId, totalScore, maxScore, version, issuedAt }`.
  - Generates QR code PNG buffer via `qrcode` pointing to `${APP_ORIGIN}/verify/${code}`.
- **PDF Generation (`4.2` via `pdfkit`)**:
  - `GET /api/reports/attempt/[attemptId]/pdf`: Candidate Score Report (Candidate name/ID, Exam title, Attempt date, Score, Pass/Fail status, Per-section summary, embedded QR Code + Verification ID). Access-restricted to report owner, exam creator, or Admin.
  - `GET /api/reports/exam/[examId]/pdf`: Examiner Cohort Summary Report (Exam stats, top metrics, question difficulty table). Restricted to exam creator or Admin.

#### [NEW] `src/app/verify/[code]/page.tsx` & `src/app/api/verify/[code]/route.ts`
- Public verification portal confirming report authenticity (`VALID` / `REVOKED_SUPERSEDED` / `NOT_FOUND`).
- **Privacy Protection (4.6 & 06)**: Exposes **only** masked candidate identifier/name, exam title, score (`X / Y`), issue date, and version — **never** exposes email, question text, candidate answers, or incident logs.

---

## Verification Plan

### Automated Tests
1. `npx vitest run src/lib/__tests__/grading.test.ts` — verify all 3 `MultiSelectScoring` modes, negative marking, skipped-question 0-mark rule, and rejection of `manualScore > maxMarks`.
2. `npx vitest run src/lib/__tests__/analytics-verification.test.ts` — verify:
   - Question analytics skip rate & distractor frequencies match fixture submissions.
   - HMAC signature verification fails if score/code is tampered and excludes private candidate data.
   - PDF generator produces valid `%PDF-` buffer (`> 1KB`).

### Manual Verification
1. Run an active attempt as Candidate while Examiner watches `/monitor` → send live announcement → confirm instant popup in Candidate Workspace; simulate tab switch & offline gap → inspect incident log & grant `+2 min` audited extension.
2. Submit attempt → grade written question as Examiner → publish results → download Candidate PDF → scan/visit `/verify/[code]` and confirm authenticity with minimal data exposure.
