# Plan 6: Comprehensive UI/UX Audit & Enterprise Redesign Improvement Plan

- **Status**: Approved — In Progress
- **Branch**: `feat/ui-ux-redesign`
- **Specification Baseline**: [AGENTS.md](../AGENTS.md), [docs/00-master-specification.md](./00-master-specification.md), Plans 1–5 ([01](./01-foundation-auth-rbac.md)–[05](./05-disputes-polish-verification-deploy.md)), [docs/DECISIONS.md](./DECISIONS.md), and `.agents/skills/examination-ui-ux/SKILL.md` (with `references/design-system.md`, `references/workflows.md`, `references/quality-gates.md`).
- **Scope Mandate**: Improve clarity, usability, examination reliability, WCAG 2.2 AA accessibility, component reusability, and high-population administrative efficiency **without altering backend business logic, RBAC enforcement, Prisma schema invariants, or examination policies**.

---

## 1. Executive Audit Summary

AegisExam already implements strong security, concurrency, offline IndexedDB queuing, SSE monitoring, and anti-leakage protections on the server. However, the current frontend layer was built incrementally across Plans 1–5 with minimal shared UI primitives, inconsistent styling tokens, unpaginated data tables, unguarded modal/drawer accessibility, and subtle client-side React lifecycle issues during live exams.

### Deficiency Count by Priority

| Priority | Count | Summary Theme |
| --- | :---: | --- |
| **Critical** | 6 | Live exam React `useEffect` interval churn, obscured/missing submission error & receipt details, non-accessible dialogs/drawers (no focus trap/Escape), broken Dark/High-Contrast CSS cascade in overlays/controls, destructive actions without confirmation, missing offline/tab announcement live-region clarity |
| **High** | 10 | Unpaginated/unvirtualized tables for large cohorts, mobile `AppShell` navigation & table usability, inline field-level Zod validation errors, `ExamBuilderWorkspace` un-guarded unsaved tab switches & monolithic size, pre-exam launch briefing & attempt consequences clarity, missing back navigation & examiner sub-page breadcrumbs |
| **Medium** | 10 | Typography (`Arial` default, omitted `textarea` inherit), oversized radius/marketing card styling (`18px`, decorative circle), tablist/ARIA semantics across builders, `text-xs`/`text-[11px]` hierarchy & visual clutter, static/unfiltered audit & analytics views, stale Plan 1 copy in admin overview |
| **Low** | 6 | Microcopy consistency, prefers-reduced-motion CSS guard, redundant `useMemo`/list key polish, missing empty-state next actions, print/high-density polish |

---

## 2. Detailed Evaluation Across the 12 Audit Dimensions

### 2.1 Visual Consistency & Design-System Maturity
- **Typography & Form Inheritance (`src/app/globals.css:20,23`)**: `body` specifies `Arial, Helvetica, sans-serif`, giving the platform an unrefined generic look instead of crisp high-legibility enterprise typography (`Inter` / system UI sans + monospace `tabular-nums` for timers, marks, and verification IDs). Furthermore, line 23 (`button, input, select { font: inherit; }`) omits `textarea`, causing written exam responses and examiner instructions to fall back to browser-default monospace/sizing.
- **Border Radius & Shadow Bloat (`src/app/globals.css:29-34`, `src/app/page.tsx:18,26-27`)**: `.card` uses `border-radius: 18px` and a soft blurred drop shadow (`0 12px 32px rgba(...)`), while `src/app/page.tsx` renders an oversized marketing hero (`text-5xl md:text-7xl`) and a decorative circle (`bg-indigo-100`). This conflicts with the calm, high-density institutional assessment aesthetic specified in `design-system.md` (`8px`–`12px` surface radius, `6px`–`8px` control radius, flat 1px borders).
- **Broken Dark & High-Contrast Theme Overrides (`src/app/globals.css:66-98`, `WorkspacePreferencesDrawer.tsx:18`, `ScratchpadDrawer.tsx:115`, `ExamHeader.tsx:40`, `ExamWorkspace.tsx:438`)**:
  - `.exam-theme-dark` and `.exam-theme-contrast` rely on brittle attribute wildcard selectors (`[class*="text-slate-"]`, `[class*="border-slate-"]`).
  - `ExamHeader.tsx:40` hardcodes `bg-white/95`, which `.exam-theme-dark header` overrides only via specificity/order, while modal/drawer surfaces (`WorkspacePreferencesDrawer.tsx:18`, `ScratchpadDrawer.tsx:115`) use raw `div`s with `bg-white`—meaning drawers remain glaringly white inside Dark or High-Contrast exam mode.
  - Selected MCQ cards (`ExamWorkspace.tsx:438`) apply `bg-indigo-50 border-indigo-500` with light text in dark mode (severe contrast failure), and `.btn-secondary` hardcodes `background: white; color: #334155`.
- **Ad-hoc Badge & Button Styling**: `status-pill` classes are scattered with inline Tailwind tones (`AdminUserManager.tsx:133`, `ExamListManager.tsx:10-15`, `DisputePanel.tsx:16-22`, `DisputeWorkbench.tsx:11-17`, `QuestionBankManager.tsx:20-24`) without a unified semantic `<StatusBadge />` component.

### 2.2 Information Architecture & Navigation
- **No Active Navigation Indicator (`src/components/AppShell.tsx:43-47`)**: `AppShell` is a Server Component and renders `Link` items identically without highlighting the active route (`aria-current="page"`). Users deep in `/examiner/exams/[id]/monitor` or `/admin/users` have no spatial orientation cue in the sidebar.
- **Disconnected Examiner Sub-Workflows (`src/components/examiner/ExamBuilderWorkspace.tsx:392-415`, `MonitorDashboard.tsx`, `GradingWorkbench.tsx`, `analytics/page.tsx`)**: Links to Monitor, Grade, Analytics, and Sandbox appear as secondary buttons in `ExamBuilderWorkspace`, but once inside `/monitor`, `/grading`, or `/analytics`, there are **zero breadcrumbs or "Back to Exam Builder" links**, forcing reliance on browser Back or top-level sidebar resets.
- **Missing Back Navigation on Candidate Result Page (`src/app/candidate/results/[attemptId]/page.tsx:21-26`)**: After inspecting published scores or submitting a dispute, there is no `<Link>` back to `/candidate/dashboard`.
- **No Unsaved-Changes Protection (`ExamBuilderWorkspace.tsx:423-438`)**: Switching among the 5 builder steps (`1. Details` → `2. Questions` → `3. Fairness` → `4. Candidates` → `5. Review`) silently keeps unsaved state or discards mental context without a dirty-state indicator or confirmation.
- **Stale Domain Copy (`src/app/admin/page.tsx:31`)**: Empty-state message reads `"Plan 2 introduces the examiner creation workflow."`, which is inaccurate now that Plans 1–5 are implemented.

