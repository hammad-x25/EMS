# Handoff — Plan 4 Live Monitoring, Grading, Analytics & QR-Verifiable PDF Reports

## State

- Branch: `feat/plan-04-monitoring-grading-analytics-reports`
- Integration base: `main` at `c213a92`
- Implementation commits: `0e99872`, `50dda15`, `0053d83`, `2310ac4`, `1cf5959`, `40969e5`, `fcc6f6d`, `dc67c62`, `865ffd2`
- Working milestone: Plan 4 complete and verified; Plan 5 is not started on this branch.
- Approved decisions: [docs/DECISIONS.md](../DECISIONS.md). This implementation follows the approved controlled publication, immutable/effective deadline, neutral-monitoring, and minimal public verification rules. No new specification conflict was discovered.
- No push, merge, deployment, or external submission was performed.

## Delivered

- **Live monitor and SSE (`src/lib/event-bus.ts`, `src/lib/monitoring.ts`, `/api/exams/[id]/{stream,monitor,announcements}`)**:
  - Streams live events with a five-second database snapshot fallback and keepalive messages.
  - Shows real-attempt progress, connectivity gap, immutable/effective deadlines, time extensions, and chronological neutral review signals.
  - Broadcasts announcements to active candidate workspaces.
  - Allows an owning examiner to extend time only after a recorded outage signal and only with a reason; keeps `hardDeadlineAt` unchanged, records `ATTEMPT_TIME_EXTENDED`, and emits `TIME_EXTENDED`.
  - Explicitly states that monitoring indicators are review signals, not proof of misconduct.
- **Grading and controlled publication (`src/lib/grading.ts`, `/api/exams/[id]/{grading,publish-results}`)**:
  - Automatically grades single-choice questions and `ALL_OR_NOTHING`, `PARTIAL_NO_NEGATIVE`, and `PARTIAL_WITH_NEGATIVE` multi-select modes.
  - Applies wrong-answer negative ratios, awards zero for skipped objective questions, validates written marks against each snapshot maximum, and recalculates totals.
  - Presents result previews before publication. Publication requires no active attempts and no incomplete written grading, then atomically marks graded attempts `PUBLISHED`, stamps the exam, and writes an audit record.
- **Results and analytics (`src/lib/analytics.ts`, `/api/results/[attemptId]`, `/api/exams/[id]/analytics`)**:
  - Candidate results require ownership and a published result; answer details follow the exam's reveal setting.
  - Examiner analytics include submissions, mean, median, min/max, pass rate, histogram, skip/correctness rates, observed difficulty, distractor selections, and low-correctness/high-skip flags.
- **Reports and public verification (`src/lib/{pdf-reports,verification}.ts`)**:
  - Generates access-controlled candidate and cohort PDFs using PDFKit; candidate reports embed a QR code and verification ID.
  - Signs canonical report data with HMAC-SHA256, supports verification versions, and marks older records superseded when a new version is issued.
  - `/api/verify/[code]` and `/verify/[code]` expose only status, masked name/identifier, exam title, score, issue date, and version. They do not expose email, answers, questions, or incident logs.
- **User interfaces and fixtures**:
  - Examiner monitor, grading workbench, and analytics pages; candidate published-result page; public verification page; navigation from existing exam/candidate views; candidate SSE updates.
  - `seed-exam-results` supplies three published attempts with total scores `9`, `4.5`, and `7` out of `10` for a repeatable judging/demo path.

## Schema, Dependencies, and API Changes

### Prisma

- No schema migration was required. Plan 1's future-facing `Attempt`, `Answer`, `AttemptEvent`, `Announcement`, `AuditLog`, and `ReportVerification` models were reused.
- Plan 3's `isSandbox` and unique-attempt invariant remain unchanged. All Plan 4 aggregate/operational queries explicitly use `isSandbox: false`.

### Dependencies

- Runtime: `pdfkit@0.17.2`, `qrcode@1.5.4`.
- Development types: `@types/pdfkit`, `@types/qrcode`.
- `next.config.ts` lists `pdfkit` in `serverExternalPackages` so its AFM font assets remain available in production/runtime bundles.

### New API surface

