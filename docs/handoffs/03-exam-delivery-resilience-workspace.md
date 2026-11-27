# Handoff — Plan 3 Exam Delivery, Failure Resilience, Workspace & Sandbox

## State

- Branch: `feat/plan-03-exam-delivery-resilience`
- Integration base: `main` at `6e2ebf3`
- Implementation commits: `4159e05`, `f91df75`, `787ba8e`, `17ecc30`, `785557c`, `0ee221b`, `5b5132c`, `10baba7`
- Working milestone: Plan 3 complete and verified; Plans 4–5 not started on this branch
- Approved decisions: [docs/DECISIONS.md](../DECISIONS.md)
- Timing decision applied: preserve immutable `hardDeadlineAt`; calculate `effectiveDeadlineAt = hardDeadlineAt + timeExtensionMinutes`; Plan 3 finalizes only to `SUBMITTED` or `EXPIRED`, while Plan 4 owns grading transitions.

## Delivered

- **Attempt initialization and sanitized snapshots (`src/lib/attempts.ts`, `/api/exams/[id]/start`)**:
  - Requires an active candidate enrollment/window, resumes the existing in-progress attempt, and rejects finalized re-entry.
  - Creates a balanced deterministic paper inside a serializable transaction, stores immutable prompts/options/answer keys, and returns a Candidate DTO that excludes `correctIdsSnap` and explanations.
  - Sets `hardDeadlineAt = min(start + duration, scheduledEnd)` for candidates and preserves extensions separately.
- **Resilient synchronization (`/api/attempts/[id]/{sync,heartbeat,events,submit}`)**:
  - Applies only a strictly newer per-question `clientSeq`, batches mutations in sequence order, allows the approved 5-second transport grace, and rejects/expires genuinely late updates.
  - Records `RECONNECTED` after a heartbeat gap over 15 seconds and records `TAB_BLUR`, `FULLSCREEN_EXIT`, and `PASTE_ATTEMPT` as neutral `NOTICE` events.
  - Submission is conditional on `IN_PROGRESS`; repeated calls return the same finalized attempt.
- **IndexedDB resilience (`src/lib/offline-queue.ts`)**:
  - Stores the latest mutation per `(attemptId, snapshotId)`, removes only acknowledged sequence versions, preserves queued work during refresh, retries with exponential backoff, and probes every 5 seconds while disconnected/erroring.
  - Stores scratchpad notes and drawing data per attempt.
- **Shared Candidate/Sandbox Workspace (`src/components/exam/**`)**:
  - Server-clock countdown, warning states, exact sync status/count, objective and written answers, icon-distinct question palette, N/P/M shortcuts, mark-for-review, active announcements, and review/submit summary.
  - Candidate route: `/candidate/exams/[id]/take`; Candidate Portal now exposes Start/Resume actions.
  - Preferences drawer: font size, theme, palette position, compact mode, timer visibility; persists to `/api/preferences` with localStorage fallback.
  - Scratchpad drawer: pen, eraser, undo, clear, and quick notes persisted in IndexedDB.
- **Examiner Sandbox (`/api/exams/[id]/sandbox`, `/examiner/exams/[id]/sandbox`)**:
  - Reuses the Candidate Workspace for examiner-owned DRAFT/PUBLISHED/ONGOING exams.
  - Displays an explicit non-production banner and supports reset after preview/submission.
  - Existing exam DTO counts remain filtered to `isSandbox: false`; Plan 4 must retain this filter for monitoring, grading, publication, and analytics.

## Schema and API Changes

### Prisma

- `Attempt` now has `@@unique([examId, userId, isSandbox])`, enforcing one real and one sandbox attempt per user/exam combination.
- No columns or enums were added; Plan 1's future-facing `Attempt`, snapshot, answer, event, announcement, and preference models were reused.

### New API surface

- `POST /api/exams/[id]/start`
- `POST|DELETE /api/exams/[id]/sandbox`
- `GET /api/attempts/[id]`
- `POST /api/attempts/[id]/sync`
- `POST /api/attempts/[id]/heartbeat`
- `POST /api/attempts/[id]/events`
- `POST /api/attempts/[id]/submit`
- `GET|PATCH /api/preferences`

The attempt DTO contains question snapshots, saved responses, announcements, `serverNow`, immutable/effective deadlines, and no answer key. Sync accepts `{ mutations: [{ snapshotId, selectedIds?, writtenText?, markedForReview, clientSeq, capturedAt }] }`.

## Verification Commands and Outcomes

Database commands were run with the local Docker URL because `.env` intentionally contains no `DATABASE_URL`:

```powershell
docker compose up -d
$env:DATABASE_URL='postgresql://aegis:aegis_dev_password@localhost:5432/aegis_exam?schema=public'
npm run db:generate
npx prisma db push --accept-data-loss
npm run db:seed
npm run typecheck
npm run lint
npm test
npx vitest run src/lib/__tests__/attempts-sync.test.ts
npm run build
git diff --check
```

- Prisma generate/push/seed: passed; the unique attempt constraint applied successfully and the seed reported 8 users, 24 questions, and 3 exams.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0 with `--max-warnings=0`.
- `npm test`: 7 files, 24/24 tests passed.
- Focused attempts sync suite: 1 file, 4/4 tests passed.
- `npm run build`: exit 0; `/candidate/exams/[id]/take`, `/examiner/exams/[id]/sandbox`, five attempt endpoints, start/sandbox, and preferences compiled.
- Live workflow on `npm run dev -- -p 4000`:
  - Candidate start twice: same attempt ID returned.
  - Candidate payload: `correctIdsSnap` absent.
  - Sync sequence 10 then sequence 9: `acceptedNew: 1`, `ignoredStale: 1`, persisted sequence `10`, selected option and review flag preserved.
  - Deadline forced one minute into the past: sync returned HTTP `409`; read-back status `EXPIRED`.
  - Duplicate submit: `SUBMITTED/SUBMITTED`.
  - Preference PATCH then GET: high-contrast/large/left values persisted.
  - Sandbox start/submit/reset: `isSandbox: true`; real attempt count remained `0` before, during, and after; deleted sandbox GET returned `404`.
- Test attempts and test preference rows were deleted after smoke verification; seeded users/exams/questions remain.

## Known Issues / Pending Work

- The Chrome DevTools offline/manual canvas flow was not interactively exercised in this terminal-only run. Queue/scratchpad code passes type/lint/build checks, while the server reconnection/deadline behavior was verified live. Perform the documented browser disconnect/reconnect demonstration before judging.
- `npm audit --omit=dev` reports 2 PostCSS advisories through Next.js 15.5.29. npm only proposes Next 16.4.6, a breaking framework upgrade; evaluate that upgrade in Plan 5 rather than mixing it into delivery logic. Full audit also reports 3 test-tool advisories whose offered fix is breaking Vitest 5.
- Plan 4 remains responsible for live examiner monitoring, announcements creation, time extensions UI/API, objective/manual grading, analytics, result publication, and PDF reports. Every Plan 4 attempt query must explicitly use `isSandbox: false`.
- No push, merge, deployment, or external submission was performed.

## Next Agent's First Step

After this branch is reviewed and merged into the agreed integration branch, create the Plan 4 branch and begin with `docs/04-monitoring-grading-analytics-reports.md`. First implement the examiner monitoring query/API using `Attempt.lastHeartbeatAt`, effective deadlines, events, and announcements while filtering `isSandbox: false`; then add the extension operation without mutating `hardDeadlineAt`.
