# Handoff — Plan 1 Foundation, Auth, RBAC, and Admin Operations

## State

- Branch: `feat/01-foundation-auth-rbac`
- Integration base: `main` at `a544e94`
- Implementation commits: `573b6d3`, `bae0d90`, `cb11cef`, `06f55a8`
- Working milestone: Plan 1 complete; Plans 2–5 not started
- Approved decisions: [docs/DECISIONS.md](../DECISIONS.md)

## Delivered

- Next.js 15/React 19 strict TypeScript application with Tailwind CSS 4.
- PostgreSQL 16 Compose service and complete Prisma schema needed by all five plans.
- Idempotent seed for 8 role accounts and 24 reusable question fixtures. Exam/attempt fixtures are intentionally deferred.
- Eight-hour HS256 session, `bcryptjs` cost 10, `httpOnly`/SameSite cookies, and production-only `secure` flag.
- Backend `requireAuth`, current database role/status lookup, route middleware, structured API errors, and safe user DTOs.
- Login rate limiting and audit records for successful login, known-account failure, logout, user creation/update, and password reset.
- Functional Admin user search/filter/create/role/status/password-reset UI.
- Admin audit trail, live database health, and global read-only exam overview.
- Role-specific Administrator, Examiner, and Candidate shells.

## Schema and API contract

The complete schema is in `prisma/schema.prisma`. Plan-specific additions beyond the original master snippet are:

- `Question.createdBy` is a real foreign-key relation to `User`.
- `Exam.revealAnswersAfterPublish` defaults to false per the approved disclosure decision.
- Indexes cover ownership/status, availability windows, attempt deadlines, and audit history.
- `ReportVerification` enforces one record per `(attemptId, version)`.

Implemented endpoints:

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/login` | Public, rate-limited |
| POST | `/api/auth/logout` | Session optional |
| GET | `/api/auth/me` | Any active user |
| GET | `/api/health` | Public, minimal operational data |
| GET/POST | `/api/admin/users` | Admin |
| PATCH | `/api/admin/users/[id]` | Admin |
| POST | `/api/admin/users/[id]/reset-password` | Admin |
| GET | `/api/admin/audit` | Admin |
| GET | `/api/admin/overview` | Admin |

All errors use `{ error: { code, message, details? } }`. User responses use `UserDto` and never contain `passwordHash`.

## Exact verification commands and outcomes

Run from the repository root in PowerShell:

```powershell
$env:DATABASE_URL='postgresql://aegis:aegis_dev_password@localhost:5432/aegis_exam?schema=public'
$env:AUTH_SECRET='development-auth-secret-at-least-32-characters-long'
$env:REPORT_HMAC_SECRET='development-report-secret-at-least-32-characters'
$env:NEXT_PUBLIC_DEMO_MODE='true'

docker compose up -d postgres
npx prisma validate
npx prisma generate
npx prisma db push
npx prisma db seed
npm run typecheck
npm run lint
npm test
npm run build
```

Observed outcomes:

- `prisma validate`: schema valid.
- `prisma generate`: Prisma Client 6.12.0 generated.
- `prisma db push`: database synchronized.
- `prisma db seed`: `Seeded 8 users and 24 reusable questions.`
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, zero warnings.
- `npm test`: 7/7 tests passed.
- `npm run build`: exit 0; all pages and routes compiled.

Live workflow was checked with `npm run dev -- -p 4000` and PowerShell web sessions:

```text
Public health                       ok
Unauthenticated admin API           401
Candidate login                     CANDIDATE
Candidate blocked from admin API    403
Admin login                         ADMIN
User role update persisted          EXAMINER
Password absent from user JSON      True
```

The test temporarily changed `candidate5` to Examiner through the API and changed it back to Candidate. Both changes remain visible in the audit trail.

## Known issues and operational notes

- `npm audit --omit=dev` reports one moderate and one high advisory in Next.js 15's bundled PostCSS. The offered automatic fix upgrades to Next.js 16, conflicting with the approved Next.js 15 plan; no forced major upgrade was made. Do not process untrusted CSS or source maps in production builds.
- On this Windows host, ports 2881–3680 are OS-reserved, so port 3000 cannot bind. Port 4000 was used for live verification. This is host-specific.
- In production mode, the session cookie is intentionally `secure`; local HTTP login should use `npm run dev`, while production requires HTTPS.
- The in-memory login limiter is appropriate for the specified single-instance runtime. A multi-instance deployment must replace it with a shared store during deployment planning.
- No push, merge, tag, or deployment was performed.

## Next agent's first step

After Plan 1 review and merge into the team integration branch, create the Plan 2 branch from that updated integration branch. Run the verification commands above, then begin with the question-bank service and validation rules in `docs/02-question-bank-exams-fairness.md`. Reuse `requireAuth`, `apiHandler`, `toUserDto` conventions, and ownership checks; do not add exam/attempt seed records until the corresponding Plan 2 lifecycle services exist.