### 2.3 Role-Based User Experiences
- **Administrator**: Overview (`src/app/admin/page.tsx`) provides only 4 totals and the 8 most recently updated exams; `AuditPage` (`src/app/admin/audit/page.tsx:7`) renders the last 100 audit events with no action-type filter, date range, actor search, or pagination. `AdminUserManager` provides inline `<select>` role changes without confirmation even when changing a user to/from `ADMIN`, and `Deactivate` toggles immediately (`AdminUserManager.tsx:135`) without verifying intent.
- **Examiner**:
  - `ExamBuilderWorkspace.tsx` (1,151 lines) combines exam metadata, question/blueprint composition, fairness preview, enrollment CRUD + bulk import, and publishing in one giant client component.
  - `ExamListManager.tsx:276` (`deleteDraft`) and `QuestionBankManager.tsx:347` (`deleteQuestion`) delete records on a single click with **no confirmation modal**.
  - `ExamBuilderWorkspace.tsx:1086-1126` triggers lifecycle transitions (`Publish`, `Open now`, `Close & mark COMPLETED`) without a confirmation dialog explaining irreversibility (e.g., locking questions/closing active candidates).
  - `MonitorDashboard.tsx:60` disables `Grant audited extension` unless `selected.connection === "GAP"`, which is a valid rule—but shows no clear explanation inline on why the button is disabled when viewing an `ONLINE` or `SUBMITTED` candidate, nor does it display whether a `HEARTBEAT_LOST` event exists prominently at the top of the drawer.
- **Candidate**:
  - `CandidateExamsBoard.tsx:246-256` launches `/take` directly via `<Link>` after reading modal instructions, without explicitly confirming attempt consumption ("1 attempt permitted — once started, the countdown runs on the server and cannot be paused") or connection readiness.
  - Completed exam cards (`CandidateExamsBoard.tsx:161-188`) show `scheduledEnd`, omitting the candidate's actual `submittedAt` timestamp when an attempt exists.
  - `DisputePanel.tsx` exposes a clean submission form, while `/candidate/results/[attemptId]` lacks a breadcrumb back to `/candidate/dashboard`.
- **Public Verifier (`src/app/verify/[code]/page.tsx`)**: Clean and privacy-safe, though it currently lacks a subtle direct verification input/lookup hint when a code is `NOT_FOUND` and could use tabular monospace styling for verification codes.

### 2.4 Student Examination Workflows
- **During-Exam Focus & Viewport Discipline (`ExamWorkspace.tsx:419-450`)**:
  - Single-question focus works well, and the left/right configurable `QuestionPalette` keeps position clear.
  - However, when `error` occurs (e.g., trying to submit with queued offline answers or a failed sync), the alert renders in the page body (`ExamWorkspace.tsx:424`) **behind** the open `ReviewSubmitModal` (`z-50`), making submit failures invisible until the candidate closes the modal!
  - Announcements (`ExamWorkspace.tsx:423`) only display `attempt.announcements.at(-1)?.message` with **no announcement history drawer/popover** (if an examiner sends 2 broadcasts 10 seconds apart, the first is silently hidden) and **no `aria-live="polite"`** attribute.
  - `ScratchpadDrawer.tsx:133-143` sets fixed canvas attributes (`width={720} height={420}`) with CSS `w-full`; while functional, dark/high-contrast themes do not invert or adapt the drawer background (`bg-white`), creating eye strain during dark-mode exams.
  - Post-submission receipt (`ExamWorkspace.tsx:406-416`) confirms `"Submission received"` / `"Time has expired"` but omits the **Attempt Reference ID**, **Exam Title**, **Submission Timestamp**, and **Answered Summary**, which candidates need as calm proof of receipt in high-stakes exams.

### 2.5 Accessibility Against WCAG 2.2 AA
- **Critical Modal & Drawer Focus Failures**: Across **all 8** modal/drawer overlays (`ReviewSubmitModal.tsx`, `WorkspacePreferencesDrawer.tsx`, `ScratchpadDrawer.tsx`, `CandidateExamsBoard.tsx:194`, `AdminUserManager.tsx:143`, `QuestionBankManager.tsx:367` & preview modal, `BulkImportModal.tsx`, `MonitorDashboard.tsx:60`, `GradingWorkbench.tsx:81`):
  - No `Escape` key handler to close.
  - No keyboard **focus trap** (Tab escapes into background page/exam behind backdrop).
  - No automatic initial focus placement inside the dialog or **focus restoration** to the trigger button upon closing.
- **Tab Controls Missing ARIA Semantics (`ExamBuilderWorkspace.tsx:423-438`, `ScratchpadDrawer.tsx:120-123`)**: Step/tab buttons are plain `<button>` elements inside `<nav>` or `<div>` instead of `role="tablist"`, `role="tab"`, `aria-selected`, and arrow-key navigation.
- **Live Regions Missing or Incomplete**:
  - `ExamWorkspace.tsx:423` announcement banner lacks `aria-live="polite"`.
  - `ExamHeader.tsx:49` timer uses `aria-label` on a static `<span>`, which is good for avoiding chatty second-by-second announcements, but lacks milestone screen-reader announcements (e.g., 5 minutes / 1 minute remaining in an `aria-live="polite"` region).
  - `GradingWorkbench.tsx:79` notice banner lacks `role="status"` / `aria-live="polite"`.
