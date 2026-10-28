# Student Skill Tracker & Placement Portal — Implementation Plan

Status: approved. This document is the source of truth for architecture, data model, routes,
eligibility behavior, seeding, milestones, and traceability.

## 1. Architecture Overview

The portal is a single Next.js 14 App Router application using a server-first architecture.

```
Browser
  ├─ Server Components ──────────────► service layer ──► Prisma ──► SQLite
  ├─ Server Actions (mutations) ─────► service layer
  ├─ Route Handlers (files/SSE/export)► service layer
  └─ EventSource / 12s polling ──────► in-process realtime hub
```

### Layering

| Layer | Responsibility |
| --- | --- |
| `src/app` | Pages, layouts, route handlers, server actions (transport only) |
| `src/server/services` | Authorization-aware business logic and transactions |
| `src/lib/eligibility` | Pure, framework-free eligibility and skill-gap domain logic |
| `src/server/auth` | Auth.js config, guards, password hashing, rate limiting |
| `src/lib/validation` | Shared Zod schemas used by client and server |
| `src/components` | Presentation, forms, tables, charts, shadcn/ui primitives |

Server components call services directly (no internal HTTP). Mutations use server actions for
forms and JSON, and route handlers for streaming, uploads, imports, and exports. Every server
action and route handler re-checks authentication and authorization; middleware is only the first
line of defense.

### Key decisions

1. **Auth.js v5 credentials + JWT sessions.** The Prisma adapter is not used. Auth config is split
   into an edge-safe `auth.config.ts` (pages, callbacks, `authorized`) and a Node-only `auth.ts`
   that registers the Credentials provider and bcrypt/Prisma lookups. Sessions carry `id`, `role`,
   and `mustChangePassword`; every server request also reloads the user to reject deactivated
   accounts promptly.
2. **SQLite constraints.** No Prisma enums, JSON columns, or scalar lists. Roles/statuses/categories
   are `String` columns validated by shared Zod enums and TypeScript unions. Multi-value rules
   (branches, graduation years, tiers) are comma-separated strings behind `parseCsv`/`serializeCsv`
   helpers. Audit snapshots are JSON strings. All schema features are PostgreSQL-portable; the only
   provider-specific setting is the datasource URL.
3. **Pure eligibility engine.** `src/lib/eligibility/engine.ts` imports no Prisma, Next.js, or I/O.
   It takes a complete student/drive snapshot plus an injected `now` ISO timestamp and returns a
   deterministic result. `src/server/services/eligibility.ts` builds the snapshot, persists it on the
   application, and handles overrides, notifications, and auditing outside the engine.
4. **SSE in a Next.js route handler.** `/api/events` is a Node-runtime `ReadableStream` route with
   `Cache-Control: no-cache`, `X-Accel-Buffering: no`, a 20-second heartbeat, and abort cleanup.
   `src/server/realtime/hub.ts` stores controllers in a `globalThis` singleton keyed by user, role,
   and company channels. Mutations publish minimal event payloads after commit; clients refetch
   authorized data. If SSE cannot connect, the client falls back to 12-second polling against
   `/api/notifications`. This design assumes one Node process (consistent with SQLite and local file
   storage). Redis pub/sub would replace the hub for multi-instance deployment.
5. **Files.** Resumes are stored under `/uploads/resumes` outside `public`, with random names, a 5 MB
   limit, PDF magic-byte validation, and an authenticated download route. Access is role-scoped and
   audited.
6. **Audit-first privileged actions.** Eligibility overrides, verification, drive approval, imports,
   exports, round changes, and offers write `AuditLog` entries with sanitized before/after JSON.
7. **Deterministic demo data.** A seeded RNG generates 50 students, 10 companies, 64 skills, 8 drives,
   applications, rounds, offers, notifications, and audit records. Demo credentials are stable.

## 2. Folder Structure

