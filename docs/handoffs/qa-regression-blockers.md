# Handoff — Post-Implementation QA Regression Blockers

## State

- Branch: `fix/qa-regression-blockers`
- Integration base: `main` at `04681ed`
- Implementation commits: `0cb2272`, `8653e7b`
- Documentation commit: the commit containing this handoff
- Scope: DEF-001 save/submit race, DEF-002 expiry consistency, and dependency-advisory remediation
- Schema changes: none
- Approved decisions: [docs/DECISIONS.md](../DECISIONS.md), Decisions 15–16

## Delivered

### DEF-001 — Race-safe answer save and final submission

- `src/lib/attempts.ts`
  - Extracts shared mutation validation/application into a transaction-aware helper.
  - Runs answer sync and final submission at Prisma `Serializable` isolation with up to three retries for `P2034` write conflicts.
  - Applies pending mutations and the conditional `IN_PROGRESS` to final-status update in one transaction.
  - Returns structured `SYNC_RETRY_REQUIRED` or `SUBMIT_RETRY_REQUIRED` conflicts if serialization still fails after retries.
  - Preserves monotonic `clientSeq`; duplicate and stale edits remain ignored.
- `src/app/api/attempts/[id]/submit/route.ts`
  - Accepts an optional JSON body `{ mutations: AnswerMutation[] }`.
  - Empty-body submissions remain backward-compatible and are parsed as `{ mutations: [] }`.
  - Uses the shared `SubmitAttemptSchema` with a maximum of 100 mutations.
- `src/components/exam/ExamWorkspace.tsx`
  - Reads the IndexedDB queue once and sends pending mutations with final submission.
  - Refuses finalization while offline if edits remain queued.
  - Removes local mutations only after the server confirms submission.
  - Keeps pending count and visible `SYNC_ERROR` / `OFFLINE_QUEUED` state when submission fails, allowing retry.

### DEF-002 — One authoritative deadline policy

- The answer cutoff is `effectiveDeadlineAt + 5000ms`, inclusive.
- `calculateAnswerCutoff()` is shared by sync, heartbeat/get-attempt expiry, and submission.
- Heartbeat no longer expires an attempt during the documented grace window.
- A sync arriving after the cutoff atomically marks the attempt `EXPIRED` and returns `ATTEMPT_EXPIRED`.
- The immutable `hardDeadlineAt` and audited extensions remain unchanged.

### Dependency advisory remediation

- `vitest`: `3.2.7` to `4.1.12`.
  - Removes the two critical development-only advisories from vulnerable Tinypool and Vitest mocker versions.
- `postcss`: `8.5.6` to `8.5.34` plus npm `overrides`.
  - Replaces both the direct tooling copy and Next.js's nested production copy, resolving the high-severity source-map file-disclosure advisories without a Next.js major upgrade.
- The installed production tree keeps Next.js `15.5.29`; no framework API migration was required.

## Key interfaces

### Final submission request

```http
POST /api/attempts/:id/submit
Content-Type: application/json

{
  "mutations": [
    {
      "snapshotId": "...",
      "selectedIds": ["b"],
      "markedForReview": false,
      "clientSeq": 12,
      "capturedAt": "2026-11-27T12:00:00.000Z"
    }
  ]
}
```

- `mutations` is optional and defaults to `[]`.
- A successful response remains `{ attempt: AttemptDto }`.
- New retryable conflict codes: `SYNC_RETRY_REQUIRED`, `SUBMIT_RETRY_REQUIRED` (`409`).

## Verification commands and outcomes

The dedicated QA PostgreSQL database used:

```text
postgresql://aegis:***@localhost:5432/aegis_exam?schema=public
```

Commands:

```powershell
npx prisma generate
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm audit --json
npm audit --omit=dev --json
npm ls next postcss vitest tinypool @vitest/mocker --all
```

Outcomes:

- Prisma generation: passed, Prisma Client `6.12.0`.
- TypeScript: passed.
- ESLint: passed with zero warnings.
- Vitest `4.1.12`: 12 files, 42/42 tests passed.
- Production build: passed; all 18 static pages and dynamic/API routes compiled.
- Full npm audit: 0 vulnerabilities.
- Production-only npm audit: 0 vulnerabilities.
- Installed dependency tree: PostCSS `8.5.34` deduped/overridden across Tailwind, Vite, and Next; Vitest `4.1.12` with `@vitest/mocker 4.1.12`; vulnerable Tinypool is absent.

Focused database regression used a local-only Vitest file, consistent with the QA artifact policy. Results:

- Heartbeat at deadline +1 second left the attempt `IN_PROGRESS`; sync exactly at deadline +5 seconds was accepted.
- 20/20 concurrent `syncAnswers()` and `submitAttempt(...pendingMutations)` trials finalized consistently with the correct persisted option and score `2`.

Browser verification notes:

- The default Playwright development-server run exceeded its existing 60-second test timeout; this is a harness timeout, not a confirmed product regression.
- A production-server rerun was initiated after a clean database seed and fresh production build. The run was interrupted before final runner output, so it is not recorded as passed or failed.
- The existing Plan 5 browser suite passed before this fix; rerun it from a clean seed before merging if time permits.

## Known issues and pending work

- Vitest 4 emits a non-failing notice that the CommonJS-loaded `vitest.config.ts` uses ESM syntax. Tests pass; a future cleanup can rename the config to `.mts` or opt into ESM.
- The full Playwright lifecycle should be rerun against a clean database with a production server and a timeout above 60 seconds. Do not reuse a database containing a finalized sandbox attempt.
- No Docker image rebuild was performed in this fix pass; the production application build passed.

## Next agent's first step

From this branch, start the dedicated PostgreSQL service, reset and seed only the test database, then run the production Playwright lifecycle with an extended timeout. If it passes, merge `fix/qa-regression-blockers` into `main` with `--no-ff`. Do not push or deploy unless separately authorized.
