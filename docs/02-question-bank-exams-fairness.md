# Plan 2 — Question Bank, Bulk Import, Exam Lifecycle & Fairness Engine

> Parent Specification: [Master Specification & Architecture](./00-master-specification.md)

## Goal Description
Implement the complete **Examination Setup & Access** pipeline: reusable Question Bank, Bulk CSV/JSON Import (4.4), Examination Lifecycle management (3.2), Candidate Enrollment & Portal Views (3.4), and **Open Innovation 5.2: Stratified Fairness-Balanced Paper Generation** with difficulty-variance reporting.

**Covers PDF Requirements**: `3.2 Examination Management`, `3.3 Question Management`, `3.4 Candidate Management`, `4.4 Bulk Data Import`, `5.2 Fairness of Randomized Examinations`.

---

## Proposed Changes

### 1. Reusable Question Bank (3.3)
#### [NEW] `src/app/api/questions/route.ts` & `src/app/api/questions/[id]/route.ts`
- CRUD endpoints restricted to `EXAMINER` and `ADMIN`.
- Supports filtering by `topic`, `difficulty` (`EASY | MEDIUM | HARD`), `type` (`SINGLE_MCQ | MULTI_SELECT | WRITTEN`), and search query.
- Zod validation enforces:
  - `SINGLE_MCQ`: >= 2 options, exactly 1 `correctId`.
  - `MULTI_SELECT`: >= 2 options, >= 1 `correctIds`.
  - `WRITTEN`: `optionsJson = null`, `maxMarks > 0`.
- Editing a question updates the bank without mutating existing `AttemptQuestionSnapshot` records (preserving active/historical attempt integrity).

#### [NEW] `src/app/examiner/questions/page.tsx`
- Clean Question Bank workspace with topic/difficulty badges, inline preview modal, create/edit drawer, and bulk import trigger.

---

### 2. Bulk CSV & JSON Import (4.4)
#### [NEW] `src/lib/bulk-import.ts`
- Pure validation parsers using `papaparse` (CSV) and `JSON.parse`:
  - `parseQuestionImport(rawText, format: 'csv' | 'json')` → returns `{ validRows, errors: [{ row: number, field: string, message: string }] }`.
  - `parseCandidateImport(rawText, format: 'csv' | 'json')` → validates `name`, `email`, optional `studentId`, optional `enrollExamId`.
- Supports **Dry-Run Preview** before committing inside a Prisma `$transaction`.

#### [NEW] `src/app/api/import/questions/route.ts` & `src/app/api/import/candidates/route.ts`
- Accepts file/text payload + `dryRun: boolean`. Returns structured row-by-row validation diagnostics on failure (`422`) or summary counts (`created`, `skippedDuplicates`, `enrolled`) on commit.
- Downloadable sample CSV/JSON templates in UI so judges can test immediately.

---

### 3. Examination Management & Lifecycle (3.2)
#### [NEW] `src/lib/exam-lifecycle.ts`
- State machine validator enforcing allowed transitions:
  - `DRAFT` → `PUBLISHED` (requires `>= 1` assigned question or valid blueprint matching `totalMarks`, plus valid `scheduledStart < scheduledEnd`).
  - `PUBLISHED` → `ONGOING` (manual start or automatic when `now >= scheduledStart`).
  - `ONGOING` → `COMPLETED` (manual close or automatic when `now >= scheduledEnd`; triggers pending attempt expiry sweep).
- Lifecycle reconciliation runs from server-side exam reads and mutations so time-based transitions are persisted without trusting a browser clock.
- Also enforces **Examiner Ownership**: Examiner A cannot edit/publish/view Examiner B's private exams unless `ADMIN`.

