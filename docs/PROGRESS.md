# Progress Log

Implementation follows the approved plan. Each milestone ends with typecheck, lint, tests, build,
and a git commit.

## Milestone (a) — Scaffold, auth, RBAC

- Next.js 14.2.35 + strict TypeScript + Tailwind/shadcn-style primitives and dark mode.
- Auth.js v5 credentials login, JWT sessions, edge-safe middleware, student registration, forced password change.
- Server guards (`requireUser`, `requireRole`, `requireStudent`, `requireOfficer`, `requireRecruiter`), auth rate limiting, security headers, env validation.
- Role shells/dashboards, notifications API foundation, forbidden/error/not-found states.
- Verified: typecheck, lint, Vitest (8 tests), production build.

## Milestone (b) — Schema and seed

- Full SQLite/Prisma schema: 23 models, relations, unique constraints, and query indexes; no enums, arrays, or JSON columns.
- Deterministic seed with 64 skills, 6 role profiles, 50 students, 10 companies, 12 recruiters, 8 drives, 154 applications, 30 offers, notifications, saved candidates, and 120 audit records.
- Sample PDF resume generated under `uploads/resumes`; demo accounts seeded for all roles.
- Seed assertions enforce minimum counts; repeated seed/reset verified.
- Verified: typecheck, lint, Vitest, production build.

## Milestone (c) — Eligibility engine, overrides, skill gap

- Pure, dependency-free eligibility engine with deterministic reasons/warnings, profile gates, drive state/deadline, branch/year, skill proficiency, placed-tier/dream-offer policy, and weighted match scoring.
- Skill-gap calculator prioritises mandatory gaps and returns resources, strengths, and target coverage.
- Prisma adapters/evaluation service, CSV-backed policy mapping, active officer overrides with audit trail, drive-wide evaluation, snapshots, and persisted deduplicated eligibility notifications.
- Notification service + in-process realtime hub foundation (SSE route wiring follows in milestone g).
- Seed hardening: demo student now verified, has a resume, and is eligible for DataForge.
- Verified: typecheck, lint, Vitest (48 tests), production build, and seeded end-to-end evaluation run.

## Milestone (d) — Student experience

- Student dashboard with live eligibility, active applications, offers, deadlines, upcoming rounds, and profile completeness.
- Profile editing, private PDF resume upload (5 MB, magic-byte validation, random filename), resume serving with owner/officer/recruiter authorization and audit logging for non-owner access.
- Skill management with evidence, proficiency history, verification reset on edits, target-role selection, and skill-gap analysis with learning resources.
- Drive catalogue/detail with rules, weighted match, missing-skill resources, rounds, eligibility reasons, officer-override awareness, and apply/reapply flow.
- Application tracker/detail with round timeline, offer details, feedback, and guarded withdrawal.
- Notifications page with read state and mark-all support.
- Server actions guard roles, Zod-validate every mutation, scope data by student, audit changes, and revalidate affected pages.
- Verified: typecheck, lint, Vitest (57 tests), production build, apply/withdraw/reapply service run, authenticated production-server smoke checks for all student pages and resume download.

## Milestone (e) — Placement officer portal

- Officer dashboard with placement/verification metrics, branch and company summaries, status distribution, recent drives, pending verification queue, and Recharts visualisations.
- Student administration: searchable/paginated directory, profile detail, profile and skill verification, CSV import with per-row validation/duplicate detection/one-time credentials, and filtered CSV export.
- Company and recruiter administration: create/edit companies, activate/deactivate, create recruiters with one-time credentials, reset passwords, and activate/deactivate accounts. Deactivation revokes recruiter sessions.
- Drive administration: draft/create/edit with rules, required skills, and rounds; publish; approval queue with rejection reasons; close/complete; eligibility rerun/review with audited overrides.
- Candidate pipeline: round scheduling/removal, round results with automatic advancement/rejection, manual status changes, policy-checked offers (dream upgrades, tier/offer limits), and offer revocation.
- Placement policy editing, filterable audit log with CSV export, shared notifications, and CSV/PDF placement report exports.
- Privileged account changes increment `User.sessionVersion`, invalidating existing JWTs; role-prefixed API routes return 401/403 instead of 500.
- Verified: typecheck, lint, Vitest (70 tests), production build, authenticated smoke checks for all officer pages, exports (CSV/PDF), RBAC denial, and session invalidation.

