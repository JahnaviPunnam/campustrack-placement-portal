# CampusTrack — Student Skill Tracker & Placement Portal

A full-stack placement platform for students, placement officers, and recruiters. Students build
verified skill profiles and track applications; officers manage drives, eligibility, rounds, offers,
and reports; recruiters search verified talent and manage company-scoped hiring pipelines.

Built with Next.js 14 App Router, TypeScript, Prisma, SQLite, Auth.js, Tailwind CSS, Zod, Recharts,
and server-sent events with a polling fallback.

## Contents

- [Feature overview](#feature-overview)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Demo accounts](#demo-accounts)
- [Scripts](#scripts)
- [Page map](#page-map)
- [API map](#api-map)
- [Eligibility and placement rules](#eligibility-and-placement-rules)
- [Reports and exports](#reports-and-exports)
- [Real-time notifications](#real-time-notifications)
- [Security model](#security-model)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Operational limitations](#operational-limitations)
- [Troubleshooting](#troubleshooting)
- [Project documentation](#project-documentation)

## Feature overview

### Public and authentication

- Marketing landing page with live seeded counts.
- Student self-registration.
- Credentials sign-in with JWT sessions.
- Forced password change for temporary officer-created accounts.
- Role-aware redirects that validate the session against the database, preventing stale-session
  redirect loops after a database reset.
- Forbidden, error, and not-found pages.

### Student

- Dashboard with eligibility, active applications, offers, deadlines, upcoming rounds, and profile
  completeness.
- Profile editing, academic details, links, and private PDF resume upload.
- Skill catalogue with proficiency, evidence, verification state, and proficiency history.
- Target-role selection and skill-gap analysis with learning resources.
- Drive catalogue and drive detail with exact eligibility reasons, match score, missing skills,
  rounds, and active officer overrides.
- Apply, withdraw, and reapply flows enforced on the server.
- Application tracker with round timeline, results, feedback, and offer details.
- Notification centre with read state and live updates.

### Placement officer

- Campus KPI dashboard with placement, package, verification, branch, company, and status charts.
- Student directory with search, filters, pagination, profile detail, and verification.
- Skill verification and audited eligibility overrides.
- Partial CSV import with per-row validation, duplicate handling, and one-time credentials.
- Company and recruiter administration, including activation/deactivation and password resets.
- Drive creation and editing with rules, required skills, rounds, and recruiter-request approval.
- Drive activation runs eligibility and notifies newly eligible students.
- Candidate pipeline: shortlisting, round scheduling, bulk round results, status updates, offers,
  offer revocation, and dream-upgrade policy checks.
- Placement policy configuration.
- Reports: package KPIs, branch/company performance, monthly offer trend, skill supply/demand
  heatmap, top in-demand skills, and per-drive funnels.
- CSV/PDF exports for placements, eligible lists, shortlists, students, and audit logs.
- Filterable audit log and notification centre.

### Recruiter

- Company-scoped dashboard and hiring metrics.
- Company-scoped drive list and drive detail.
- Recruiter-originated drive requests that enter the officer approval queue.
- Verified candidate search across the campus with text, branch, graduation year, CGPA, AND/OR
  skills, saved-only filtering, and drive-specific or skill-coverage ranking.
- Resume access for verified candidates, with audit logging.
- Private saved-candidate talent pool with notes.
- Shortlisting through the eligibility engine, feedback, rejection reasons, and round results.
- Company-scoped shortlist CSV/PDF export.
- Notification centre with live updates.

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 14.2 App Router, React 18, strict TypeScript |
| Styling | Tailwind CSS, shadcn-style Radix primitives, next-themes |
| Database | SQLite via Prisma 6 |
| Authentication | Auth.js v5 beta, credentials, JWT sessions, bcryptjs |
| Validation | Zod shared by client and server |
| Charts | Recharts |
| Real time | Server-sent events plus 12-second polling fallback |
| PDF/CSV | pdfkit, csv-parse, csv-stringify |
| Unit tests | Vitest |
| E2E | Playwright configuration (Chromium) |

## Architecture

```text
Browser
  ├─ React Server Components ──────► services ──► Prisma ──► SQLite
  ├─ Server Actions (mutations) ───► services
  ├─ Route Handlers (files/exports)► services
  └─ EventSource / polling ────────► in-process realtime hub
```

- Pages are server components by default. Client components handle forms, charts, polling, and
  real-time UI.
- Mutations live in `src/server/actions/*`; each action starts with an auth guard, validates input
  with Zod, and calls a service.
- Business logic lives in `src/server/services/*`. Queries that touch role-scoped data are scoped by
  the authenticated actor or company.
- The eligibility engine in `src/lib/eligibility/*` is pure: no Prisma, Next.js, filesystem, network,
  or environment imports.
- Middleware provides the first RBAC layer. Every action and route re-checks authorization.
- Notifications are persisted first, then published to the realtime hub with deduplication.
- SQLite constraints are respected: no Prisma enums, scalar arrays, or JSON columns. Statuses and
  roles are string unions validated by Zod; multi-value rules are CSV strings; snapshots are JSON
  strings.

## Quick start

### Requirements

- Node.js 20+ (Node 22 is used in development)
- npm
- Windows, macOS, or Linux

### Setup

```bash
npm install
cp .env.example .env
```

On Windows PowerShell, copy the environment file with:

```powershell
Copy-Item .env.example .env
```

Generate a strong secret and put it in `.env` as `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Apply migrations and seed the demo database:

```bash
npx prisma migrate dev
npm run seed
```

Start the app:

```bash
npm run dev
```

Open <http://localhost:3000>.

> `npm run seed` removes and recreates demo data. Do not run it against data you want to keep.
> `npm run db:reset` is also destructive and re-seeds the database.

### Production build

Stop any running dev server first, especially on Windows, then run:

```bash
npm run build
npm run start
```

## Environment variables

Copy `.env.example` to `.env`.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | — | Prisma SQLite URL, normally `file:./dev.db` |
| `AUTH_SECRET` | Yes | — | Auth.js JWT signing/encryption secret; use at least 32 random bytes |
| `AUTH_URL` | No | — | Public Auth.js base URL; set to the deployed origin when not using localhost |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Absolute redirect base for middleware and server redirects |
| `UPLOAD_DIR` | No | `./uploads` | Private upload root, outside `public` |
| `MAX_RESUME_MB` | No | `5` | Resume size limit in MB |
| `AUTH_RATE_LIMIT_MAX` | No | `5` | Login attempts allowed per rate-limit window |
| `AUTH_RATE_LIMIT_WINDOW_MINUTES` | No | `15` | Rate-limit window length |

When deploying, set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the public HTTPS origin. The defaults
are intended for local development.

## Demo accounts

The deterministic seed creates these accounts:

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@campus.test` | `Student@123` |
| Ineligible student | `student2@campus.test` | `Student@123` |
| Placed student | `student3@campus.test` | `Student@123` |
| Placement officer | `officer@campus.test` | `Officer@123` |
| Recruiter | `recruiter@campus.test` | `Recruiter@123` |

Additional seeded students and recruiters exist for search, pipeline, and verification demos.

The seed creates approximately 50 students, 10 companies, 12 recruiters, 64 skills, 8 drives, 150+
applications, 30 offers, notifications, audit records, and student skill history. Exact counts can
change after interactive smoke testing.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Generate Prisma client and create a production build |
| `npm run start` | Start the production server after a build |
| `npm run typecheck` | Run TypeScript with no emit |
| `npm run lint` | Run Next.js ESLint |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Run Vitest with coverage for the eligibility engine |
| `npm run test:e2e` | Run Playwright tests |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Create/apply development migrations |
| `npm run db:push` | Push the schema without a migration |
| `npm run db:reset` | Destructive reset and seed |
| `npm run seed` / `npm run db:seed` | Reset and seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run format` | Format with Prettier |

## Page map

| Path | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Landing page; redirects signed-in users to their role home |
| `/login` | Public | Credentials sign-in |
| `/register` | Public | Student registration |
| `/forbidden` | Authenticated | 403 page |
| `/account/password` | Authenticated | Change password |
| `/student` | Student | Dashboard |
| `/student/profile` | Student self | Profile and resume |
| `/student/skills` | Student self | Skills and history |
| `/student/skills/gap` | Student self | Skill-gap analysis |
| `/student/drives` | Student | Drive catalogue |
| `/student/drives/[driveId]` | Student | Drive detail and application action |
| `/student/applications` | Student owner | Application tracker |
| `/student/applications/[applicationId]` | Student owner | Application detail |
| `/student/notifications` | Student self | Notifications |
| `/officer` | Officer | Dashboard |
| `/officer/students` | Officer | Student directory |
| `/officer/students/[id]` | Officer | Student detail and verification |
| `/officer/students/import` | Officer | CSV import |
| `/officer/companies` | Officer | Companies and recruiters |
| `/officer/companies/new` | Officer | Create company |
| `/officer/companies/[id]` | Officer | Company detail |
| `/officer/drives` | Officer | Drive administration |
| `/officer/drives/new` | Officer | Create drive |
| `/officer/drives/[id]` | Officer | Drive detail, applicants, rounds, offers, exports |
| `/officer/drives/[id]/edit` | Officer | Edit drive |
| `/officer/drives/[id]/eligibility` | Officer | Eligibility review and overrides |
| `/officer/approvals` | Officer | Recruiter drive requests |
| `/officer/policies` | Officer | Placement policy |
| `/officer/reports` | Officer | Analytics, funnels, and exports |
| `/officer/audit` | Officer | Audit log |
| `/officer/notifications` | Officer self | Notifications |
| `/recruiter` | Recruiter | Company dashboard |
| `/recruiter/drives` | Recruiter | Company drives |
| `/recruiter/drives/request` | Recruiter | Request a drive |
| `/recruiter/drives/[id]` | Recruiter, own company | Drive detail and shortlist export |
| `/recruiter/drives/[id]/edit` | Recruiter, own company | Edit rejected request |
| `/recruiter/candidates` | Recruiter | Verified candidate search |
| `/recruiter/saved` | Recruiter | Saved candidate pool |
| `/recruiter/notifications` | Recruiter self | Notifications |

## API map

| Route | Method | Access | Purpose |
| --- | --- | --- | --- |
| `/api/auth/[...nextauth]` | GET/POST | Public | Auth.js endpoints; POST is rate-limited |
| `/api/health` | GET | Public | Basic health response |
| `/api/notifications` | GET | Authenticated self | Notification list and unread metadata |
| `/api/notifications/stream` | GET | Authenticated self | SSE stream for role/company/user events |
| `/api/resumes/[studentProfileId]` | GET | Owner, officer, recruiter | Private resume download; non-owner access audited |
| `/api/officer/students/export` | GET | Officer | Filtered student CSV |
| `/api/officer/audit/export` | GET | Officer | Filtered audit CSV |
| `/api/officer/reports/placement` | GET | Officer | Placement CSV/PDF by year/branch/company |
| `/api/exports/eligible` | GET | Officer | Per-drive eligible candidates CSV/PDF |
| `/api/exports/shortlists` | GET | Officer or owning recruiter | Per-drive or per-round shortlist CSV/PDF |

All role-scoped API routes return JSON `401`/`403` errors instead of redirecting to HTML. Export
parameters and formats are validated with Zod; export access is audited.

## Eligibility and placement rules

The eligibility engine evaluates a complete student/drive snapshot with an injected timestamp.

Default gates:

- Drive must be active and before its deadline, unless the caller is an officer preview.
- Required profile verification when the drive requires it.
- Resume required when configured.
- Allowed branches and graduation years.
- Minimum CGPA and maximum backlogs.
- Required skills with minimum proficiency and mandatory/optional weighting.
- Placement policy: maximum offers, blocked tiers for already-placed students, and dream upgrades.
- Active officer overrides can mark a candidate eligible with an audited reason.

Drive tiers:

- `1` = mass
- `2` = standard
- `3` = dream

Default policy blocks placed students from tiers 1 and 2. Dream upgrades require policy enablement
and a package increase above the configured amount. Skill match is a weighted coverage score, not a
pass/fail gate; mandatory skill gaps fail eligibility.

Application statuses:

`APPLIED → SHORTLISTED → IN_PROCESS → OFFERED`, plus `REJECTED` and `WITHDRAWN`.

Round results use `PENDING`, `SCHEDULED`, `PASSED`, `FAILED`, `ABSENT`, and `WAIVED`. Passing the
final round leaves the application `IN_PROCESS` until an officer records an offer.

## Reports and exports

`/officer/reports` includes:

- Students in scope, placed count, placement rate, average/median/highest package.
- Per-drive funnel: Applied → Shortlisted → every configured round → Offered.
- Branch placement chart and company offer chart.
- Monthly accepted-offer trend.
- Skill supply versus demand heatmap, with student claims vs drive requirements.
- Top in-demand skills with current supply.
- Offer detail table.
- Filters for graduation year, branch, company, and drive.

Export behavior:

- Placement CSV/PDF applies the active year/branch/company filters.
- Eligible-list CSV/PDF is officer-only and includes live eligibility plus active overrides.
- Shortlist CSV/PDF is available to officers or recruiters for their own company only.
- Shortlists can be scoped to the whole drive or one round.
- CSV cells are escaped, and spreadsheet formula injection is neutralized.
- PDFs are generated with pdfkit and use a fixed Helvetica layout for predictable server rendering.
- Export actions write audit records.

## Real-time notifications

- Notifications are persisted before real-time publication.
- `/api/notifications/stream` is an authenticated SSE endpoint with heartbeat comments, abort
  cleanup, and 401/403 JSON failures.
- Clients subscribe to user, role, and company channels as appropriate.
- The realtime bridge deduplicates notification IDs, reconnects with backoff, and refreshes
  server-rendered pages on minimal application, offer, round, and drive events.
- If SSE disconnects, the client falls back to 12-second polling. The notification bell keeps a
  30-second safety poll.

SSE and polling assume a single Node process, consistent with SQLite and local file storage.

## Security model

- Passwords are hashed with bcrypt; login attempts are rate-limited by IP and email.
- JWT sessions last 8 hours and carry `id`, `role`, `mustChangePassword`, and `sessionVersion`.
- Privileged account changes, password changes, recruiter deactivation, and company deactivation
  increment `sessionVersion`, invalidating stale sessions at the guard layer.
- `getCurrentUser()` reloads the database user and rejects inactive or version-mismatched sessions.
- Middleware provides role routing; every action and route re-checks authorization.
- Student, recruiter, and company data is scoped to the authenticated actor.
- Recruiters can only access their own company's drives and shortlists.
- Resume files are stored outside `public`, limited to 5 MB, validated by PDF magic bytes, assigned
  random names, and served through an authenticated route.
- Privileged actions and exports are audited. Audit snapshots sanitize secrets.
- CSV exports neutralize spreadsheet formula injection.
- Responses set security headers and avoid leaking stack traces to users.

This project is a demonstration application. Review secrets, deployment topology, and data retention
requirements before using it with real candidate data.

## Data model

Core models:

- `User`, `StudentProfile`, `RecruiterProfile`, `Company`
- `Skill`, `StudentSkill`, `SkillHistory`
- `Drive`, `EligibilityRule`, `DriveRequiredSkill`, `Round`, `Application`,
  `ApplicationRoundResult`, `Offer`
- `EligibilityOverride`, `PlacementPolicy`
- `Notification`, `AuditLog`
- `RoleProfile`, `RoleProfileSkill`, `LearningResource`, `SavedCandidate`

Key constraints and conventions:

- CUID string IDs and UTC timestamps.
- No Prisma enums, JSON columns, or scalar arrays.
- Unique student+drive application and student+skill rows.
- Unique drive+round order and drive+skill requirement rows.
- Indexes cover drive status/deadline, application status, notifications, audit entities, and
  candidate skill search.
- Users, companies, and catalog skills are deactivated rather than deleted when audit history must
  be preserved.

## Project structure

```text
prisma/
  schema.prisma
  seed.ts
  migrations/
src/
  app/
    (auth)/             login, register
    (student)/          student portal
    (officer)/          officer portal
    (recruiter)/        recruiter portal
    account/password/
    api/                auth, notifications, resumes, exports, reports
  components/
    ui/                 shadcn-style primitives
    layout/             shells, nav, notification bell
    charts/             Recharts wrappers
    reports/            report-specific controls
    shared/             headers, stats, empty states, export button
    student/ officer/ recruiter/ auth/
  lib/
    eligibility/        pure engine and gap analysis
    validation/         shared Zod schemas
    constants.ts, csv.ts, formatting.ts, reporting.ts, roles.ts, env.ts
  server/
    actions/            guarded mutations
    auth/               auth config helpers, guards, rate limit, API guards
    exports/            PDF renderer
    realtime/           in-process event hub
    services/           business logic and scoped queries
    audit.ts, db.ts, errors.ts
  auth.config.ts, auth.ts, middleware.ts
tests/e2e/              Playwright specs
docs/                   plan, decisions, progress
uploads/                private resumes (gitignored)
```

## Testing

Run the checks used for each milestone:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Current unit coverage includes:

- Eligibility engine and skill-gap calculations.
- CSV import/export helpers.
- Reporting helpers: CSV escaping, funnel conversion, heatmap intensity.
- Analytics export query validation.
- Auth, student, officer, and recruiter validation schemas.
- Realtime hub fan-out, role channels, unsubscribe, and heartbeat behavior.

Playwright is configured for Chromium and expects the app at `http://localhost:3000`. Install the
browser once with:

```bash
npx playwright install chromium
```

The `tests/e2e` directory currently has no specs; end-to-end student and officer flows are the
remaining planned work in milestone (i). Until specs are added, `npm run test:e2e` reports that no
tests were found.

## Operational limitations

- SQLite and in-memory rate limiting assume a single application instance.
- SSE connections are process-local; a multi-instance deployment needs a shared pub/sub transport.
- Uploads are stored on the local filesystem; production needs a persistent volume or object store.
- There is no email service. Recruiter onboarding uses a one-time temporary password, and officers
  reset passwords manually.
- There are no background jobs or cron tasks. Expired drives are rejected on read, and eligibility
  notifications run synchronously when a drive is activated.
- PDF exports use Helvetica and ASCII-safe output rather than full Unicode font embedding.
- The demo seed is destructive.
- No license file is included. Add one before redistributing the project.

## Troubleshooting

### App redirects repeatedly with 307 after a database reset

A JWT from the previous database can reference a deleted user or old session version. Landing,
login, and registration validate the session against the database before redirecting. If an old
browser session still causes confusion, clear the `authjs` cookies or sign in again.

### `TypeError: Cannot read properties of undefined (reading 'clientModules')`

This is usually a corrupted Next.js development cache. Stop the dev server, remove `.next`, and
restart:

```bash
rm -rf .next
npm run dev
```

### Prisma DLL `EPERM` on Windows during build

A running Next.js server can hold the Prisma query engine DLL. Stop the process listening on port
3000, then rebuild:

```bash
netstat -ano | grep ':3000'
taskkill //PID <pid> //T //F
npm run build
```

### Login rate limit reached

Rate limiting is in-memory and resets when the server restarts. Wait for
`AUTH_RATE_LIMIT_WINDOW_MINUTES`, or restart the dev server for local testing.

### Missing seeded resume or empty pages

Recreate the demo database:

```bash
npm run db:reset
```

This is destructive. Seed also resets data when run directly with `npm run seed`.

### Authentication works on localhost but not a forwarded host

Set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the public origin and restart the server. Auth.js uses
these values for callback and redirect URLs.

## Project documentation

- [`docs/PLAN.md`](docs/PLAN.md) — approved architecture, data model, routes, and milestones.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — binding implementation decisions and trade-offs.
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — milestone-by-milestone implementation and verification log.
- [`AGENTS.md`](AGENTS.md) — repository conventions and definition of done.

## Status

Milestones (a) through (h) are implemented: scaffold/auth, schema/seed, eligibility, student
experience, officer portal, recruiter portal, real-time notifications, and analytics/reports.

Milestone (i) remains: final responsive/dark/accessibility sweep, complete loading/empty/error
coverage, security review, Playwright student and officer flows, clean-clone verification, and any
remaining documentation updates.
