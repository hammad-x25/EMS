# Plan 5 — Trust & Dispute Resolution, Polish, Verification & Deployment

> Parent Specification: [Master Specification & Architecture](./00-master-specification.md)

## Goal Description
Implement **Open Innovation 5.4: Trust & Dispute Resolution** (transparent post-result appeals, regrade workflow, and report versioning), conduct a full **UI/UX, Accessibility & Security Audit**, add automated **E2E Smoke Tests**, and finalize the **Dockerized deployment**, `README.md`, and 15-minute live demo readiness.

**Covers PDF Requirements**: `5.4 Trust & Dispute Resolution`, `06 Technical Requirements & Constraints`, `07 Submission Requirements`, `08 UI/UX & Evaluation Readiness`.

---

## Proposed Changes

### 1. Open Innovation 5.4 — Trust & Dispute Resolution
#### [NEW] `src/app/api/disputes/route.ts` & `src/app/api/disputes/[id]/resolve/route.ts`
- **Candidate Filing (`POST /api/disputes`)**:
  - Allowed only on Candidate's own `PUBLISHED` attempt.
  - Categories: `GRADING_ERROR`, `AMBIGUOUS_QUESTION`, `TECHNICAL_INCIDENT`, `INCIDENT_APPEAL`.
  - Links optionally to `snapshotId` and attaches a view of relevant `AttemptEvent` logs.
- **Examiner / Admin Resolution (`POST /api/disputes/[id]/resolve`)**:
  - Supports 3 transparent outcomes:
    1. `RESOLVED_UPHELD`: Original grade/decision stands with mandatory examiner explanation.
    2. `RESOLVED_ADJUSTED`: Updates `manualScore` (with `0 <= score <= maxMarks` guard) OR applies `scoreDelta` (e.g., if `AMBIGUOUS_QUESTION` is accepted), recalculates `Attempt.totalScore`, writes an immutable `AuditLog` entry, and **issues a new `ReportVerification` version (`version + 1`)** so older PDFs show `SUPERSEDED` on `/verify/[code]`!
    3. `REJECTED`: Closes invalid dispute with explanation.

#### [NEW] `src/app/examiner/disputes/page.tsx` & Candidate Dispute Drawer (`src/components/results/DisputePanel.tsx`)
- Examiner workbench displays dispute reason, exact `AttemptQuestionSnapshot` prompt & candidate's answer, logged connectivity/focus timeline, and one-click resolution form.
- Candidate Results page shows live dispute status timeline (`OPEN` → `UNDER_REVIEW` → `RESOLVED_ADJUSTED`).

---

### 2. UI/UX Consistency, Accessibility & Edge-Case Hardening
#### [MODIFY] App-wide Polish
- Audit every route for:
  - Consistent visual hierarchy, crisp empty states, loading skeletons, and actionable error banners (no raw stack traces or generic placeholder cards).
  - Keyboard accessibility (visible focus rings, `aria-label` on icon buttons, semantic `<main>`, `<nav>`, `<header>` landmarks).
  - Mobile & tablet responsiveness across Dashboards and Exam Workspace.
  - Security header checks (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) in `next.config.ts`.

---

### 3. Production Dockerization & Submission Deliverables (07)
#### [NEW] `Dockerfile`, `.dockerignore`, & `docker-compose.prod.yml`
- Multi-stage Next.js standalone production `Dockerfile` (`node:24-alpine`) running `prisma migrate deploy` / `db push` + `next start`, ready for Render / Railway / Fly.io / VPS deployment.
- `/api/health` endpoint verifying Next.js + PostgreSQL connectivity (`SELECT 1`).

#### [NEW] `README.md`
- Clear project overview, architecture summary, local & Docker setup instructions, exact **test credentials for Admin, Examiner, and Candidate**, environment variables, and dedicated explanation of the **Open Innovation Challenges (5.2, 5.3, 5.4)** and design trade-offs.

#### [NEW] `e2e/exam-lifecycle.spec.ts` (Playwright)
- End-to-end automated walkthrough testing:
  1. Admin login & user role check
  2. Examiner creates/publishes exam & views Sandbox
  3. Candidate starts exam, saves answers, goes offline/online, submits
  4. Examiner grades written response, publishes results
  5. Candidate downloads PDF, verifies QR code at `/verify/[code]`, files a dispute, Examiner resolves & updates score.

---

## Verification Plan

### Automated Tests
1. `npx vitest run` — all unit & integration suites pass (`auth-rbac`, `fairness`, `bulk-import`, `lifecycle`, `attempts-sync`, `grading`, `analytics-verification`, `disputes`).
2. `npm run typecheck && npm run lint && npm run build` — zero TypeScript, ESLint, or Next.js production build errors.
3. `docker build -t aegis-exam .` — verify production container builds cleanly.
4. `npx playwright test` — full E2E critical path passes against running server.

### Manual Verification (Final 15-Minute Demo Rehearsal)
1. Fresh database boot (`docker compose up -d && npx prisma db push && npx prisma db seed`).
2. Walk through all 3 roles + all 8 secondary features + 3 innovation features end-to-end without manual DB edits.
3. Confirm Git commit history is clean and `README.md` matches all seeded credentials and startup commands.