- `GET /api/exams/[id]/stream`
- `GET /api/exams/[id]/monitor`
- `POST /api/exams/[id]/announcements`
- `POST /api/attempts/[id]/extend`
- `GET|PATCH /api/exams/[id]/grading`
- `POST /api/exams/[id]/publish-results`
- `GET /api/exams/[id]/analytics`
- `GET /api/results/[attemptId]`
- `GET /api/reports/attempt/[attemptId]/pdf`
- `GET /api/reports/exam/[examId]/pdf`
- `GET /api/verify/[code]`

## Verification Commands and Outcomes

The database commands used the local Docker URL because `.env` intentionally contains no `DATABASE_URL`:

```powershell
docker compose up -d
$env:DATABASE_URL='postgresql://aegis:aegis_dev_password@localhost:5432/aegis_exam?schema=public'
$env:AUTH_SECRET='phase4-build-verification-secret-at-least-32-characters'
$env:REPORT_HMAC_SECRET='phase4-report-verification-secret-at-least-32-characters'
$env:NEXT_PUBLIC_APP_ORIGIN='http://localhost:3000'
npm run db:generate
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
npm audit --omit=dev
```

- Generate/seed passed; the seed refreshed 8 users, 24 questions, 3 Plan 2 exams, and the Plan 4 published-results fixture.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0 with `--max-warnings=0`.
- `npm test`: 9 files, 32/32 tests passed. `grading.test.ts` has 5 tests; `analytics-verification.test.ts` has 3 tests and validates a real `%PDF-` buffer over 1 KB.
- `npm run build`: exit 0; all Plan 4 pages and eleven new APIs compiled. PDFKit font assets were verified after adding `serverExternalPackages`.
- `git diff --check`: exit 0.
- Live checks on `next dev -p 4000`:
  - Published analytics: 3 submissions; mean `6.83`; median `7`; pass rate `66.67%`; 3 question rows.
  - Grading queue: three seeded attempts returned `PUBLISHED`. A separate submitted attempt rejected `manualScore > maxMarks` with `409`; valid marks completed the transition to `GRADED`.
  - `POST /api/exams/seed-exam-results/publish-results`: `200`, `publishedAttempts: 3`.
  - Candidate 1 result: `9 / 10`; another candidate requesting it received `403`.
  - Candidate PDF: 4,291 bytes; cohort PDF: 2,141 bytes; both returned `application/pdf` and valid PDF data.
  - Public verification returned `VALID`, a masked candidate name/ID, and exactly the allowed report fields; candidate email was absent.
  - Extension before outage: `409`. After a forced 40-second heartbeat gap: monitor showed `GAP`, `HEARTBEAT_LOST` was recorded, a three-minute extension succeeded, `hardDeadlineAt` stayed unchanged, and the audit trail contained `ATTEMPT_TIME_EXTENDED`.
  - Announcement creation returned `201` and appeared in the candidate heartbeat response. The SSE stream emitted `CONNECTED` and a live `SNAPSHOT`.
- Temporary monitor/grading attempts, announcements, and extension audit records were removed after smoke verification. The deterministic result fixtures and one valid report-verification record remain for demonstration.

## Known Issues / Pending Work

- The monitor uses an in-process `EventEmitter` for immediate delivery. The five-second database snapshot fallback maintains correctness in one instance, but multi-instance production would benefit from Redis/pub-sub or PostgreSQL notifications. This is outside the required Plan 4 scope.
- QR scanning was validated through the encoded verification URL and live public endpoint, not with a physical phone camera during this terminal run.
- `npm audit --omit=dev` reports 2 inherited PostCSS advisories through Next.js 15.5.29. The offered fix upgrades to breaking Next.js 16.4.6. The full audit additionally reports 3 test-tool advisories requiring breaking Vitest 5.1.2. Evaluate these upgrades in Plan 5 with regression coverage.
- Plan 5 still owns candidate disputes, examiner resolution/regrade, issuance of a new report version after adjusted grades, security/accessibility polish, Playwright E2E, production Docker packaging, deployment documentation, and final demo rehearsal.

## Next Agent's First Step

After this branch is reviewed and merged into the agreed integration branch, create the Plan 5 branch and begin with `docs/05-disputes-polish-verification-deploy.md`. First implement dispute creation/resolution against published attempts, reusing `recomputeAttemptTotals` and the verification versioning helper so an adjusted score produces a new report record and the previous code becomes `SUPERSEDED`; then add the candidate/examiner dispute UI before the final security, accessibility, E2E, and deployment pass.
