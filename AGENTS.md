# AGENTS.md — Engineering Rules, Spec-Driven Workflow & Git Playbook

This repository implements **AegisExam**, a Secure Examination Management System built for the **Technoverse 5.0 Web-e-Thon** using a **Spec-Driven Software Development** methodology.

Every AI agent and human contributor **MUST** follow the specifications in `docs/` and the rules in this file strictly.

---

## 1. Spec-Driven Development Mandate

1. **Review order.** Read `Web-e-Thon Problem Statement.pdf` in the repository root first. Then read [docs/00-master-specification.md](./docs/00-master-specification.md), the active plan, and any relevant work logs and handoffs before editing:
   - **Plan 1**: [docs/01-foundation-auth-rbac.md](./docs/01-foundation-auth-rbac.md)
   - **Plan 2**: [docs/02-question-bank-exams-fairness.md](./docs/02-question-bank-exams-fairness.md)
   - **Plan 3**: [docs/03-exam-delivery-resilience-workspace.md](./docs/03-exam-delivery-resilience-workspace.md)
   - **Plan 4**: [docs/04-monitoring-grading-analytics-reports.md](./docs/04-monitoring-grading-analytics-reports.md)
   - **Plan 5**: [docs/05-disputes-polish-verification-deploy.md](./docs/05-disputes-polish-verification-deploy.md)
2. **Strict Plan Adherence**:
   - Execute plans **in order (Plan 1 → Plan 5)**. Do not start a later plan until all automated tests and verification steps of the current plan pass.
   - Do not invent unrequested features or alter the Prisma schema, RBAC model, or API contracts without first updating the corresponding specification in `docs/`.
   - If the competition brief, master specification, or phase plans conflict, show the project owners the conflicting sections, explain the impact, and propose a resolution. Wait for their decision before implementing the affected work. Record the approved decision in the relevant plan and handoff.
3. **Zero Placeholders**: Never leave stubbed buttons, mocked endpoints, or `TODO` placeholders in completed plan milestones. Every visible UI control must connect to real validated backend logic and PostgreSQL persistence.

---

## 2. Architecture & Code Quality Best Practices

### 2.1 TypeScript, Validation & Layering
- **Strict Typing**: Keep TypeScript `"strict": true`. Never use `any` or `@ts-ignore`; define explicit interfaces and Zod-inferred types (`z.infer<typeof Schema>`).
- **Thin Route Handlers, Pure Domain Modules**:
  - Keep Next.js Route Handlers (`src/app/api/**/route.ts`) focused on auth/RBAC checks, Zod request parsing, calling pure service modules in `src/lib/`, and returning consistent JSON responses via `apiHandler()`.
  - Put core algorithms (`fairness.ts`, `grading.ts`, `bulk-import.ts`, `analytics.ts`, `verification.ts`, `pdf-reports.ts`) in `src/lib/` so they are 100% unit-testable with Vitest without needing HTTP mocking.
- **No Duplicated Logic**: Share Zod validation schemas, RBAC helpers, and DTO serializers across routes instead of duplicating checks.
- **Clean Error Handling**: Return structured JSON errors (`{ error: { code, message, details? } }`) with proper HTTP status codes (`400`, `401`, `403`, `404`, `409`, `422`, `500`). Never leak stack traces or SQL errors to clients.

### 2.2 Security & Data Integrity Invariants (Non-Negotiable)
1. **Backend-Enforced RBAC**:
   - Every protected `/api/*` route MUST call `requireAuth(allowedRoles)` as its first operation.
   - Verify resource ownership on the server (`exam.createdById === session.userId || session.role === 'ADMIN'`, `attempt.userId === session.userId`).
   - Verify `user.isActive === true` on authentication and sensitive mutations.
2. **Zero Answer-Key Leakage**:
   - Never serialize `Question.correctIdsJson`, `AttemptQuestionSnapshot.correctIdsSnap`, or `explanation` to Candidate endpoints while an exam is unsubmitted or unpublished (`attempt.status !== 'PUBLISHED' || exam.resultsPublishedAt === null`).