```
prisma/
  schema.prisma
  seed.ts
  migrations/
uploads/                          # gitignored; seeded sample resume
src/
  app/
    (auth)/login, register
    (student)/student/{page,profile,skills,skills/gap,drives,drives/[id],
                        applications,applications/[id],notifications}
    (officer)/officer/{page,students,students/[id],students/import,
                        companies,companies/[id],drives,drives/new,drives/[id],
                        approvals,policies,reports,audit,notifications}
    (recruiter)/recruiter/{page,drives,drives/[id],drives/request,
                            candidates,candidates/[id],notifications}
    account/password, forbidden, notifications? (role pages instead)
    api/auth/[...nextauth], api/events, api/notifications,
    api/files/resume/[studentProfileId], api/uploads/resume,
    api/imports/students, api/imports/round-results,
    api/exports/eligible, api/exports/shortlists, api/exports/placements,
    api/health
    layout.tsx, page.tsx, globals.css, error.tsx, not-found.tsx
  components/
    ui/                           # shadcn/ui primitives
    layout/                       # shell, sidebar, topbar, notification bell
    charts/                       # Recharts wrappers
    shared/                       # empty state, pagination, badges, charts
    student/ officer/ recruiter/  # feature forms and tables
  lib/
    eligibility/{types,engine,gap,normalize,index}.ts
    validation/{auth,student,drive,application,officer,recruiter}.ts
    constants.ts, csv.ts, utils.ts, formatting.ts, env.ts
    hooks/{use-realtime,use-notifications,use-debounce}.ts
  server/
    auth/{auth.config? at src/auth.config.ts, guards, password, rate-limit}
    db.ts, audit.ts, realtime/hub.ts, actions/*.ts, services/*.ts
  auth.config.ts, auth.ts, middleware.ts
tests/e2e/
docs/
```

## 3. Prisma Schema

The complete schema lives at `prisma/schema.prisma`. Core conventions:

- ids are `cuid()` strings; timestamps are UTC `DateTime`.
- role/status strings are validated by `src/lib/constants.ts` Zod enums.
- multi-value rule fields are CSV strings: `allowedBranches`, `allowedGraduationYears`,
  `blockedPlacedTiers`.
- unique constraints: `User.email`, `StudentProfile.rollNumber`, `StudentProfile.userId`,
  `StudentSkill(studentProfileId, skillId)`, `DriveRequiredSkill(driveId, skillId)`,
  `Round(driveId, order)`, `Application(studentProfileId, driveId)`,
  `ApplicationRoundResult(applicationId, roundId)`, `Offer.applicationId`.
- indexes cover every list/filter path: drive status+deadline, application drive+status,
  notification user+read, skill history, audit entity, candidate search skill+proficiency.

Models: `User`, `StudentProfile`, `Skill`, `StudentSkill`, `SkillHistory`, `Company`,
`RecruiterProfile`, `Drive`, `EligibilityRule`, `DriveRequiredSkill`, `Round`, `Application`,
`ApplicationRoundResult`, `Offer`, `Notification`, `AuditLog`, `EligibilityOverride`,
`PlacementPolicy`, `RoleProfile`, `RoleProfileSkill`, `LearningResource`, `SavedCandidate`.

## 4. Page / API Map and Authorization

### Pages

| Path | Role | Purpose |
| --- | --- | --- |
| `/`, `/login`, `/register` | public | landing, credentials login, student registration |
| `/forbidden`, `/account/password` | authenticated | 403, forced password change |
| `/student` | STUDENT | dashboard, completeness, deadlines, notifications |
| `/student/profile` | STUDENT (self) | personal info, links, resume |
| `/student/skills` | STUDENT (self) | catalog skills, evidence, timeline |
| `/student/skills/gap` | STUDENT (self) | role- and drive-based gap analysis |
| `/student/drives`, `/student/drives/[id]` | STUDENT | active drives, eligibility, apply/withdraw |
| `/student/applications`, `/[id]` | STUDENT (owner) | pipeline, round schedule/results, offers |
| `/student/notifications` | STUDENT (self) | notification center |
| `/officer` | OFFICER | KPIs and charts |
| `/officer/students`, `/[id]`, `/import` | OFFICER | search/filter/sort, verify, CSV import |
| `/officer/companies`, `/[id]` | OFFICER | companies and recruiters |
| `/officer/drives`, `/new`, `/[id]` | OFFICER | drive CRUD, rules, rounds, applicants, overrides |
| `/officer/approvals` | OFFICER | recruiter drive requests |
| `/officer/policies` | OFFICER | placement policy |
| `/officer/reports` | OFFICER | CSV/PDF exports |
| `/officer/audit` | OFFICER | audit log |
| `/officer/notifications` | OFFICER (self) | notification center |
| `/recruiter` | RECRUITER | company-scoped KPIs |
| `/recruiter/drives`, `/[id]`, `/request` | RECRUITER (company scope) | own drives, applicants, request drive |
| `/recruiter/candidates`, `/[id]` | RECRUITER | verified candidate search, resume, save/shortlist |
| `/recruiter/notifications` | RECRUITER (self) | notification center |

