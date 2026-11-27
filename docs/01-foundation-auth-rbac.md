# Plan 1 — Foundation, Auth, Server-Side RBAC & Admin Operations

> Parent Specification: [Master Specification & Architecture](./00-master-specification.md)

## Goal Description
Establish the Next.js App Router TypeScript repository, Dockerized PostgreSQL database, full Prisma schema, secure cookie-based authentication, strict server-side RBAC enforcement, Admin User & Role Management Console, and reproducible seed data for the 15-minute live evaluation.

**Covers PDF Requirements**: `3.1 Authentication & Authorization`, `06 Security & Architecture`, `07 README & Test Credentials` (baseline).

---

## Proposed Changes

### 1. Repository & Infrastructure Scaffolding
#### [NEW] `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- Initialize Next.js 15 App Router project with TypeScript (`strict: true`), Tailwind CSS, `lucide-react`, `zod`, `jose`, `bcryptjs`, `@prisma/client`, `prisma`, and `vitest`.
- Configure `npm scripts`: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:push`, `db:seed`.

#### [NEW] `docker-compose.yml` & `.env.example`
- Provide PostgreSQL 16 service (`postgres:16-alpine`) on port `5432` with healthcheck and persistent volume so local dev and single-command startup work cleanly.
- Document `DATABASE_URL`, `AUTH_SECRET`, and `REPORT_HMAC_SECRET` in `.env.example`.

---

### 2. Database Schema & Client Singleton
#### [NEW] `prisma/schema.prisma`
- Implement the complete schema defined in [00-master-specification.md](./00-master-specification.md) so all subsequent plans build against stable, typed models without schema churn.

#### [NEW] `src/lib/db.ts`
- Export singleton `PrismaClient` avoiding hot-reload connection exhaustion in Next.js dev mode.

#### [NEW] `prisma/seed.ts`
- Deterministic seed script creating:
  - **1 Admin**: `admin@aegisexam.local` / `Admin@123!`
  - **2 Examiners**: `examiner1@aegisexam.local` / `Examiner@123!`, `examiner2@aegisexam.local` / `Examiner@123!`
  - **5 Candidates**: `candidate1@aegisexam.local` .. `candidate5@aegisexam.local` / `Candidate@123!`
  - **Sample Question Bank**: 24 questions across 3 topics (`Algorithms`, `Databases`, `Networks`) and 3 difficulties (`EASY`, `MEDIUM`, `HARD`), mixing `SINGLE_MCQ`, `MULTI_SELECT`, and `WRITTEN`.
  - **Sample Exams**: 1 `COMPLETED` exam (with graded/published sample attempts for immediate Analytics/PDF/Dispute demo), 1 `ONGOING` exam (ready for live Candidate taking & Examiner monitoring), and 1 `DRAFT` exam.

---

### 3. Authentication & Backend-Enforced RBAC
#### [NEW] `src/lib/auth.ts`
- `hashPassword(plain)` & `verifyPassword(plain, hash)` using `bcryptjs` (cost 10).
- `signSessionToken(payload)` & `verifySessionToken(token)` using `jose` (`HS256`, 8-hour expiry).
- `setSessionCookie(token)` & `clearSessionCookie()` setting `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`.
- `getSession()` reading & verifying the cookie in Server Components and Route Handlers; checks `user.isActive` in DB on sensitive mutations.

#### [NEW] `src/lib/rbac.ts` & `src/middleware.ts`
- Server-side helpers:
  ```ts
  export async function requireAuth(allowedRoles?: Role[]): Promise<SessionUser>
  ```
  Throws typed `AuthError(401)` or `ForbiddenError(403)` caught by centralized `apiHandler()` wrapper (`src/lib/api-handler.ts`).
- `src/middleware.ts` protects route groups (`/admin/*`, `/examiner/*`, `/candidate/*`) by role and redirects unauthenticated users to `/login`. Public routes remain accessible only for `/`, `/login`, `/verify/*`, and `/api/health`.

#### [NEW] `src/app/api/auth/login/route.ts`, `logout/route.ts`, `me/route.ts`
- Zod-validated login, logout, and current-user profile endpoints.
- Rate-limit / lockout protection (in-memory sliding window per IP/email) + AuditLog entry on login failures and role changes.

---

### 4. Role-Specific Shells & Admin Console
#### [NEW] `src/components/AppShell.tsx` & `src/app/login/page.tsx`
- Clean, academic login page with **Demo Quick-Fill Role Buttons** (clearly labeled as evaluation demo convenience, configurable via `NEXT_PUBLIC_DEMO_MODE`).
- Unified navigation shell adapting sidebar links strictly to the authenticated user's role.

#### [NEW] `src/app/admin/users/page.tsx` & `src/app/api/admin/users/**`
- Full Admin User & Role Management table:
  - Search/filter by role or status.
  - Create user, edit role (`ADMIN` / `EXAMINER` / `CANDIDATE`), toggle `isActive` (immediately blocks deactivated users on backend), reset password.
  - View recent platform `AuditLog` entries (`/admin/audit`).

---

## Verification Plan

### Automated Tests
1. `npx prisma db push && npx prisma db seed` — verify schema migration & seed succeed cleanly.
2. `npx vitest run src/lib/__tests__/auth-rbac.test.ts` — verify:
   - Unauthenticated requests to `/api/admin/users` return `401`.
   - Candidate/Examiner requests to `/api/admin/users` return `403`.
   - Deactivated user tokens are rejected.
   - Passwords are never returned in API JSON responses.

### Manual Verification
1. Log in as Admin → create a test user → change role from Candidate to Examiner → verify role persists across refresh.
2. Attempt to visit `/admin/users` while logged in as Candidate → confirm redirect and `403` on direct API `curl` call.