- **Minimum Target Size & Font Sizes**: Several compact buttons/pills (`ExamListManager.tsx:274` `px-3 py-1.5 text-xs`, `MonitorDashboard.tsx:59` `px-3 py-1.5 text-xs`, `WorkspacePreferencesDrawer.tsx` checkbox rows) sit below WCAG 2.2 SC 2.5.8 target spacing comfort or `12px` body legibility (`text-[11px]` in `analytics/page.tsx:26` and `AppShell.tsx:40`).
- **Keyboard Shortcut Collision Guard (`ExamWorkspace.tsx:307-315`)**: `N`/`P`/`M` shortcuts check `["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)`, which protects form fields—good—but do **not** check modifier keys (`event.metaKey || event.ctrlKey || event.altKey`), `contentEditable`, or whether a modal/drawer (`settingsOpen || scratchpadOpen || reviewOpen`) is currently open! Pressing `n`/`p`/`m` inside the Review modal or Scratchpad canvas triggers background navigation/marking!
- **Reduced Motion Missing (`src/app/globals.css`, `NetworkStatusPill.tsx:17`, `MonitorDashboard.tsx:55`)**: Continuous CSS animations (`animate-spin`, `animate-pulse`) have no `@media (prefers-reduced-motion: reduce)` override.

### 2.6 Cognitive Load & Interaction Complexity
- **Monolithic `ExamBuilderWorkspace.tsx` (1,151 lines)**: Combines 5 workflows + inline forms + fairness charts + bulk import modals in one file, displaying dense lists of forms on Details and Enrollment tabs.
- **Question Prompt / Response Hierarchy in Grading & Analytics**: `GradingWorkbench.tsx:80` shows only `WRITTEN` questions per candidate and requires scrolling down if an exam has many written prompts; there is no quick progress bar ("3 of 12 candidates graded · 4 written responses pending") outside the Preview modal.
- **Admin Overview & Dispute Lists**: Both `MonitorDashboard.tsx` and `GradingWorkbench.tsx` lack quick search/status filters inside the candidate list when grading/monitoring dozens of candidates.

### 2.7 Responsive Behavior
- **Critical Mobile Shell Collapse (`src/components/AppShell.tsx:28-35`)**: Below `md` (`768px`), the `250px` fixed sidebar (`<aside>`) stacks **above** `<main>` at full vertical height (~350–400px), pushing every dashboard headline and control below the fold on mobile viewports. There is no collapsible mobile header + slide-over navigation drawer.
- **Horizontal Overflow Tables (`src/app/globals.css:100-102`)**: `.desktop-table` enables `overflow-x: auto` below `800px`, which hides action buttons (`Deactivate`, `Inspect`, `Delete`) off the right edge of mobile screens rather than offering stacked card rows or sticky action columns.
- **Candidate Exam Header Wrapping (`ExamHeader.tsx:41-66`)**: On narrow viewports (`< 640px`), 5 controls + title wrap into 2–3 rows inside `sticky top-0`, consuming up to ~130px of vertical exam viewport.

### 2.8 Component Reusability
Currently, there is **no `src/components/ui/` design-system layer**. Across ~20 component/page files:
- Modals are hand-rolled 8 times with inconsistent close buttons, padding, and backdrop opacity (`bg-slate-950/60` vs `bg-slate-950/50` vs `bg-slate-950/55`).
- Drawers are hand-rolled 3 times (`WorkspacePreferencesDrawer`, `ScratchpadDrawer`, `MonitorDashboard` inspector).
- Alert banners (`banner` / `message` / `notice` / `error`) are hand-rolled ~10 times with subtly different border colors, ARIA roles, and dismissibility.
- Search + filter toolbars are duplicated in `AdminUserManager.tsx` and `QuestionBankManager.tsx`.

### 2.9 Form Validation & Error Recovery
- **Opaque Error Presentation**: Client components (`AdminUserManager.tsx:14`, `ExamListManager.tsx:77`, `QuestionBankManager.tsx`, `DisputePanel.tsx:67`) discard structured Zod `error.details` returned by the backend and display only a single top-level toast/banner (`body.error?.message`), forcing users to hunt for which field failed (e.g., password complexity, `scheduledEnd <= scheduledStart`, `passingMarks > totalMarks`, or `resolutionNote` min length).
- **Pre-Submit Client Validation**: Forms rely mostly on HTML5 `required`/`minLength`; complex cross-field rules (e.g., end date after start date, passing marks `<=` total marks, MCQ at least 1 correct option checked) only fail after a server round-trip.

### 2.10 Network Failure & Examination Submission States
- **CRITICAL Lifecycle Churn Bug (`src/components/exam/ExamWorkspace.tsx:201-234`)**:
  - The heartbeat + reconnect `useEffect` has dependency array `[attempt?.id, attempt?.status, queuedCount, syncState]`.
  - Every time a candidate types/clicks an answer (`syncState` flips `SYNCED` -> `SAVING` -> `SYNCED`, or `queuedCount` changes), React **clears and restarts** the 10s heartbeat interval and 5s reconnect interval! Rapid typing in a `WRITTEN` question can continuously reset the 10-second heartbeat timer and starve heartbeats, risking false `HEARTBEAT_LOST` monitor gaps!
  - Additionally, line 225 (`offline = () => setSyncState(queuedCount > 0 ? "OFFLINE_QUEUED" : "SYNCED")`) reports `"Synced"` with a green cloud (`NetworkStatusPill.tsx:36`) even while the browser is offline if the queue happens to be empty (`queuedCount === 0`), misleading the candidate into thinking they have a live server connection.
- **Hidden Submit Error Behind Modal (`ExamWorkspace.tsx:357,364,424`)**: If submission fails due to pending offline items (`"Reconnect and synchronize queued answers before final submission."`), `error` is rendered behind `ReviewSubmitModal` instead of inside the modal next to the Submit button.

### 2.11 Administrative Efficiency for Large Student Populations
- **Zero Pagination Across All Lists (`admin/users/page.tsx:8`, `admin/audit/page.tsx:7`, `QuestionBankManager.tsx`, `ExamBuilderWorkspace.tsx`, `MonitorDashboard.tsx`, `GradingWorkbench.tsx`, `DisputeWorkbench.tsx`)**:
  - `admin/users` renders every `User` in the DOM in one `<table>`. For 5,000+ students, initial SSR serialization, React hydration, and client `.filter()` degrade sharply.
  - `QuestionBankManager` loads all questions in one array without pagination.
  - `MonitorDashboard` renders every candidate attempt row in one flat `<tbody>` without search/connection filters (`All` / `Gap` / `Flagged` / `In Progress` / `Submitted`) or quick sorting by incident/gap priority.
  - `GradingWorkbench` renders a sidebar list of all attempts without filter chips (`Needs Manual Grading` / `Graded` / `Submitted`) or search.
  - **Bulk Operations**: No multi-select checkbox or batch enrollment actions outside CSV/JSON `BulkImportModal`.