3. **Server-Authoritative Timing**:
   - Compute `hardDeadlineAt = min(startedAt + durationMinutes, scheduledEnd)` strictly on the server.
   - Reject answer sync mutations arriving past `hardDeadlineAt + 5000ms` (grace buffer for in-flight requests) and finalize expired attempts atomically.
4. **Idempotency & Concurrency Safety**:
   - Finalize attempts with an atomic conditional update (`WHERE id = ... AND status = 'IN_PROGRESS'`) so duplicate `/submit` requests never corrupt scores or create duplicate records.
   - Use monotonic `clientSeq` comparison on `/api/attempts/[id]/sync` so reconnected offline queues never overwrite newer answers.
5. **Sandbox Isolation**:
   - Every monitoring, grading, analytics, leaderboard, and publication query MUST include `isSandbox: false`.
6. **Non-Conclusive Monitoring Policy**:
   - Treat browser/network telemetry (`TAB_BLUR`, `FULLSCREEN_EXIT`, `HEARTBEAT_LOST`) strictly as **review signals**, never as automated proof of misconduct. Never auto-fail or lock out a candidate based on monitoring signals alone.
7. **Privacy-Safe Public Verification**:
   - `/verify/[code]` and `/api/verify/[code]` must expose only masked candidate info, exam title, score, issue date, and verification status—never email addresses, question contents, or raw answers.
8. **Zero Paid APIs**:
   - Do not add any feature requiring paid API keys, external billing, or proprietary datasets.

### 2.3 UI/UX & Accessibility Standards
- Use consistent design tokens (`slate`/`indigo`/semantic status colors), clear information hierarchy, and responsive layouts.
- Support keyboard navigation and ARIA attributes (`aria-label`, `aria-live` for network status & announcements, visible focus rings, icon+color redundancy for question palette states).
- Preserve existing comments/documentation when editing files, and document non-obvious invariants concisely.

---

## 3. Mandatory Verification Gates

Before committing a completed feature or finishing any Plan, run **all** relevant checks and ensure zero errors:

```bash
# 1. Regenerate Prisma client & check schema sync
npx prisma generate

# 2. Static type checking & linting
npm run typecheck
npm run lint

# 3. Unit & integration tests
npx vitest run

# 4. Production build check
npm run build
```

When Plan 5 is complete, also verify:
```bash
npx playwright test
docker build -t aegis-exam .
```

---

## 4. Git Workflows & Command Reference

> [!CAUTION]
> **Competition Integrity Rule (Section 07)**:
> - Maintain clean, honest, incremental commit history from the start.
> - **NEVER** manipulate commit timestamps (`GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE`) or force-push rewritten history after submission.
> - **NEVER** commit `.env`, database dumps with real secrets, `node_modules/`, or `.next/`.

### 4.1 Initial Repository Setup (Before Plan 1)
```bash
git init -b main
git status
# Create .gitignore first (node_modules, .next, .env, coverage, *.log)
git add .gitignore "Web-e-Thon Problem Statement.pdf" docs/ AGENTS.md
git commit -m "docs: add problem statement, master spec, phased plans, and AGENTS.md"
```

### 4.2 Starting a Plan Branch
Each plan **MUST** use its own dedicated branch for implementation, verification fixes, and plan documentation. Keep `main` for integration. Check the working tree and preserve existing changes before switching branches. Resume the existing plan branch when continuing unfinished work. For a new plan, branch from the current `main` after the previous plan and its handoff have been merged.

Example for a new Plan 1 branch:
```bash
git checkout main
git pull --ff-only origin main   # if remote exists
git checkout -b feat/plan-01-foundation
```
Use the following branch names:
- `feat/plan-01-foundation`
- `feat/plan-02-question-bank-fairness`
- `feat/plan-03-exam-delivery-resilience`
- `feat/plan-04-monitoring-grading-reports`
- `feat/plan-05-disputes-polish-deploy`

