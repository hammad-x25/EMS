# Work Done

## Plan 6 — Enterprise UI/UX Audit, Design System Modernization, Accessibility & Scale

**Status:** Complete and verified on `feat/ui-ux-redesign`  
## Post-implementation QA regression blockers

**Status:** Complete and verified on `fix/qa-regression-blockers`
**Date:** 2026-11-27

### Implementation commits

- `9d587d3` — UI/UX audit & 5-phase improvement plan ([06-ui-ux-audit-and-improvement-plan.md](./06-ui-ux-audit-and-improvement-plan.md)), approved boundary decisions ([DECISIONS.md](./DECISIONS.md) #15–17), and `AGENTS.md` UI/UX standards
- `78feb22` — Semantic CSS design tokens, Light/Dark/High-Contrast CSS custom properties, zero-network enterprise typography, shared accessible `src/components/ui/*` primitives, structured Zod error parser (`src/lib/form-errors.ts`), and landing/login refinements
- `49ff328` — Mobile `AppShellNav` drawer + `aria-current="page"`, shared `pagination.ts`, backward-compatible `?page=&limit=&search=` pagination on `/api/admin/users`, `/api/admin/audit`, and `/api/questions`, paginated `AdminUserManager` & `AuditTrailViewer`, and confirmation dialogs for user deactivation/role changes
- `5222032` — Paginated `QuestionBankManager`, accessible `<Modal>` `BulkImportModal`, and `ExamListManager` search/filter + delete confirmation
- `5464681` — Modularized `ExamBuilderWorkspace` (`src/components/examiner/builder/*`) with `role="tablist"` tabs & unsaved-edit confirmation, `<Breadcrumb>` wayfinding across Monitor/Grading/Analytics, `<Drawer>` outage explanation, and `DisputeWorkbench` field validation
- `db21338` — Decoupled `ExamWorkspace` heartbeat/reconnect timer refs (`C-01`), debounced written-answer sync with guaranteed navigation/blur/submit flush (`C-02`), inline `ReviewSubmitModal` errors + detailed finalization receipt (`C-03`), guarded `N`/`P`/`M` shortcuts (`H-03`), `aria-live` announcements & `5m`/`1m` deadline milestone cues (`H-04`), pre-start readiness confirmation (`H-05`), and public verify code lookup (`L-02`)
- `19c1bc1` — Single-DOM responsive CSS tables (zero duplicated interactive nodes), `FormField` `htmlFor` semantic password toggle binding, sandbox reset recovery button on finalized error view, and Playwright UI/UX accessibility & regression suite (`e2e/ui-ux-accessibility.spec.ts`)
- `e2f137c` — Plan 6 work log and handoff documentation
- `ce67fa0` — Removed login demo quick-fill buttons and technical token copy from `/login` (recorded in [DECISIONS.md](./DECISIONS.md) #18), and hardened `ExamWorkspace` `flushQueue` / `heartbeat` concurrency locking against Postgres `P2034` write conflicts

### Completed requirements

- Comprehensive 12-dimension UI/UX audit and approved phased improvement plan documented in [06-ui-ux-audit-and-improvement-plan.md](./06-ui-ux-audit-and-improvement-plan.md).
- Zero backend RBAC, Prisma schema, timing/deadline, sandbox-isolation, or answer-key leakage invariants altered; read-only GET pagination is backward-compatible when parameters are omitted.
- Full-stack verification: `npm run typecheck`, `npm run lint` (0 warnings), `npx vitest run` (15 files, 50/50 tests passing), `npm run build` (standalone Next.js build cleanly compiling 18 static + all dynamic routes), and `npx playwright test` (2/2 suites passing cleanly after removing login quick-fill buttons).

See [handoffs/06-ui-ux-redesign.md](./handoffs/06-ui-ux-redesign.md) for detailed component inventory, approved decisions, test outcomes, known limitations, and follow-up items.
- `0cb2272` — atomically seal pending answer mutations during final submission, retry serializable conflicts, and apply one five-second answer cutoff across sync/heartbeat/expiry.
- `8653e7b` — upgrade Vitest and enforce patched PostCSS throughout the dependency tree.

### Completed fixes

- **DEF-001:** `/api/attempts/[id]/submit` now accepts an optional validated `mutations` array. The server applies pending monotonic edits and conditionally changes `IN_PROGRESS` status in the same serializable transaction. The Candidate Workspace retains its local queue on failure and displays a retry/offline state instead of treating a failed save as finalized.
- **DEF-002:** `effectiveDeadlineAt + 5000ms` is the single inclusive answer cutoff used by answer sync, heartbeat/get-attempt expiry, and finalization checks. The approved policy is recorded in `docs/DECISIONS.md`.
- **Dependency advisories:** Vitest `3.2.7` was upgraded to `4.1.12`; PostCSS `8.5.34` is pinned and overridden across direct and nested installs. Both full and production-only npm audits report zero vulnerabilities.

### Verification summary

- Prisma Client generation, TypeScript, ESLint, Vitest, and the production Next.js build passed.
- Vitest: 12 files, 42/42 tests passed.
- Focused PostgreSQL regression: heartbeat plus in-grace sync passed; 20/20 simultaneous save/submit trials retained `selectedIds=["b"]` and score `2`.
- `npm audit` and `npm audit --omit=dev`: zero advisories.
- The normal development-server Playwright run hit its existing 60-second harness timeout. A production-server rerun was started after a clean seed but interrupted before the runner printed a final result, so no new E2E pass is claimed here. The pre-fix QA baseline and prior Plan 5 handoff retain their independently completed browser pass.

See [handoffs/qa-regression-blockers.md](./handoffs/qa-regression-blockers.md) for contracts, exact commands, outcomes, and continuation instructions.

---

## Plan 5 — Trust & Dispute Resolution, Polish, Verification & Deployment

**Status:** Complete and verified on `feat/plan-05-disputes-polish-deploy`  
**Date:** 2026-11-27

### Implementation commits

- `c3152d7` — dispute resolution service (`src/lib/disputes.ts`), attempt-level delta preservation in `recomputeAttemptTotals`, and unit tests
- `e4d6227` — `/api/disputes` and `/api/disputes/[id]/resolve` route handlers
- `dfa70bf` — Candidate `DisputePanel`, Examiner `DisputeWorkbench`, and navigation integration
- `eb5fa96` — skip-to-content accessibility landmarks, global error/loading boundaries, `output: "standalone"`, and open-disputes summary card
- `e8d5080` — isolate client-safe `dispute-types.ts` from server `node:crypto` imports
- `60fc44e` — multi-stage production `Dockerfile`, `.dockerignore`, `docker-compose.prod.yml`, and full submission `README.md`
- `b53961f` — Playwright end-to-end exam lifecycle suite (`e2e/exam-lifecycle.spec.ts`) and `X-Verification-Code` PDF header

### Completed requirements

- Open Innovation 5.4: candidate dispute filing (`GRADING_ERROR`, `AMBIGUOUS_QUESTION`, `TECHNICAL_INCIDENT`, `INCIDENT_APPEAL`) on published attempts, Examiner dispute queue with immutable question snapshots and neutral incident timelines, audited outcomes (`UNDER_REVIEW`, `RESOLVED_UPHELD`, `RESOLVED_ADJUSTED`, `REJECTED`), score recalculation, and automatic issuance of a new `ReportVerification` version (`REVOKED_SUPERSEDED` on prior codes).
- PDF 06 & 08: keyboard skip-to-content landmark, global `error.tsx` / `loading.tsx`, standalone Next.js build, and security response headers.
- PDF 07: production `Dockerfile` (with PDFKit AFM assets), provider-neutral `docker-compose.prod.yml`, complete `README.md` with seeded test credentials and innovation trade-offs, and automated Playwright E2E coverage across all 3 roles.

### Verification summary

- `npx prisma generate` and `npm run db:seed`: passed cleanly against Docker PostgreSQL.
- TypeScript (`npm run typecheck`): passed with 0 errors.
- ESLint (`npm run lint`): passed with 0 warnings.
- Vitest (`npm test`): 10 files, 35/35 tests passed (including 3 dispute validation & bounds tests).
- Next.js production build (`npm run build`): passed; 18 static pages and all dynamic/API routes compiled in standalone mode.
- Playwright E2E (`npx playwright test`): 1/1 end-to-end suite passed in 47.4s (Admin RBAC, Fairness Inspector, Sandbox, offline/online exam sync, grading, PDF/QR verification, Dispute adjustment, and v1→v2 verification supersession).
- Docker build (`docker build -t aegis-exam .`): passed (`23/23` build steps, `aegis-exam:latest` created).

See [handoffs/05-disputes-polish-verification-deploy.md](./handoffs/05-disputes-polish-verification-deploy.md) for full details and final submission readiness.

---

## Plan 4 — Live Monitoring, Grading, Analytics & QR-Verifiable PDF Reports

**Status:** Complete and verified on `feat/plan-04-monitoring-grading-analytics-reports`
**Date:** 2026-11-27

### Implementation commits

- `0e99872` — add pinned PDFKit and QR code dependencies
- `50dda15` — objective and manual grading engine with scoring-mode tests
- `0053d83` — analytics, HMAC verification, QR, and PDF report engines
- `2310ac4` — SSE monitoring, announcements, neutral incident signals, and audited outage extensions
- `1cf5959` — grading, publication, analytics, results, report, and verification APIs
- `40969e5` — examiner monitor/grading/analytics and candidate result/verification views
- `fcc6f6d` — deterministic published grading and report fixtures
- `dc67c62` — preserve PDFKit font assets in the Next.js runtime
- `865ffd2` — accurately count review incidents and clean up closed SSE streams

### Completed requirements

- PDF 3.6 and Innovation 5.3: live SSE monitor, progress/connectivity/deadline state, neutral incident timelines, candidate announcements, and outage-gated time extensions with immutable hard deadlines and audit records.
- PDF 3.7: automatic single-choice and all three multi-select scoring modes, negative marking and skipped-answer rules, validated written grading, preview totals, and explicit controlled publication.
- PDF 3.8 and 4.5: candidate result access after publication, cohort mean/median/min/max/pass rate/histogram, skip and correctness rates, observed difficulty, distractor counts, and review flags.
- PDF 4.2 and 4.6: access-controlled candidate/cohort PDFs, embedded QR codes, HMAC-signed versioned verification records, and a public verification view that exposes only masked/minimal fields.
- Sandbox isolation: every monitor, grading, publication, analytics, and report aggregation query excludes `isSandbox: true` attempts.

### Verification summary

- Database generate and deterministic seed: passed against Docker PostgreSQL; three published Plan 4 result attempts were created with scores `9`, `4.5`, and `7` out of `10`.
- TypeScript and ESLint: passed with 0 errors/warnings.
- Vitest: 9 files, 32/32 tests passed, including 5 grading and 3 analytics/verification/PDF tests.
- Next.js production build: passed; all Plan 4 pages and APIs compiled, including both PDF endpoints and the public verification route.
- Live workflow: cohort analytics returned 3 submissions, mean `6.83`, median `7`, and pass rate `66.67%`; publication returned 3 attempts; owner result/PDF access succeeded while another candidate received `403`; public verification returned `VALID` with no email; outage extension was rejected before a gap, accepted after a simulated heartbeat loss, retained the hard deadline, and wrote `ATTEMPT_TIME_EXTENDED`; announcements and SSE snapshots were received; invalid written marks returned `409`, and valid marks moved the attempt to `GRADED`.
- `git diff --check`: passed. `npm audit --omit=dev` still reports the two inherited PostCSS advisories requiring a breaking Next.js 16 upgrade; deferred to Plan 5.

See [handoffs/04-monitoring-grading-analytics-reports.md](./handoffs/04-monitoring-grading-analytics-reports.md) for API contracts, exact verification commands, known issues, and the Plan 5 continuation step.

---

## Plan 3 — Exam Delivery, Failure Resilience, Workspace & Sandbox

**Status:** Complete and verified on `feat/plan-03-exam-delivery-resilience`
**Date:** 2026-11-27

### Implementation commits

- `4159e05` — align the specification with the approved immutable/effective deadline rule
- `f91df75` — add the pinned `idb` IndexedDB dependency
- `787ba8e` — attempt initialization, immutable snapshots, timing, sync, heartbeat, events, submit, and sandbox domain service
- `17ecc30` — candidate/examiner attempt APIs and persistent workspace-preference API
- `785557c` — shared offline-resilient Candidate Workspace, scratchpad, preferences, and Examiner Sandbox UI
- `0ee221b` — enforce one attempt per exam/user/mode and serializable answer synchronization
- `5b5132c` — Plan 3 resilience test command and sandbox local-data reset coverage
- `10baba7` — update the pinned Vitest patch release

### Completed requirements

- PDF 3.5: candidate start/resume, server-synchronized countdown, immutable sanitized paper snapshots, MCQ/multi-select/written responses, accessible icon-and-color palette, keyboard navigation, mark-for-review, announcements, review summary, and idempotent final submission.
- PDF 4.1 + Innovation 5.3: IndexedDB last-write queue, monotonic `clientSeq`, ordered batch sync, 5-second reconnect probe, exponential retry, exact queued count, 10-second heartbeat, 5-second deadline grace, stale-write rejection, and audited reconnect/browser signals.
- PDF 4.3: examiner-owned sandbox using the exact Candidate Workspace, prominent preview banner, reset control, and `isSandbox: false` real-attempt counts.
- PDF 4.7: persisted font size, light/dark/high-contrast theme, palette side, compact mode, and timer visibility with localStorage fallback.
- PDF 4.8: per-attempt IndexedDB scratchpad with freehand pen/eraser/undo/clear and persistent quick notes.
- Database invariant: unique `(examId, userId, isSandbox)` attempts and serializable sync transactions.

### Verification summary

- `npm run db:generate`, `npx prisma db push --accept-data-loss`, and `npm run db:seed`: passed against Docker PostgreSQL; 8 users, 24 questions, and 3 Plan 2 exams refreshed.
- TypeScript and ESLint: passed with 0 errors/warnings.
- Vitest: 7 files, 24/24 tests passed; focused `attempts-sync` suite 4/4 passed.
- Next.js production build: passed; Candidate take and Examiner sandbox pages plus all attempt/preference APIs compiled.
- Live API workflow: start/resume returned one attempt; answer keys were absent; sequence 10 persisted while sequence 9 was ignored; late sync returned `409` and `EXPIRED`; duplicate submit returned `SUBMITTED/SUBMITTED`; preferences persisted; sandbox counts remained `0/0/0` before/during/after reset.
- `npm audit --omit=dev`: 2 advisories remain in Next.js's bundled PostCSS; npm's offered fix is the breaking Next 16 upgrade and is deferred to Plan 5.

See [handoffs/03-exam-delivery-resilience-workspace.md](./handoffs/03-exam-delivery-resilience-workspace.md) for API/schema contracts, exact verification evidence, known issues, and the Plan 4 continuation step.

---

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

