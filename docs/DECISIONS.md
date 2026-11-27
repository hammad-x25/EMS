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