#### [NEW] `src/app/api/exams/**` & `src/app/examiner/exams/**`
- Multi-tab Examiner Exam Builder:
  1. **Details & Rules**: Title, rich instructions, schedule window, duration, total/passing marks, `multiSelectRule`, `negativeMarkRatio`, randomization flags.
  2. **Questions / Blueprint**: Either pick explicit questions from bank OR enable **Stratified Fairness Blueprint**.
  3. **Review & Publish**: Pre-publication checklist verifying total marks match configured marks before transition to `PUBLISHED`.

---

### 4. Candidate Enrollment & Portal (3.4)
#### [NEW] `src/app/api/exams/[id]/enrollments/route.ts` & `src/app/api/candidate/exams/route.ts`
- Examiners enroll candidates individually, by group/batch, or via bulk CSV import.
- Candidate Portal (`/candidate/dashboard`) groups enrolled exams cleanly into:
  - **Available Now**: `status IN ('PUBLISHED', 'ONGOING')` and `scheduledStart <= now <= scheduledEnd` (with "Start / Resume Exam" CTA).
  - **Upcoming**: `now < scheduledStart` (shows countdown & instructions preview, entry blocked on backend).
  - **Completed**: Attempt submitted/expired or exam `COMPLETED` (shows grading/publication status).

---

### 5. Open Innovation 5.2 — Stratified Fairness-Balanced Paper Generator
#### [NEW] `src/lib/fairness.ts`
- **Problem Solved**: Naive random sampling (`pick K from N`) can yield unbalanced exams (e.g., Candidate A gets 70% Hard questions, Candidate B gets 70% Easy).
- **Algorithm**:
  1. Examiner configures `ExamBlueprintRule` rows (`topic`, `difficulty`, `pickCount`, `marksEach`).
  2. At attempt start, `generateBalancedAttemptPaper(examId, userId, attemptId)` uses a deterministic cryptographic seed (`HMAC(secret, attemptId)`):
     - Samples `pickCount` distinct questions per `(topic, difficulty)` stratum.
     - If `useStratifiedBlueprint` is off but `shuffleQuestions` is on, selects all assigned exam questions and shuffles using Fisher-Yates seeded PRNG; if pool sampling is enabled, optimizes swap iterations to minimize difficulty variance against target difficulty weight (`EASY=1, MEDIUM=2, HARD=3`).
     - Shuffles MCQ/Multi-Select options per question using the same deterministic seed.
  3. Persists immutable `AttemptQuestionSnapshot` rows and stores `fairnessDifficultyAvg`.
- **Fairness Inspector (`/api/exams/[id]/fairness-preview` & UI tab)**:
  - Simulates `N = 20` candidate papers in real time and displays:
    - Target Difficulty Weight vs. Simulated Mean & Standard Deviation ($\sigma$)
    - Topic coverage matrix (`100%` guaranteed)
    - Side-by-side comparison of 2 generated papers showing distinct question/option order with identical difficulty balance.

---

## Verification Plan

### Automated Tests
1. `npx vitest run src/lib/__tests__/fairness.test.ts` — verify:
   - Stratified generator satisfies exact `topic × difficulty` counts across 100 simulated attempts.
   - Standard deviation of difficulty weight across simulated papers is `0` under stratified mode and within configured tolerance under pool mode.
   - Option shuffling preserves exact `correctIdsSnap` mapping.
2. `npx vitest run src/lib/__tests__/bulk-import.test.ts` — verify CSV/JSON parser catches missing columns, invalid difficulty enums, and duplicate emails with accurate row numbers.
3. `npx vitest run src/lib/__tests__/lifecycle.test.ts` — verify illegal transitions (`DRAFT` → `COMPLETED`, publishing 0-question exam) fail with `400/409`.

### Manual Verification
1. Import a sample CSV of 10 questions and 5 candidates (intentionally include 1 malformed row to verify error message, then fix & commit).
2. Create an exam using a Stratified Blueprint, run the **Fairness Preview** simulator, and publish.
3. Log in as Candidate and confirm the exam appears under Upcoming/Available correctly and rejects early access prior to `scheduledStart`.