### Route handlers

| Route | Method | Auth |
| --- | --- | --- |
| `/api/auth/[...nextauth]` | GET/POST | public (POST rate-limited) |
| `/api/events` | GET | any active authenticated user |
| `/api/notifications` | GET | self only |
| `/api/uploads/resume` | POST | STUDENT self, PDF ≤5 MB |
| `/api/files/resume/[studentProfileId]` | GET | self, OFFICER, or RECRUITER for verified student; audited |
| `/api/imports/students` | POST | OFFICER |
| `/api/imports/round-results` | POST | OFFICER or owning RECRUITER |
| `/api/exports/eligible` | GET | OFFICER |
| `/api/exports/shortlists` | GET | OFFICER or owning RECRUITER |
| `/api/exports/placements` | GET | OFFICER |
| `/api/health` | GET | public |

### Server actions

- Auth: `registerStudent`, `changePassword`.
- Student: `updateProfile`, `setTargetRole`, `addSkill`, `updateSkill`, `removeSkill`,
  `applyToDrive`, `withdrawApplication`, `markNotificationRead`, `markAllNotificationsRead`.
- Officer: company CRUD/deactivate; recruiter create/deactivate; verify/reject profile; verify/reject
  skill; drive create/update/publish/close/delete-draft; upsert rounds; run eligibility preview;
  override/revoke eligibility; bulk shortlist/advance; set/bulk set round results; schedule round;
  record offer; update policy; approve/reject drive request.
- Recruiter: request drive, save/unsave candidate, shortlist candidate for own drive, update round
  result for company drive, add feedback.
- Every action starts with a guard (`requireStudent`, `requireOfficer`, `requireRecruiter`,
  ownership/company assertion), validates with Zod, and scopes Prisma queries to the actor.

## 5. Eligibility Engine

### Inputs

```ts
type EligibilityStudent = {
  studentProfileId: string;
  cgpa: number | null;
  backlogs: number | null;
  branch: string;
  graduationYear: number | null;
  isVerified: boolean;
  hasResume: boolean;
  skills: { skillId: string; proficiency: number }[];
  acceptedOffers: { package: number; tier: number }[];
};

type EligibilityDrive = {
  driveId: string;
  status: DriveStatus;
  deadline: string; // ISO
  package: number;
  tier: number;
  rules: {
    minCgpa: number | null;
    maxBacklogs: number | null;
    allowedBranches: string[];
    allowedGraduationYears: number[];
    requireVerifiedProfile: boolean;
    requireResume: boolean;
  };
  requiredSkills: { skillId: string; minProficiency: number; weight: number; isMandatory: boolean }[];
  policy: {
    maxOffersPerStudent: number;
    blockedPlacedTiers: number[];
    dreamOfferEnabled: boolean;
    minimumDreamOfferIncrease: number;
  };
  existingApplication: { status: ApplicationStatus } | null;
  now: string;
};
```

### Output

```ts
type EligibilityResult = {
  eligible: boolean;
  reasons: { code: ReasonCode; field?: string; message: string; actual?: string|number;
             required?: string|number; skillId?: string }[];
  warnings: { code: WarningCode; message: string }[];
  matchScore: number; // 0..100 weighted proficiency ratio
  matchedSkillIds: string[];
  missingSkills: { skillId: string; required: number; actual: number }[];
  isDreamOffer: boolean;
  snapshotVersion: 1;
};
```

Reasons are collected in a fixed order for determinism. The service layer displays them verbatim
(e.g. `CGPA 6.8 < required 7.5`). Failed mandatory skills produce one reason per skill. Optional
skills only affect `matchScore`. An active officer override bypasses a failing result at the service
layer, is recorded in `EligibilityOverride`, audited, and flagged on the application.

### Rules (in order)

1. Drive status must be `ACTIVE`.
2. `now <= deadline`.
3. No existing `APPLIED/SHORTLISTED/IN_PROCESS/OFFERED` application (withdrawn may reapply).
4. Core profile fields (CGPA, backlogs, branch, graduation year) present.
5. Profile verified when the drive requires it.
6. Resume present when the drive requires it.
7. `cgpa >= minCgpa` when set (epsilon 1e-9).
8. `backlogs <= maxBacklogs` when set.
9. Branch included; empty allowed list means all branches.
10. Graduation year included; empty list means all years.
11. Every mandatory required skill meets `minProficiency`; duplicate skills use highest proficiency;
    unknown skill = 0.