## Milestone (f) — Recruiter portal

- Company-scoped recruiter dashboard with drive/application/offer metrics, status distribution, upcoming rounds, active drives, and recent applicants.
- Drive management: drive list/detail, recruiter-originated drive requests with officer approval, rejected-request editing/resubmission, and read-only handling for pending/closed drives.
- Candidate discovery: verified campus-wide search by text, branch, graduation year, CGPA, AND/OR skills, saved-only filter, drive-specific eligibility ranking, and skill-coverage ranking.
- Talent pipeline: private saved candidates with notes, shortlisting with eligibility/override checks, recruiter feedback, rejection with reason, round-result recording, and applicant resume access.
- Recruiter drive-request and pipeline notifications, role/company guards on every service/action, audit logs, and responsive recruiter UI.
- Added recruiter validation, skill-coverage tests, and recruiter navigation. Seed reset to deterministic demo state after service smoke checks.
- Verified: typecheck, lint, Vitest (77 tests), production build, authenticated recruiter page/detail smoke checks, and service smoke run covering dashboard, search, save/remove, shortlist, round result, feedback, rejection, and drive request.

## Milestone (g) — Notifications and real-time

- Added authenticated SSE endpoint at `/api/notifications/stream` with role/company channel subscriptions, 15-second heartbeat comments, abort/cancel cleanup, and 401/403 JSON failures.
- Added a client realtime bridge that reconnects via `EventSource`, deduplicates notification IDs, refreshes authorized pages on application/offer/round/drive events, and falls back to 12-second polling while disconnected.
- Notification bell now reacts to live notification, read, and refresh events; the notification panel prepends live notifications and refreshes via the API, with server-prop synchronisation.
- Live notification payloads now include body, read state, and creation time so the client can render without an extra round trip.
- Added realtime hub tests for fan-out, unsubscribe, connection counts, role channels, and heartbeats.
- Verified: typecheck, lint, Vitest (80 tests), production build, authenticated SSE headers/stream (`: connected`, `retry: 5000`), and unauthenticated 401 response.

## Milestone (h) — Analytics and reports

- Extended placement reports with skill supply/demand analytics: per-skill student claims, drive
  requirements, a top-24 heatmap, top-10 in-demand skills, and branch/year/company/drive filters.
- Added per-drive funnels: Applied → Shortlisted → every configured round → Offered, with stage
  counts, round metadata, applied-to-offer conversion, and a drive selector.
- Added officer report UI sections for package KPIs, funnels, skill demand, branch/company
  performance, offer trends, and offer detail, with loading, error, and empty states.
- Added shared reporting helpers for CSV building (including spreadsheet-formula neutralization),
  funnel conversion, and heatmap intensity, with unit tests.
- Added scoped eligible-list and shortlist exports:
  - `/api/exports/eligible` is officer-only and includes live eligibility plus active overrides.
  - `/api/exports/shortlists` allows officers or the owning recruiter/company, supports whole-drive
    or per-round exports, and rejects cross-company access.
  - Both support CSV/PDF, validate query/format with Zod, use private no-store responses, and audit
    successful exports.
- Added reusable PDF table rendering with pdfkit and export controls on officer/recruiter drive
  detail pages and `/officer/reports`.
- Fixed stale-session redirect loops after database resets by validating the authenticated user
  against the database in landing, login, and registration before redirecting. This prevents a
  protected page → `/login` → role-home loop when an old JWT references a deleted user or old
  session version.
- Added the project README with setup, architecture, feature map, route map, security model,
  deployment limitations, and troubleshooting.
- Verified: typecheck, lint, Vitest (86 tests), production build, authenticated report/export
  responses, unauthenticated API 401s, and stale-session handling.
