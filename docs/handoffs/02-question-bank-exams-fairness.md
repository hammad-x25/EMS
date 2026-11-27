# Handoff — Plan 2 Question Bank, Bulk Import, Exam Lifecycle & Fairness Engine

## State

- Branch: `feat/plan-02-question-bank-fairness`
- Integration base: `main` at `5d2467a`
- Implementation commits: `19496ea`, `d25d294`, `b3bb99f`, `4a61cfa`, `7ac02d8`, `5a39f17`
- Working milestone: Plan 2 complete and verified; Plans 3–5 not started
- Approved decisions: [docs/DECISIONS.md](../DECISIONS.md)

## Delivered

- **Question Bank Domain & APIs (`src/lib/question-bank.ts`, `/api/questions`, `/api/questions/[id]`)**:
  - Strict Zod validation for `SINGLE_MCQ` (exactly 1 valid key), `MULTI_SELECT` (>= 1 valid key), and `WRITTEN` (no options/keys).
  - Examiner ownership isolation (Examiner sees/edits only their own bank; Admin has read/manage visibility) and `409 Conflict` guard preventing deletion of questions assigned to exams.
  - Edits update `Question` without mutating historical `AttemptQuestionSnapshot` records.
- **Bulk CSV & JSON Import (`src/lib/bulk-import.ts`, `/api/import/questions`, `/api/import/candidates`, `BulkImportModal.tsx`)**:
  - `papaparse` CSV + JSON parsing with row-numbered validation diagnostics (`{ row, field, message }`), dry-run preview mode, sample CSV/JSON template loaders, and transactional database commits with optional auto-enrollment.
- **Examination Lifecycle & Builder (`src/lib/exam-lifecycle.ts`, `src/lib/exam-dto.ts`, `/api/exams/**`, `/examiner/exams/**`)**:
  - Automatic server-clock lifecycle reconciliation (`PUBLISHED` → `ONGOING` → `COMPLETED`) and manual transition guards (`DRAFT` → `PUBLISHED`, `PUBLISHED` → `DRAFT`, `PUBLISHED` → `ONGOING`, `ONGOING` → `COMPLETED`) validating total marks and question pool sufficiency.
  - 5-tab Examiner Exam Builder (`Details & Rules`, `Questions / Stratified Blueprint`, `Fairness Inspector`, `Candidates & Enrollment`, `Review & Publish`).
- **Candidate Enrollment & Portal (`/api/exams/[id]/enrollments`, `/api/candidate/exams`, `/candidate/dashboard`)**:
  - Examiner candidate picker, bulk CSV/JSON enrollment, and safe unenrollment guard when attempts exist.
  - Candidate portal grouping assigned non-draft exams into `Available Now`, `Upcoming`, and `Completed`, strictly withholding answer keys and unpublished scores.
- **Open Innovation 5.2 — Stratified Fairness-Balanced Paper Generator (`src/lib/fairness.ts`, `/api/exams/[id]/fairness-preview`)**:
  - HMAC-seeded Fisher-Yates sampling across `ExamBlueprintRule` `(topic, difficulty)` strata and option permutation preserving `correctIdsSnap`.
  - Real-time 20-paper simulation report showing mean difficulty, standard deviation ($\sigma$), spread, topic coverage %, and side-by-side paper comparison.
- **Plan 2 Seed Fixtures (`prisma/seed.ts`)**:
  - Added `seed-exam-ongoing` (Stratified Blueprint, `ONGOING`), `seed-exam-upcoming` (`PUBLISHED`), `seed-exam-draft` (`DRAFT`), blueprint rules, exam question assignments, and candidate enrollments.

## Added / Modified Files

- `package.json`, `package-lock.json` (`papaparse`, `@types/papaparse`)
- `prisma/seed.ts`
- `src/lib/errors.ts`, `src/lib/question-bank.ts`, `src/lib/bulk-import.ts`, `src/lib/exam-lifecycle.ts`, `src/lib/exam-dto.ts`, `src/lib/fairness.ts`
- `src/app/api/questions/route.ts`, `src/app/api/questions/[id]/route.ts`
- `src/app/api/import/questions/route.ts`, `src/app/api/import/candidates/route.ts`
- `src/app/api/exams/route.ts`, `src/app/api/exams/[id]/route.ts`, `src/app/api/exams/[id]/questions/route.ts`, `src/app/api/exams/[id]/blueprint/route.ts`, `src/app/api/exams/[id]/transition/route.ts`, `src/app/api/exams/[id]/fairness-preview/route.ts`, `src/app/api/exams/[id]/enrollments/route.ts`
- `src/app/api/candidate/exams/route.ts`
- `src/components/AppShell.tsx`, `src/components/examiner/BulkImportModal.tsx`, `src/components/examiner/QuestionBankManager.tsx`, `src/components/examiner/ExamListManager.tsx`, `src/components/examiner/ExamBuilderWorkspace.tsx`, `src/components/candidate/CandidateExamsBoard.tsx`
- `src/app/examiner/page.tsx`, `src/app/examiner/questions/page.tsx`, `src/app/examiner/exams/page.tsx`, `src/app/examiner/exams/[id]/page.tsx`
- `src/app/candidate/page.tsx`, `src/app/candidate/dashboard/page.tsx`
- `src/lib/__tests__/question-bank.test.ts`, `src/lib/__tests__/bulk-import.test.ts`, `src/lib/__tests__/fairness.test.ts`, `src/lib/__tests__/lifecycle.test.ts`

## Verification Commands & Outcomes

```bash
npx prisma generate
npx prisma db seed
npm run typecheck
npm run lint
npm test
npm run build
```

- `npx prisma generate`: passed (Prisma Client v6.12.0).
- `npx prisma db seed`: passed (`Seeded 8 users and 24 reusable questions.` + `Seeded 3 Plan 2 examinations, blueprint rules, and candidate enrollments.`).
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0 (`--max-warnings=0`).
- `npm test`: 5 test files, 18/18 tests passed.
- `npm run build`: exit 0 (16 static pages + all API/app routes compiled).
- Live API smoke check (`npx next dev -p 4000`):
  - `GET /api/questions` unauthenticated → `401`
  - `GET /api/questions` as Candidate → `403`
  - `GET /api/candidate/exams` as Candidate → `available: 1, upcoming: 1, completed: 0`, `leakedKey: false`
  - `GET /api/exams/seed-exam-ongoing/fairness-preview?count=20` → `difficultyStdDev: 0, topicCoveragePercent: 100, samples: 2`
  - `POST /api/import/questions` dry-run with malformed CSV → `validCount: 0, errorCount: 1, row: 2`

## Next Agent's First Step

1. Review/merge `feat/plan-02-question-bank-fairness` into `main` (or branch `feat/plan-03-exam-delivery-resilience` after merging).
2. Begin **Plan 3** (`docs/03-exam-delivery-resilience-workspace.md`):
   - Install `idb` for IndexedDB offline answer queue & scratchpad persistence.
   - Implement `/api/exams/[id]/start` using `generateBalancedPaper` + `deriveAttemptSeed` from `src/lib/fairness.ts` to persist `Attempt` + `AttemptQuestionSnapshot` (stripping `correctIdsSnap` from candidate responses).
   - Implement `/api/attempts/[id]`, `/api/attempts/[id]/sync`, `/api/attempts/[id]/heartbeat`, `/api/attempts/[id]/events`, `/api/attempts/[id]/submit`, `/api/preferences`, `/api/exams/[id]/sandbox`, and the Candidate Exam Workspace UI (`/candidate/exams/[id]/take`).