### 4.3 Daily Development & Atomic Commits
Use **Conventional Commits** scoped to the module/plan:
- `feat(plan-1): ...` — new functionality
- `fix(plan-3): ...` — bug fix
- `test(plan-2): ...` — unit/integration/E2E tests
- `docs(spec): ...` — spec or README updates
- `chore(infra): ...` — Docker, lint, dependencies

```bash
# Inspect changes before staging
git status
git diff

# Stage specific files (avoid blind `git add -A` when untracked temp files exist)
git add prisma/schema.prisma src/lib/auth.ts src/lib/rbac.ts

# Review staged diff
git diff --staged

# Commit with clear message
git commit -m "feat(plan-1): implement JWT cookie auth and backend RBAC guards"
```

### 4.4 Syncing & Handling Context Switches
```bash
# Temporarily shelve uncommitted work without losing it
git stash push -m "wip: scratchpad canvas strokes"
git stash list
git stash pop

# Rebase feature branch cleanly on updated main (ONLY before merging/pushing shared work)
git fetch origin
git rebase origin/main
```

### 4.5 Completing & Merging a Plan into `main`
Merge only after all verification gates in Section 3 pass and the work log and handoff required by Section 5 are committed on the plan branch.
Run the following checks on the plan branch and confirm it has a clean working tree before switching to `main`.
```bash
# Verify clean working tree & passing checks
npx prisma generate && npm run typecheck && npm run lint && npx vitest run && npm run build

# Switch to main and merge with --no-ff to preserve plan milestone boundaries
git checkout main
git merge --no-ff feat/plan-01-foundation -m "merge: complete Plan 1 (foundation, auth, RBAC, admin)"

# Tag the verified milestone
git tag -a v0.1-plan-1 -m "Plan 1 verified: auth, RBAC, schema, seed, admin console"

# Push main and tags (if remote configured)
git push origin main --tags

# Clean up merged local branch
git branch -d feat/plan-01-foundation
```

### 4.6 Safe Rollback & Recovery (No History Destruction)
```bash
# Discard unstaged edits in a specific file
git restore src/path/to/file.ts

# Unstage a file without losing edits
git restore --staged src/path/to/file.ts

# Safely undo a bad commit already on main (creates a new compensating commit)
git revert <commit-sha>

# Reset ONLY local uncommitted/unpushed mistake carefully
git reset --soft HEAD~1   # keeps changes staged
```

### 4.7 Pre-Submission Audit & Freeze Checklist
Run before the competition deadline:
```bash
# 1. Confirm no uncommitted changes or untracked secrets
git status

# 2. Verify .env is ignored and NOT tracked in Git
git ls-files | grep -E '(^\.env$|\.env\.local$)' || echo "OK: no secret env files tracked"

# 3. Review full commit history & tags
git log --oneline --decorate --graph -n 30

# 4. Run full verification from clean state
npm ci && npx prisma generate && npm run typecheck && npm run lint && npx vitest run && npm run build

# 5. Final submission tag & push
git tag -a v1.0-submission -m "Final Web-e-Thon submission"
git push origin main --tags
```

---

## 5. Plan Documentation & Handoff

1. **Before starting a plan**, read `docs/WORK_DONE.md` and the preceding plan's handoff, when they exist. Confirm the branch, current status, and dependencies against the repository.
2. **At the end of each plan, or before handing off unfinished work**, update `docs/WORK_DONE.md` with the plan number, status (`in progress`, `blocked`, or `complete`), delivered requirements, and a link to the detailed handoff. Create or update the handoff in `docs/handoffs/` using the same filename as the plan, for example `docs/handoffs/01-foundation-auth-rbac.md`.
3. **Each handoff must include** the plan branch and relevant implementation commit IDs, what was completed, key files and interface or schema changes, approved decisions and open questions, exact verification commands and their outcomes, and the next agent's first actionable step. Record checks that failed or were skipped and explain why. For unfinished work, state what remains and where to resume.
4. **Commit the work log and handoff on the plan branch** before merging or transferring the work. Mark a plan complete once its verification passes and its documentation is committed. Keep the handoff current if later fixes change what was verified or what the next agent needs to do.