12. Placed-student tier policy: accepted offer + drive tier in `blockedPlacedTiers` is blocked unless
    a dream-offer upgrade applies (dream enabled, drive package exceeds best accepted package by at
    least `minimumDreamOfferIncrease`); then eligible with warning.
13. `maxOffersPerStudent` accepted offers blocks further applications unless the dream upgrade applies.

### Edge cases

- Empty rules allow everyone (subject to deadline/profile).
- Exact CGPA/backlog boundaries pass.
- Deadline at exactly `now` passes; comparisons are UTC.
- Duplicate student skills deduplicated by highest proficiency.
- Missing core fields fail with `PROFILE_INCOMPLETE` listing fields.
- Drive not active/past deadline/duplicate application reasons coexist in fixed order.
- Withdrawn applications can be reset and reapplied; rejected/offered are terminal.
- Overrides never mutate the pure engine result; they are applied and audited in the service.
- No background scheduler: expired drives are rejected by the engine and shown as expired; officers
  may close them manually.

### Unit test list (Vitest)

1. Fully eligible baseline. 2. CGPA equal. 3. CGPA below. 4. Missing CGPA → profile incomplete.
5. Backlogs equal. 6. Backlogs exceeded. 7. Allowed branch. 8. Disallowed branch. 9. Empty branch list
allows all. 10. Allowed graduation year. 11. Disallowed year. 12. Empty year list allows all.
13. Mandatory skill exact. 14. Above required. 15. Below required. 16. Multiple missing mandatory
skills yield multiple reasons. 17. Optional skill shortfall lowers score but passes. 18. No required
skills gives 100. 19. Weighted match score calculation. 20. Duplicate skills use highest. 21. Unknown
required skill counts as zero. 22. Inactive drive. 23. Deadline passed. 24. Deadline exactly now.
25. Already applied. 26. Withdrawn can reapply. 27. Rejected is terminal. 28. Unverified profile when
required. 29. Unverified when not required adds warning only. 30. Resume required/missing. 31. Placed
and blocked tier. 32. Placed dream upgrade allowed with warning. 33. Max offers reached. 34. Multiple
failures returned in deterministic order. 35. Determinism/no input mutation. 36. Skill gap computes
missing skills, priorities, and match. Plus CSV normalization and formatting tests.

## 6. Seed Data Plan

| Entity | Count / detail |
| --- | --- |
| Skills | 64 across language, framework, database, tools, soft skills |
| Role profiles | 6 (full-stack, backend, frontend, data analyst, DevOps, ML) with required skills |
| Learning resources | 90+ docs/courses linked to skills |
| Students | 50 across 7 branches and 2 graduation years; varied CGPA 5.8–9.8 and backlogs |
| Companies | 10 across tiers 1–3 |
| Recruiters | 12 users (1–2 per company) |
| Drives | 8 (5 active, 1 pending recruiter request, 1 draft, 1 completed) with 2–4 rounds |
| Applications | 160+ with realistic statuses and round results |
| Offers | 30 accepted offers (placed students) |
| Notifications / audit | 200+ / 120+ |
| Student skills / history | 450+ / 1,400+ |

Demo accounts (all listed in README):

- Student: `student@campus.test` / `Student@123` (verified, complete, active applications)
- Ineligible student: `student2@campus.test` / `Student@123` (low CGPA/backlogs)
- Placed student: `student3@campus.test` / `Student@123`
- Officer: `officer@campus.test` / `Officer@123`
- Recruiter: `recruiter@campus.test` / `Recruiter@123` (Acme Cloud)
- Second recruiter: `recruiter2@campus.test` / `Recruiter@123` (DataForge)
- All 50 student logins follow `student01@campus.test` … `student50@campus.test` / `Student@123`.

Seeding is deterministic (`mulberry32` RNG seed 42), clears existing data, generates a valid sample
PDF under `uploads/resumes`, and asserts required counts before exiting.

## 7. Milestones and Acceptance Criteria

### (a) Scaffold + Auth + RBAC
- Next/TS/Tailwind/shadcn scaffold, env validation, security headers.
- Credentials login, student registration, JWT sessions, forgot-password out of scope (officer reset).
- Middleware role routing plus server guards; 401/403 behavior; auth rate limiting.
- Lint, typecheck, tests, production build pass; commit.

