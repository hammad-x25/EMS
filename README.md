# AegisExam — Secure Examination Management System

AegisExam is a full-stack secure examination management system built for the **Technoverse 5.0 Web-e-Thon** using a spec-driven software development methodology. It covers the full examination lifecycle—role-based authentication, reusable question banks, CSV/JSON bulk import, stratified fairness-balanced paper generation, failure-resilient offline delivery, live SSE monitoring, auto/manual grading, question analytics, QR-verifiable PDF scorecards, and transparent dispute resolution.

## Technology Stack

- **Framework**: Next.js 15 (App Router, React 19, TypeScript `strict: true`, Tailwind CSS 4)
- **Database**: PostgreSQL 16 + Prisma ORM (`prisma/schema.prisma`)
- **Security & Validation**: Signed `httpOnly` JWT cookies (`jose`), `bcryptjs` hashing, `zod` schemas, security response headers
- **Resilience & Real-Time**: IndexedDB offline mutation queue + scratchpad (`idb`), Server-Sent Events (SSE) with 5s DB snapshot fallback
- **Reporting & Imports**: `papaparse` (CSV), `pdfkit` (PDF generation), `qrcode` + HMAC-SHA256 verification
- **Testing**: Vitest (unit/integration) + Playwright (end-to-end)

Zero paid APIs or external billing-dependent services are used.

---

## Local Development Setup

**Prerequisites**: Node.js 20+, npm, Docker & Docker Compose.

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

Open `http://localhost:3000` (or use `npm run dev -- -p 4000` if port `3000` is occupied).

### Production Docker Setup (Provider-Neutral)

```bash
# 1. Build the standalone image
docker build -t aegis-exam .

# 2. Run app + PostgreSQL via docker-compose.prod.yml (set AUTH_SECRET & REPORT_HMAC_SECRET)
AUTH_SECRET="replace-with-32-plus-char-secret" \
REPORT_HMAC_SECRET="replace-with-32-plus-char-hmac" \
docker compose -f docker-compose.prod.yml up -d --build
```

Verify health at `GET /api/health`. Note that production session cookies set `secure: true` and require HTTPS behind a reverse proxy or TLS terminator.

---

## Evaluation Credentials (Seeded Fictional Data)

| Role | Email | Password | Seeded Data |
|---|---|---|---|
| **Administrator** | `admin@aegisexam.local` | `Admin@123!` | Global overview, user/role management, audit log, health |
| **Examiner 1** | `examiner1@aegisexam.local` | `Examiner@123!` | 24 questions, 4 exams (`ongoing`, `upcoming`, `draft`, `results`), enrollments |
| **Examiner 2** | `examiner2@aegisexam.local` | `Examiner@123!` | Secondary examiner account (isolated from Examiner 1's private exams) |
| **Candidates 1–5** | `candidate1@aegisexam.local` … `candidate5@aegisexam.local` | `Candidate@123!` | Enrolled in `seed-exam-ongoing`, `seed-exam-upcoming`, and `seed-exam-results` |

---

## Core & Secondary Features Implemented

- **Authentication & Backend RBAC (3.1)**: Cookie JWT sessions, DB-backed `isActive` verification, role & resource-ownership guards on every `/api/*` route, Admin user/role/audit/health console.
- **Exam Lifecycle & Question Bank (3.2, 3.3, 3.4)**: `DRAFT` → `PUBLISHED` → `ONGOING` → `COMPLETED` server-time reconciliation; Single-MCQ, Multi-Select, and Written questions; Candidate dashboard grouped into `Available Now`, `Upcoming`, and `Completed`.
- **Delivery Workspace & Secondary Features (3.5–3.8, 4.1–4.8)**:
  - **4.1 Network-Aware Interface**: Live connectivity & queue state indicator (`Synced`, `Saving`, `Offline — queued locally`).
  - **4.2 PDF Reports**: Access-restricted Candidate Scorecards and Examiner Cohort Summaries generated via `pdfkit`.
  - **4.3 Examination Sandbox**: Examiner candidate-view preview (`isSandbox: true`), excluded from all real submissions, monitoring, grading, and analytics.
  - **4.4 Bulk Data Import**: CSV/JSON dry-run validator & transactional importer for questions and candidates (with optional auto-enrollment).
  - **4.5 Question Analytics**: Skip rate, correctness rate, observed difficulty index, distractor selection counts, and review flags.
  - **4.6 Verifiable Reports**: Unique `AEG-XXXX-XXXX` codes, embedded QR codes, and privacy-safe public verification at `/verify/[code]` (exposing only masked name/ID, exam title, score, date, and version).
  - **4.7 Customizable Workspace**: Persistent font size, light/dark/high-contrast theme, palette position, compact mode, and timer visibility toggle.
  - **4.8 Digital Scratchpad**: Persistent per-attempt freehand drawing canvas and quick math/text notes stored in IndexedDB.

---

## Open Innovation Challenges (Section 05)

### 1. Fairness of Randomized Examinations (5.2)
- **Solution**: Stratified `Topic × Difficulty` Blueprints (`ExamBlueprintRule`) paired with deterministic cryptographic seeds (`HMAC-SHA256` per attempt) in `src/lib/fairness.ts`.
- **Trade-off**: Guarantees every candidate receives a distinct question & option permutation with identical topic coverage and near-zero difficulty variance (`σ = 0` under stratified rules), while requiring sufficient pool depth per stratum before publication. Examiners can validate balance prior to release via the **20-Paper Fairness Variance Inspector**.

### 2. Failure-Resilient Examinations (5.3)
- **Solution**: Server-authoritative deadlines (`hardDeadlineAt` + audited `timeExtensionMinutes`) combined with an IndexedDB offline queue using monotonic `clientSeq` ordering (`src/lib/offline-queue.ts`, `src/lib/attempts.ts`).
- **Trade-off**: Candidates never lose work during network drops, and cannot exploit offline mode for extra time because mutations past `effectiveDeadlineAt + 5s` are rejected. Genuine connectivity gaps recorded by the server heartbeat monitor allow examiners to grant justified, audited time extensions (`POST /api/attempts/[id]/extend`).

### 3. Trust & Dispute Resolution (5.4)
- **Solution**: Structured post-result appeals (`src/lib/disputes.ts`, `/examiner/disputes`, `DisputePanel`) backed by immutable attempt snapshots, server incident timelines, and `AuditLog` entries.
- **Trade-off**: Upholding, rejecting, or adjusting scores (question-level or attempt-level) preserves total-score invariants and automatically issues a **new `ReportVerification` version**, immediately marking superseded verification codes as `REVOKED_SUPERSEDED` on `/verify/[code]`.

---

## Verification Commands

```bash
npx prisma generate
npm run typecheck
npm run lint
npm test
npm run build
npx playwright test
docker build -t aegis-exam .
```