### 2.12 Frontend Performance & Rendering Efficiency
- **Interval Churn (`ExamWorkspace.tsx:234`)**: Unnecessary teardown/setup of timers and `window` listeners on every answer sync state transition (see §2.10).
- **Per-Keystroke Re-renders on `WRITTEN` & `Scratchpad`**:
  - On `WRITTEN` questions (`ExamWorkspace.tsx:434`), `onChange` immediately triggers `updateAnswer` -> `setAttempt` (cloning all questions in state) + IndexedDB write + network `fetch` on every keystroke, without debouncing! Typing at 80 WPM fires 6–7 `POST /sync` requests per second and blocks UI responsiveness. (Local buffer + 300–500ms debounced sync + immediate flush on navigation/blur/submit preserves zero data loss while eliminating request storms).
  - Similarly `ScratchpadDrawer.tsx:153` persists to IndexedDB on every textarea keystroke synchronously inside `onChange`.
- **Heavy Monolithic Client Bundle**: `ExamBuilderWorkspace.tsx` (1,151 lines) loads all 5 tabs eagerly as one client component instead of modular tab sub-components.

---

## 3. Prioritized Deficiency Register

### Critical Priority (Must Fix First)
| ID | Area | File & Location | Deficiency & Impact |
| --- | --- | --- | --- |
| **C-01** | Exam Resilience & Perf | [ExamWorkspace.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/ExamWorkspace.tsx#L201-L234) | Heartbeat/reconnect `useEffect` depends on `[queuedCount, syncState]`, continuously resetting the 10s heartbeat timer during typing/answering and risking spurious `HEARTBEAT_LOST` monitor incidents. Also shows green `"Synced"` while offline if `queuedCount === 0` (`L225`). |
| **C-02** | Exam Network/Save Perf | [ExamWorkspace.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/ExamWorkspace.tsx#L140-L189), [L434](file:///home/huzayfa/Web-Hackathon/src/components/exam/ExamWorkspace.tsx#L434) | Every keystroke in `WRITTEN` questions fires un-debounced `sync` network requests + full `attempt` state cloning; needs debounced server sync paired with instant local draft persistence and guaranteed flush on blur/question switch/submit. |
| **C-03** | Exam Submit Feedback | [ExamWorkspace.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/ExamWorkspace.tsx#L363-L365), [L424](file:///home/huzayfa/Web-Hackathon/src/components/exam/ExamWorkspace.tsx#L424), [ReviewSubmitModal.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/ReviewSubmitModal.tsx#L4-L39) | Submission errors render behind the `z-50` `ReviewSubmitModal` backdrop (`L424`), leaving the candidate with no visible failure reason unless they dismiss the modal. Receipt screen (`L407-L416`) lacks attempt ID, exam title, and `submittedAt` timestamp. |
| **C-04** | WCAG 2.2 AA Modals/Drawers | All 8 overlay components (`ReviewSubmitModal.tsx`, `WorkspacePreferencesDrawer.tsx`, `ScratchpadDrawer.tsx`, `CandidateExamsBoard.tsx:194`, `AdminUserManager.tsx:143`, `QuestionBankManager.tsx:367`, `BulkImportModal.tsx`, `MonitorDashboard.tsx:60`, `GradingWorkbench.tsx:81`) | None implement keyboard focus trapping, `Escape` dismissal, initial focus management, or focus restoration on close. Violation of WCAG 2.2 SC 2.1.2 / 2.4.3. |
| **C-05** | Accessibility Themes | [globals.css](file:///home/huzayfa/Web-Hackathon/src/app/globals.css#L66-L98), [WorkspacePreferencesDrawer.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/WorkspacePreferencesDrawer.tsx#L18), [ScratchpadDrawer.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/ScratchpadDrawer.tsx#L115), [ExamWorkspace.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/ExamWorkspace.tsx#L438) | Dark & High-Contrast modes fail inside drawers (hardcoded `bg-white`), selected options (`bg-indigo-50`), `.btn-secondary`, and status badges, failing WCAG AA contrast ratios when enabled. |
| **C-06** | Destructive Action Safety | [ExamListManager.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/ExamListManager.tsx#L272-L280), [QuestionBankManager.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/QuestionBankManager.tsx#L343-L351), [AdminUserManager.tsx](file:///home/huzayfa/Web-Hackathon/src/components/AdminUserManager.tsx#L135), [ExamBuilderWorkspace.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/ExamBuilderWorkspace.tsx#L1086-L1127) | Single-click deletion of questions and draft exams, immediate user deactivation, and one-click `Publish` / `Close & mark COMPLETED` transitions execute with zero confirmation dialog. |

### High Priority
| ID | Area | File & Location | Deficiency & Impact |
| --- | --- | --- | --- |
| **H-01** | Large Population Scale | [users/page.tsx](file:///home/huzayfa/Web-Hackathon/src/app/admin/users/page.tsx#L8), [audit/page.tsx](file:///home/huzayfa/Web-Hackathon/src/app/admin/audit/page.tsx#L7), [QuestionBankManager.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/QuestionBankManager.tsx), [MonitorDashboard.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/MonitorDashboard.tsx), [GradingWorkbench.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/GradingWorkbench.tsx) | Unbounded tables/lists with no pagination, row limits, or fast status/search filters (monitor connection gap filter, grading pending filter, audit action/actor filters). |
| **H-02** | Mobile Navigation | [AppShell.tsx](file:///home/huzayfa/Web-Hackathon/src/components/AppShell.tsx#L28-L50) | Sidebar does not collapse on mobile (`<768px`), stacking full nav vertically above page content; no `aria-current="page"` indicator for active route. |
| **H-03** | Shortcut Conflicts | [ExamWorkspace.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/ExamWorkspace.tsx#L304-L319) | Global `n`/`p`/`m` hotkeys fire even when modals/drawers are open (`reviewOpen`, `settingsOpen`, `scratchpadOpen`) or when `Ctrl`/`Cmd`/`Alt` modifiers are held (hijacking browser shortcuts like `Cmd+N`, `Cmd+P`). |
| **H-04** | Announcements & Live Regions | [ExamWorkspace.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/ExamWorkspace.tsx#L423), [ExamHeader.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/ExamHeader.tsx#L48-L55) | Only latest announcement shown (older messages unreachable), missing `aria-live="polite"`; timer lacks milestone alerts (5 min / 1 min remaining) for screen-reader users. |
| **H-05** | Pre-Exam Confirmation | [CandidateExamsBoard.tsx](file:///home/huzayfa/Web-Hackathon/src/components/candidate/CandidateExamsBoard.tsx#L245-L259) | Clicking `"Start examination"` navigates immediately without a clear readiness confirmation summarizing 1-attempt policy, immutable server timer behavior, and browser requirements. |
| **H-06** | Inline Field Validation | [AdminUserManager.tsx](file:///home/huzayfa/Web-Hackathon/src/components/AdminUserManager.tsx#L12-L16), [QuestionBankManager.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/QuestionBankManager.tsx), [ExamListManager.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/ExamListManager.tsx), [DisputePanel.tsx](file:///home/huzayfa/Web-Hackathon/src/components/results/DisputePanel.tsx) | Structured field errors from backend Zod responses (`error.details`) are ignored; client shows generic single-string banner only. Cross-field timing/marks rules aren't validated inline prior to submit. |
| **H-07** | Examiner Wayfinding | [monitor/page.tsx](file:///home/huzayfa/Web-Hackathon/src/app/examiner/exams/[id]/monitor/page.tsx), [grading/page.tsx](file:///home/huzayfa/Web-Hackathon/src/app/examiner/exams/[id]/grading/page.tsx), [analytics/page.tsx](file:///home/huzayfa/Web-Hackathon/src/app/examiner/exams/[id]/analytics/page.tsx), [results/[attemptId]/page.tsx](file:///home/huzayfa/Web-Hackathon/src/app/candidate/results/[attemptId]/page.tsx) | Missing breadcrumbs / "Back to examination" links on sub-pages (`monitor`, `grading`, `analytics`) and missing back link on candidate result detail page. |
| **H-08** | Monolith & Dirty Guard | [ExamBuilderWorkspace.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/ExamBuilderWorkspace.tsx#L1-L1151) | Single 1,151-line component; switching steps while `Details` or `Fairness` has unsaved edits gives no warning or unsaved indicator. |
| **H-09** | Monitor Extension Clarity | [MonitorDashboard.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/MonitorDashboard.tsx#L60) | `Grant audited extension` button disables silently when `connection !== "GAP"` without visible inline reason or explicit `HEARTBEAT_LOST` readiness badge. |
| **H-10** | Mobile Table Usability | [globals.css](file:///home/huzayfa/Web-Hackathon/src/app/globals.css#L100-L102), [AdminUserManager.tsx](file:///home/huzayfa/Web-Hackathon/src/components/AdminUserManager.tsx#L128), [QuestionBankManager.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/QuestionBankManager.tsx#L305) | `.desktop-table` horizontal scroll hides row actions off-screen on mobile; needs responsive card view or compact priority columns below `md`. |

### Medium Priority
| ID | Area | File & Location | Deficiency & Impact |
| --- | --- | --- | --- |
| **M-01** | Design System Tokens | [globals.css](file:///home/huzayfa/Web-Hackathon/src/app/globals.css#L1-L65) | Replace raw hex colors, `Arial` font, `18px` radius, heavy box shadow, and missing `textarea` `font: inherit` with CSS custom properties aligned to `design-system.md`. |
| **M-02** | Landing & Login Visuals | [page.tsx](file:///home/huzayfa/Web-Hackathon/src/app/page.tsx#L18-L39), [login/page.tsx](file:///home/huzayfa/Web-Hackathon/src/app/login/page.tsx#L17-L24) | Replace decorative hero circle (`bg-indigo-100`) and marketing scale (`text-5xl md:text-7xl`) with calm institutional layout and concise security posture overview. |
| **M-03** | Reusable UI Primitives | `src/components/*` | Extract shared `<Modal>`, `<Drawer>`, `<ConfirmDialog>`, `<AlertBanner>`, `<StatusBadge>`, `<FilterBar>`, `<PaginationControls>`, `<Breadcrumb>`, and `<EmptyState>`. |
| **M-04** | Tab ARIA Semantics | [ExamBuilderWorkspace.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/ExamBuilderWorkspace.tsx#L423-L438), [ScratchpadDrawer.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/ScratchpadDrawer.tsx#L120-L123) | Missing `role="tablist"`, `role="tab"`, `aria-selected`, and `aria-controls`. |
| **M-05** | Exam Header Compactness | [ExamHeader.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/ExamHeader.tsx#L39-L68) | Multi-row wrapping on small screens; condense toolbar into cleaner priority tiers with responsive overflow/compact spacing. |
| **M-06** | Completed Card Metadata | [CandidateExamsBoard.tsx](file:///home/huzayfa/Web-Hackathon/src/components/candidate/CandidateExamsBoard.tsx#L161-L188) | Completed cards show exam end time (`scheduledEnd`) without showing candidate's actual `submittedAt` timestamp. |
| **M-07** | Analytics Responsive Bars | [analytics/page.tsx](file:///home/huzayfa/Web-Hackathon/src/app/examiner/exams/[id]/analytics/page.tsx#L26) | Score distribution chart uses pixel heights without accessible data table/ARIA values (`aria-label` per bucket) and uses `text-[11px]`. |
| **M-08** | Typography Floor | [AppShell.tsx](file:///home/huzayfa/Web-Hackathon/src/components/AppShell.tsx#L40), [analytics/page.tsx](file:///home/huzayfa/Web-Hackathon/src/app/examiner/exams/[id]/analytics/page.tsx#L26) | Sub-12px text (`text-[11px]`) reduces legibility; raise floor to `0.75rem` (`12px`) for micro-labels and `14px`/`16px` for operational text. |
| **M-09** | Role Change Confirmation | [AdminUserManager.tsx](file:///home/huzayfa/Web-Hackathon/src/components/AdminUserManager.tsx#L132) | Role `<select>` fires `PATCH` immediately on `onChange`, making accidental clicks on high-privilege `ADMIN` role dangerous. |
| **M-10** | Stale Copy | [admin/page.tsx](file:///home/huzayfa/Web-Hackathon/src/app/admin/page.tsx#L31) | Empty state references `"Plan 2 introduces the examiner creation workflow."` instead of an accurate empty state message. |

### Low Priority
| ID | Area | File & Location | Deficiency & Impact |
| --- | --- | --- | --- |
| **L-01** | Reduced Motion | [globals.css](file:///home/huzayfa/Web-Hackathon/src/app/globals.css), [NetworkStatusPill.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/NetworkStatusPill.tsx#L17), [MonitorDashboard.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/MonitorDashboard.tsx#L55) | Respect `@media (prefers-reduced-motion: reduce)` for `.animate-spin`, `.animate-pulse`, and CSS transitions. |
| **L-02** | Public Verify UX | [verify/[code]/page.tsx](file:///home/huzayfa/Web-Hackathon/src/app/verify/[code]/page.tsx#L11-L14) | Add direct verification code lookup form on `/verify` (or from not-found state) and `font-mono tabular-nums` styling for IDs. |
| **L-03** | Scratchpad Save Perf | [ScratchpadDrawer.tsx](file:///home/huzayfa/Web-Hackathon/src/components/exam/ScratchpadDrawer.tsx#L149-L154) | Debounce IndexedDB note persistence slightly (200ms + unmount flush) and adapt canvas border/notes colors to Dark/High-Contrast themes. |
| **L-04** | Password Visibility Toggle | [LoginForm.tsx](file:///home/huzayfa/Web-Hackathon/src/components/LoginForm.tsx#L61-L63), [AdminUserManager.tsx](file:///home/huzayfa/Web-Hackathon/src/components/AdminUserManager.tsx#L122) | Add optional accessible show/hide password toggle for complex 12+ character temporary passwords. |
| **L-05** | Grading Filter & Progress | [GradingWorkbench.tsx](file:///home/huzayfa/Web-Hackathon/src/components/examiner/GradingWorkbench.tsx#L78-L80) | Add inline progress counter (`X / Y graded · Z written pending`) and quick `"Needs written grading"` filter in the candidate list. |
| **L-06** | Action Button Touch Targets | Multiple components (`px-2.5 py-1.5 text-xs`) | Standardize compact table/toolbar action controls to `>= 36px`–`40px` hit target height for pointer and touch comfort. |

---

## 4. Proposed Design System Architecture

Aligned directly with `.agents/skills/examination-ui-ux/references/design-system.md` while maintaining offline/Docker build safety (zero external paid APIs or brittle font CDNs):

### 4.1 Semantic CSS Token Architecture (`src/app/globals.css`)
- **Theme Scoping via CSS Custom Properties**:
  - `:root` (Default Light):
    - `--bg-canvas`: `#f8fafc` (Slate 50)
    - `--bg-surface`: `#ffffff`
    - `--bg-surface-subtle`: `#f1f5f9` (Slate 100)
    - `--text-primary`: `#0f172a` (Slate 900)
    - `--text-secondary`: `#475569` (Slate 600)
    - `--text-muted`: `#64748b` (Slate 500 — darkened where needed on `#f8fafc` to guarantee `>= 4.5:1` WCAG AA)
    - `--border-subtle`: `#e2e8f0` (Slate 200)
    - `--border-strong`: `#cbd5e1` (Slate 300)
    - `--accent-primary`: `#1e3a8a` or `#3730a3` (Deep Academic Indigo/Navy `>= 7:1` contrast with white text)
    - `--accent-primary-hover`: `#1e1b4b`
    - `--accent-soft`: `#eef2ff`
    - `--accent-soft-text`: `#312e81`
    - Semantic statuses (`--status-success-*`, `--status-warning-*`, `--status-danger-*`, `--status-info-*`)
  - `.exam-theme-dark` and `.exam-theme-contrast`: **Override the CSS custom properties themselves** (`--bg-canvas`, `--bg-surface`, `--bg-surface-subtle`, `--text-primary`, `--text-secondary`, `--border-subtle`, `--accent-soft`, `--accent-soft-text`, etc.) on the workspace container **and propagate into Portals/Drawers/Modals** mounted inside that workspace wrapper, rather than fragile `[class*="text-slate-"]` overrides.
- **Typography**:
  - Font stack: `Inter, "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (or `next/font/local`/system UI stack if avoiding network font fetch during offline Docker builds; confirm with owners in §8).
  - Tabular monospace stack: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` with `.tabular-nums` applied to countdown timers, scores, marks totals, pagination counts, and verification codes.
  - Ensure `button, input, select, textarea { font: inherit; }`.
- **Geometry & Surfaces**:
  - Card/Panel radius: `10px` (`rounded-[10px]` / `rounded-xl` standardized via `--radius-surface: 10px`).
  - Control/Input/Button radius: `6px` (`--radius-control: 6px`).
  - Flat structural surfaces (`box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04)` for cards, `box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14)` reserved strictly for elevated modals/drawers).
  - Minimum readable scale: `12px` (`0.75rem`) floor for micro-labels/badges; `14px` (`0.875rem`) for tables/controls; `16px` (`1rem`) minimum for question stems, answer options, and written editors.

### 4.2 Shared UI Primitive Library (`src/components/ui/`)
Create a cohesive, typed, unit-tested primitive layer:
1. `Modal.tsx` & `Drawer.tsx`: Accessible `role="dialog"` `aria-modal="true"` with `Escape` key closing, focus trap (`Tab`/`Shift+Tab` cycling), initial focus placement, body scroll lock, and automatic **focus restoration** to the opener button on close. Inherits exam CSS variables when rendered inside `ExamWorkspace`.
2. `ConfirmDialog.tsx`: Typed confirmation modal supporting standard and `"danger"` severity variants, explicit impact description, and disabled-while-busy state (replaces unsafe one-click deletes, account deactivations, role escalations, and irreversible exam transitions).
3. `AlertBanner.tsx`: Standardized `role="status"` (`aria-live="polite"`) or `role="alert"` (`aria-live="assertive"`) banners with semantic icons + text + optional dismiss control.
4. `StatusBadge.tsx`: Unified icon+text+color pill mapping (`DRAFT`, `PUBLISHED`, `ONGOING`, `COMPLETED`, `OPEN`, `UNDER_REVIEW`, `RESOLVED_*`, `ACTIVE`/`INACTIVE`, `ONLINE`/`GAP`) ensuring state is never communicated by color alone.
5. `Tabs.tsx`: Accessible `role="tablist"` + `role="tab"` with `aria-selected`, `aria-controls`, arrow-key navigation, and optional dirty-state warning hook.
6. `Breadcrumb.tsx`: Compact hierarchical wayfinding (`Examinations > Mid-Term > Monitor`).
7. `DataTableControls.tsx`: Reusable Search + Filter + Client/Server Pagination toolbar (`Page X of Y`, page size selector, total results count, mobile card fallback slot).
8. `FormField.tsx`: Standardized label + input/textarea wrapper displaying inline client & server Zod field-level validation messages (`aria-invalid`, `aria-describedby`).
9. `EmptyState.tsx`: Consistent empty states with relevant icon, domain-accurate explanation, and optional primary action.

---

## 5. Phased Implementation Plan & Affected Files

To comply with `AGENTS.md` (small atomic commits, continuous passing gates), execute across 5 sequential phases on `feat/ui-ux-redesign`:

### Phase A — Design System Tokens & Core Shared Primitives
- **Scope**: Address `M-01`, `M-02`, `M-03`, `L-01`, and groundwork for `C-04`/`C-05`.
- **Files**:
  - Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`, `src/components/LoginForm.tsx`
  - Add: `src/components/ui/Modal.tsx`, `Drawer.tsx`, `ConfirmDialog.tsx`, `AlertBanner.tsx`, `StatusBadge.tsx`, `Tabs.tsx`, `Breadcrumb.tsx`, `DataTableControls.tsx`, `FormField.tsx`, `EmptyState.tsx`
  - Add helper: `src/lib/form-errors.ts` (extract structured Zod `error.details` cleanly without altering API contracts).
- **Acceptance Criteria**:
  - All primitives have unit/component checks (or clean TypeScript props + keyboard/Escape tests).
  - `@media (prefers-reduced-motion: reduce)` suppresses spinners/pulse.
  - Light, Dark, and High-Contrast CSS tokens resolve correctly across both cards and dialog/drawer overlays.

### Phase B — Navigation Shell & High-Population Administrative Efficiency
- **Scope**: Address `H-01`, `H-02`, `H-06`, `H-10`, `M-09`, `M-10`, `C-04`, `C-06` (Admin).
- **Files**:
  - Modify: `src/components/AppShell.tsx` (split client mobile drawer toggle + active `usePathname()` `aria-current="page"` link state while preserving server session rendering).
  - Modify: `src/app/admin/page.tsx` (fix stale Plan 2 copy, add `StatusBadge` + quick links), `src/components/StatCard.tsx`.
  - Modify: `src/components/AdminUserManager.tsx` (pagination + page-size, inline validation errors, confirm dialog on deactivation & role changes, accessible reset-password modal, mobile card view fallback).
  - Modify: `src/app/admin/audit/page.tsx` + add client `AuditTrailViewer.tsx` (action-type & actor search filters, pagination controls, mobile layout).
  - *Optional read-only backend query extension (if approved in §8)*: paginated query params on `/api/admin/users` and `/api/audit` so >1,000 rows never hydrate all at once; otherwise initial bounded client/server pagination wrapper.
- **Acceptance Criteria**:
  - Zero horizontal action overflow on `375px` mobile viewports.
  - Active sidebar item clearly marked (`aria-current="page"`); mobile nav collapses behind toggle button.
  - Deactivate and Role change require explicit confirmation.

### Phase C — Examiner Authoring, Fairness, Monitoring, Grading & Analytics
- **Scope**: Address `C-04`, `C-06`, `H-01`, `H-06`, `H-07`, `H-08`, `H-09`, `H-10`, `M-04`, `M-07`, `L-05`.
- **Files**:
  - Modify: `src/components/examiner/QuestionBankManager.tsx` (pagination, `<ConfirmDialog>` on delete, accessible `<Modal>` for editor/preview, inline field validation).
  - Modify: `src/components/examiner/BulkImportModal.tsx` (adopt `<Modal>` for focus trap & Escape).
  - Modify: `src/components/examiner/ExamListManager.tsx` (search/status filter, `<ConfirmDialog>` before draft deletion, `<StatusBadge>`, inline cross-field date/marks validation).
  - Refactor `src/components/examiner/ExamBuilderWorkspace.tsx` into modular sub-components under `src/components/examiner/builder/` (`DetailsTab.tsx`, `CompositionTab.tsx`, `FairnessTab.tsx`, `EnrollmentsTab.tsx`, `PublishTab.tsx`) using `<Tabs>`, unsaved-changes dirty indicator/guard, `<ConfirmDialog>` before `Publish` / `Open now` / `Close & mark COMPLETED`, and paginated enrollment table.
  - Modify: `src/components/examiner/MonitorDashboard.tsx` (add `<Breadcrumb>`, search + status filter chips `All` / `Online` / `Gap` / `Has Signals`, adopt `<Drawer>` for incident inspector, explain disabled `Grant audited extension` requirement inline).
  - Modify: `src/components/examiner/GradingWorkbench.tsx` (add `<Breadcrumb>`, filter `"Needs written grading"`, progress summary bar, adopt `<Modal>` for preview summary).
  - Modify: `src/app/examiner/exams/[id]/analytics/page.tsx` (add `<Breadcrumb>`, accessible chart bar descriptions/table alternative, clean typography floor `>= 12px`).
  - Modify: `src/components/examiner/DisputeWorkbench.tsx` (queue filter counts, inline field validation on resolution note/adjusted score).
- **Acceptance Criteria**:
  - All modals/drawers pass Escape/Focus-trap checks.
  - Zero single-click deletes or irreversible status changes.
  - Every `/examiner/exams/[id]/*` sub-page has breadcrumb return navigation.

### Phase D — High-Stakes Candidate Dashboard, Live Exam Workspace & Results/Verification
- **Scope**: Address `C-01`, `C-02`, `C-03`, `C-04`, `C-05`, `H-03`, `H-04`, `H-05`, `H-07`, `M-05`, `M-06`, `L-02`, `L-03`.
- **Files**:
  - Modify: `src/components/candidate/CandidateExamsBoard.tsx`:
    - Show `submittedAt` on completed cards when attempt exists.
    - Replace raw instruction modal with accessible `<Modal>` + explicit pre-start confirmation step explaining 1-attempt policy & server clock before entering `/take`.
  - Modify: `src/components/exam/ExamWorkspace.tsx`:
    - **Fix `C-01`**: Decouple interval `useEffect` dependencies using refs (`syncStateRef`, `queuedCountRef`) so heartbeat & reconnect timers run reliably at fixed 10s/5s cadence without churning on keystrokes; accurately distinguish offline empty queue (`Offline — waiting to reconnect`) from synced (`NetworkStatusPill.tsx`).
    - **Fix `C-02`**: Buffer `WRITTEN` textarea edits in component state + immediate local queue backup and debounce network sync (`400ms`), guaranteeing explicit immediate flush on question navigation, blur, and `"Review & Submit"`.
    - **Fix `C-03`**: Pass `submitError` directly into `<ReviewSubmitModal>` so sync/submission errors render prominently inside the dialog; enrich finalized receipt view with Exam Title, Attempt Reference ID, `submittedAt` timestamp, and answer summary.
    - **Fix `H-03`**: Disable `N`/`P`/`M` keyboard shortcuts whenever any modal/drawer is open, `isContentEditable` is true, or `ctrlKey`/`metaKey`/`altKey` is pressed.
    - **Fix `H-04`**: Add `aria-live="polite"` announcement banner + accessible `"Announcements (count)"` history popover so prior broadcasts are never lost; add screen-reader milestone announcements at 5 min and 1 min remaining (respecting `hideTimer` visual toggle or clarified policy).
  - Modify: `src/components/exam/ExamHeader.tsx`, `QuestionPalette.tsx`, `NetworkStatusPill.tsx`, `WorkspacePreferencesDrawer.tsx`, `ScratchpadDrawer.tsx`, `ReviewSubmitModal.tsx`:
    - Adopt accessible `<Drawer>` and `<Modal>` primitives; inherit theme CSS custom properties cleanly into Light/Dark/High-Contrast modes (including selected options & scratchpad surface).
    - Compact mobile ExamHeader layout without losing timer/sync status visibility.
  - Modify: `src/app/candidate/results/[attemptId]/page.tsx` & `src/components/results/DisputePanel.tsx`: add `<Breadcrumb>` / back link to `/candidate/dashboard` and inline field errors.
  - Modify: `src/app/verify/[code]/page.tsx` (plus optional `/verify` index helper if desired): typography/contrast polish with tabular verification IDs.
- **Acceptance Criteria**:
  - Heartbeat interval fires deterministically regardless of typing speed (verified by Vitest/Playwright or unit clock test).
  - `WRITTEN` edits remain 100% recoverable across reload/offline disconnect without keystroke network floods.
  - `ReviewSubmitModal` displays server/offline sync errors inline above Confirm button.
  - All 3 exam themes (Light, Dark, High-Contrast) achieve WCAG AA contrast across question panel, option cards, header, palette, modals, and drawers.

### Phase E — Full Verification, Accessibility Audit & Handoff Documentation
- **Scope**: Complete cross-browser/viewport, keyboard, WCAG 2.2 AA, and automated regression checks; update `docs/WORK_DONE.md` and `docs/handoffs/06-ui-ux-redesign.md`.
- **Verification Commands**:
  1. `npx prisma generate`
  2. `npm run typecheck && npm run lint`
  3. `npx vitest run` (existing suite + new unit/component tests for debounce sync, interval stability, `Modal`/`ConfirmDialog` keyboard focus behavior, `form-errors.ts`)
  4. `npm run build`
  5. `npx playwright test` (existing E2E flows + new Playwright specs covering keyboard-only navigation, Escape/focus trap, mobile `375px` layout, offline queue + submission error inside modal, dark/high-contrast theme checks, zero Axe-core WCAG 2.2 AA serious/critical violations if `@axe-core/playwright` is added, or programmatic contrast/ARIA Playwright assertions if zero new deps preferred).

---

## 6. Dependencies & Technical Constraints

1. **Zero Backend Invariant Alterations**: Every route handler invariant from `AGENTS.md` (`requireAuth`, ownership verification, zero answer-key leakage, server-authoritative `hardDeadlineAt` / `effectiveDeadlineAt`, atomic finalization, monotonic `clientSeq`, `isSandbox: false`, non-conclusive monitoring signals, privacy-safe `/verify/[code]`) remains strictly untouched.
2. **No Paid APIs / Offline Docker Safety**: Do not introduce paid UI kits, remote icon CDNs, or build steps that fail without internet access. Stick to existing dependencies (`lucide-react`, Tailwind CSS v4, Playwright, Vitest).
3. **Incremental Atomic Commits**: Each sub-step within Phases A–E must pass `npm run typecheck && npm run lint` (and targeted tests) before committing on `feat/ui-ux-redesign`.

---

## 7. Testing & Acceptance Strategy

| Test Layer | Target Verification |
| --- | --- |
| **Vitest Unit & Component** | Zod `error.details` mapper (`src/lib/form-errors.ts`), debounced written-answer flush on submit/navigate, heartbeat timer stability under simulated state updates, modal Escape/focus-return helper hooks. |
| **Playwright E2E Workflows** | Keyboard-only exam completion (`Tab`, option selection, `Review & Submit`, `Escape` modal close, `N`/`P`/`M` blocked while drawer open), offline answer queue + inline modal submit error -> reconnect -> receipt verification, Dark/High-Contrast theme propagation to drawers, mobile `375x812` `AppShell` navigation drawer, examiner delete/publish confirmation dialogs, monitor `GAP` justification clarity. |
| **WCAG 2.2 AA Check** | Explicit landmark/heading hierarchy check, `aria-live` assertions on sync & announcements, focus visibility across Light/Dark/High-Contrast themes, zero horizontal scroll overflow on `375px` mobile viewports. |
| **Release Gates** | `npx prisma generate && npm run typecheck && npm run lint && npx vitest run && npm run build && npx playwright test` passing with 0 failures. |

---

## 8. Approved Boundary Decisions

All three architectural boundary decisions were approved (recorded in [docs/DECISIONS.md](./DECISIONS.md) #15–17):

1. **Large-Population Pagination**: Added backward-compatible optional `?page=&limit=&search=` (and filter) query parameters on `GET /api/admin/users`, `GET /api/questions`, and `GET /api/admin/audit`, returning `pagination` metadata while preserving default unparameterized payloads.
2. **Offline-Safe Fonts**: Standardized on a zero-network CSS font stack (`Inter`, `"Plus Jakarta Sans"`, `-apple-system`, system-ui sans + monospace `tabular-nums`) for deterministic `docker build` and offline exam resilience.
3. **`Hide Timer` Preference**: Keep the ticking clock hidden while emitting non-intrusive `aria-live="polite"` screen-reader and subtle banner cues at `5m` and `1m` remaining thresholds.
