# Work Done

## Plan 2 — Question Bank, Bulk Import, Exam Lifecycle & Fairness Engine

**Status:** Complete and verified on `feat/plan-02-question-bank-fairness`  
**Date:** 2026-11-27

### Implementation commits

- `19496ea` — add `papaparse` CSV dependency and structured HTTP error helpers
- `d25d294` — reusable Question Bank validation, ownership enforcement, and APIs
- `b3bb99f` — CSV/JSON bulk importer for questions and candidates with dry-run diagnostics
- `4a61cfa` — exam lifecycle state machine, enrollment, candidate portal API, and fairness engine
- `7ac02d8` — Examiner Question Bank, Exam Builder, Fairness Inspector, and Candidate Portal UIs
- `5a39f17` — Plan 2 sample exams, stratified blueprint rules, and candidate enrollment seeds

### Completed requirements

- PDF 3.2: examination creation, schedule/marks/scoring rules, lifecycle state machine (`DRAFT` → `PUBLISHED` → `ONGOING` → `COMPLETED`), server-time automatic lifecycle reconciliation (`reconcileExamStatuses`), and examiner ownership enforcement.
- PDF 3.3: reusable Question Bank with topic/difficulty/type filtering, `SINGLE_MCQ` / `MULTI_SELECT` / `WRITTEN` validation, safe delete protection, and snapshot-preserving edits.
- PDF 3.4: examiner candidate enrollment (individual/batch picker + unenroll protection) and Candidate Portal (`/candidate/dashboard`) grouping examinations into Available Now, Upcoming, and Completed without leaking answer keys or unpublished scores.
- PDF 4.4: bulk CSV & JSON importer (`papaparse` + Zod) for questions and candidates with dry-run preview, row-level error reporting, and transactional commit + optional exam enrollment.
- Open Innovation 5.2: Stratified Fairness-Balanced Paper Generator (`src/lib/fairness.ts`) with deterministic HMAC-seeded permutation, 20-paper Fairness Variance Inspector UI, and side-by-side sample comparison.
- Seed additions (`prisma/seed.ts`): 3 sample exams (`ONGOING` stratified, `PUBLISHED` upcoming, `DRAFT`), blueprint rules, and candidate enrollments.

### Verification summary

- `npx prisma generate` and `npx prisma db seed`: passed; 8 users, 24 questions, 3 Plan 2 exams, blueprint rules, and candidate enrollments seeded idempotently.
- TypeScript (`npm run typecheck`): passed with 0 errors.
- ESLint (`npm run lint`): passed with 0 warnings.
- Vitest (`npm test`): 5 files, 18 tests passed (`auth-rbac`, `bulk-import`, `fairness`, `lifecycle`, `question-bank`).
- Next.js production build (`npm run build`): passed; 16 static pages + all dynamic/API routes compiled cleanly.
- Live API smoke tests (`npx next dev -p 4000`): unauthenticated `/api/questions` `401`; Candidate `/api/questions` `403`; `/api/candidate/exams` returned `available: 1, upcoming: 1, completed: 0` with `leakedKey: false`; `/api/exams/seed-exam-ongoing/fairness-preview?count=20` returned `difficultyStdDev: 0, topicCoveragePercent: 100`; `/api/import/questions` dry-run flagged invalid row `2`.

See [handoffs/02-question-bank-exams-fairness.md](./handoffs/02-question-bank-exams-fairness.md) for full file inventory, API contracts, and Plan 3 continuation steps.

---

## Plan 1 — Foundation, Auth, RBAC, and Admin Operations

**Status:** Complete and verified on `feat/01-foundation-auth-rbac`  
**Date:** 2026-11-27

### Implementation commits

- `573b6d3` — approved cross-plan decisions and aligned specifications
- `bae0d90` — Next.js, Prisma, PostgreSQL, deterministic seed, and project tooling
- `cb11cef` — authentication, RBAC, role workspaces, and Admin operations
- `06f55a8` — audited dependency pins

### Completed requirements

- PDF 3.1: secure authentication for all three roles, role-specific experience, Admin account/role management, backend role enforcement, and active-account checks.
- PDF 06: password hashing, signed protected cookies, frontend/backend validation, structured errors, safe DTOs, strict TypeScript, complete future-facing schema, and Dockerized PostgreSQL.
- PDF 07 baseline: setup instructions, fictional seed data, and test credentials.
- Approved Admin extension: user directory, audit trail, system health, and global read-only examination overview.
- Deterministic seed: one Admin, two Examiners, five Candidates, and 24 reusable questions across Algorithms, Databases, and Networks.

### Pending requirements

- Plan 2: complete on `feat/plan-02-question-bank-fairness`.
- Plan 3: attempt delivery, auto-save/offline queue, server timer, preferences, scratchpad, and sandbox.
- Plan 4: monitoring, announcements, grading, results, analytics, PDF generation, and report verification.
- Plan 5: disputes, accessibility/security polish, E2E suite, production Docker image, and provider-neutral deployment documentation.

### Verification summary

- Prisma schema validate/generate: passed.
- PostgreSQL schema push and seed: passed; 8 users and 24 questions created.
- TypeScript: passed with no errors.
- ESLint: passed with no warnings.
- Vitest: 1 file, 7 tests passed.
- Next.js production build: passed; 11 pages generated and all API routes compiled.
- Live API checks: health `200`; unauthenticated Admin API `401`; Candidate-to-Admin API `403`; Admin login successful; role update persisted; password data absent.

See [handoffs/01-foundation-auth-rbac.md](./handoffs/01-foundation-auth-rbac.md) for exact commands, API/schema details, and continuation steps.

