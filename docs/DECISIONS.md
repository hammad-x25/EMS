# Approved Architecture Decisions

This log records decisions approved by the team when the competition brief, master specification, and phased plans were ambiguous or inconsistent. Later agents must treat these decisions as part of the repository specification.

## 2026-11-27 — Plan 1 pre-implementation review

1. **Authorization model:** Use fixed `ADMIN`, `EXAMINER`, and `CANDIDATE` roles with backend-enforced permissions and ownership checks. Do not build a configurable permission matrix.
2. **Administrator operations:** The Admin Console includes user management, audit history, system health, and a global read-only examination overview. Examiners retain ownership of examination mutations.
3. **Examination lifecycle:** Lifecycle changes are derived from server time and persisted automatically (`PUBLISHED` to `ONGOING`, then `COMPLETED`). Candidate access remains subject to enrollment and the server-side availability window.
4. **Deployment:** Keep deployment provider-neutral. Docker and deployment documentation must not require a particular paid host.
5. **Session cookies:** Use `httpOnly`, `sameSite=lax` cookies and set `secure=true` in production while permitting local HTTP development.
6. **Post-publication answers:** Candidate result views expose scores and feedback. Correct answers and explanations are shown only when an examiner explicitly enables that exam setting.
7. **Plan 1 seed boundary:** Plan 1 seeds role accounts and reusable question fixtures. Plans 2–4 add exams, attempts, grading, analytics, and report fixtures after their domain rules exist.
8. **Auth helper contract:** Standardize protected server code on `requireAuth`.
9. **Submission/grading boundary:** Plan 3 atomically finalizes an attempt as submitted. Plan 4 performs objective/manual grading and subsequent grading-state transitions.
10. **Time accommodations:** Preserve `hardDeadlineAt` as the original server deadline. Calculate `effectiveDeadlineAt` by adding audited `timeExtensionMinutes`; answer acceptance and finalization use the effective deadline.
11. **Innovation scope:** Retain the planned 5.2 fairness, 5.3 resilience, and 5.4 dispute-resolution innovations.
12. **Submission cutoff:** The team supplied an 8:00 PM cutoff. No push or deployment is authorized as part of Plan 1; repository work must preserve honest timestamps.

## 2026-11-27 — OWASP security hardening pass

13. **Session revocation and cookie policy:** Superseding Decision 5's `sameSite=lax`, session cookies use `httpOnly`, `sameSite=strict`, and `secure=true` in production. `User.tokenVersion` provides server-side JWT revocation on logout, password reset, role change, and account deactivation.
14. **Password policy:** Newly created, imported, or reset user passwords require at least 12 characters with mixed case, digit, and symbol, hashed with `bcryptjs` cost 12 (existing cost-10 seed hashes remain verifiable via `bcryptjs.compare`).

## 2026-11-27 — Plan 6 UI/UX redesign sign-off

15. **Backward-compatible GET pagination:** Read-only collection endpoints (`GET /api/admin/users`, `GET /api/questions`, `GET /api/admin/audit`) accept optional `?page=&limit=&search=` (plus role/status/topic/difficulty/type/action) query parameters and return pagination metadata (`pagination: { page, limit, total, totalPages }`) when requested, while preserving existing unparameterized responses.
16. **Zero-network typography stack:** Use a zero-network CSS font stack (`Inter, "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` with monospace `tabular-nums` for timers, scores, and verification codes) so `docker build` and offline runs never fetch external fonts.
17. **Hide-timer deadline milestone cues:** When `hideTimer` is active, keep the continuous countdown clock hidden while emitting non-intrusive `aria-live="polite"` screen-reader announcements and a subtle dismissible banner cue at the 5-minute and 1-minute remaining thresholds.