### (b) Schema + Seed
- Full migration from an empty DB; all models/indexes/constraints.
- Deterministic seed meets counts; credentials work; sample resume exists.
- `npm run seed` idempotent after reset; verification assertions; build/tests pass; commit.

### (c) Eligibility Engine + Tests
- Pure engine/gap modules with no Prisma/Next imports.
- DB adapter/service with snapshot/override support.
- 36+ unit tests, engine coverage ≥85%; lint/typecheck/test/build pass; commit.

### (d) Student Features
- Profile editing/completeness, resume upload/download, skill CRUD/history chart, gap analysis.
- Drive browse with exact eligibility reasons, apply server-blocked, withdraw, application pipeline.
- Notifications list/bell; loading/empty/error states; all checks pass; commit.

### (e) Officer Features
- KPI dashboard, student management/import/verification, companies/recruiters.
- Drive CRUD/rules/rounds, eligibility auto-run on activation, overrides, bulk shortlisting, round
  results CSV, offers, policy, audit, exports; checks pass; commit.

### (f) Recruiter Features
- Company-scoped dashboard/drives/applicants, candidate AND/OR search and ranking, resumes,
  saved candidates, shortlist, round results, feedback, drive requests; checks pass; commit.

### (g) Notifications + Real-Time
- SSE hub/route, reconnect, 12s polling fallback, unread counts, live application/round updates,
  dedupe; manual matrix and checks pass; commit.

### (h) Analytics + Reports
- Skill supply/demand heatmap, drive funnel, branch placement, top skills, package KPIs.
- CSV/PDF eligible lists, shortlists, placement stats by branch/company/year; checks pass; commit.

### (i) Polish + Tests + README
- Responsive/dark/a11y sweep, all loading/empty/error states, rate limits/security review.
- Playwright student and officer flows, README setup/architecture/demo credentials/feature map.
- Clean-clone command sequence and production build verified; final commit.

## 8. Risks and Traceability

| Risk | Mitigation |
| --- | --- |
| SQLite write contention | WAL, busy timeout, short transactions, single-process assumption |
| SSE process-local | polling fallback, documented single-instance limitation, hub abstraction |
| Auth.js beta API drift | pinned version, isolated config, smoke tests |
| SQLite lacks enums/JSON/arrays | string unions + Zod, CSV helpers, JSON snapshots as strings |
| Upload abuse | MIME+magic validation, 5 MB limit, random names, auth route, audit |
| CSV injection/bad data | strict header/row Zod, per-row report, export cell escaping |
| PDF latency/fonts | pdfkit streaming, Helvetica, ASCII-safe seed data |
| Notification storms | dedupe keys and batched inserts |
| IDOR | guards + scoped queries + ownership tests |
| E2E flakiness | dedicated test DB, seeded fixtures, role selectors |

| Feature | Milestone |
| --- | --- |
| Student registration/profile/resume/links | a, d |
| Skill tracker/evidence/history timeline | d |
| Drive and target-role gap analysis + resources | c, d |
| Completeness meter | d |
| Drive browse/eligibility reasons/apply/withdraw | c, d, g |
| Application pipeline/schedules/results | d, e, g |
| Student notifications | d, g |
| Officer KPI dashboard | e |
| Student search/filter/sort/CSV import/verify | e |
| Company/recruiter management | e |
| Drive management/rules/rounds | b, e |
| Eligibility engine/auto-notify/override | c, e, g |
| Bulk shortlisting/schedule/results/auto-advance | e |
| Placement policy | e |
| Audit log | e |
| Eligible/shortlist/placement exports CSV+PDF | h |
| Recruiter scoped dashboard/drives/applicants | f |
| Recruiter candidate search/ranking | f |
| Recruiter resume/shortlist/results/feedback | f |
| Recruiter drive request + approval | e, f |
| Real-time/live status | g |
| Analytics heatmap/funnel/branch/top skills | h |
| Responsive/dark/a11y/states | a, d–i |
| Validation/rate limiting/upload checks/IDOR/secrets | a–i |
| Unit/e2e tests | c, i |
| Seed/demo accounts/README | b, i |

## 9. Resolved Ambiguities

See `docs/DECISIONS.md`. Highlights: JWT credentials without adapter; bcryptjs; temp-password
recruiter onboarding; verification required by default for drives; officer-recorded offers;
tier/dream policy; withdrawn-only reapplication; recruiter shortlist creates an invited application;
recruiter resume access only for verified students and audited; in-memory rate limiting; on-demand
analytics; PDF via pdfkit; 12-second polling fallback; single-process SSE.
