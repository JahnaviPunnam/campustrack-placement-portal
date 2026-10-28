# AGENTS.md

## Project
Student Skill Tracker & Placement Portal: Next.js 14 App Router + TypeScript (strict), Prisma +
SQLite, Auth.js credentials, Tailwind + shadcn/ui, Zod, Recharts, SSE with polling fallback.

## Commands
```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev            # http://localhost:3000
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run test:e2e
npm run build
npm run db:reset       # destructive, re-seeds
```

## Demo accounts
- `officer@campus.test` / `Officer@123`
- `student@campus.test` / `Student@123`
- `recruiter@campus.test` / `Recruiter@123`

## Conventions
- Server-first: server components query services directly. Client components only for interaction,
  charts, and real-time UI.
- Mutations live in `src/server/actions/*` and must start with a guard from
  `src/server/auth/guards.ts`, then Zod-parse input, then call a service.
- Every service query that touches role-scoped data must scope by the actor (student id, company id,
  officer role). Never trust IDs from the client.
- Page middleware RBAC is advisory; every action/route re-checks authorization.
- No Prisma enums, arrays, or Json columns. Use `src/lib/constants.ts` unions + Zod and CSV helpers.
- Keep `src/lib/eligibility/*` pure: no Prisma, Next.js, env, fs, or network imports.
- Dates are stored UTC; use `src/lib/formatting.ts` for display.
- Validate all inputs with shared Zod schemas. Return typed `ActionResult`s; never leak stack traces.
- Files: resumes under `UPLOAD_DIR` outside `public`, 5 MB, PDF magic bytes, random filenames.
- Use `audit()` for privileged actions and sanitize secrets from snapshots.
- Notifications are persisted first, then published via the realtime hub. Deduplicate.
- Add/update tests for eligibility, CSV, and critical guards. Do not weaken RBAC to make a test pass.
- No TODO comments, placeholder data, or unimplemented endpoints.

## Structure
- `src/app/(student|officer|recruiter)` role areas; `src/app/api` route handlers.
- `src/server/services` business logic; `src/server/actions` mutations; `src/lib/validation` schemas.
- `src/components/ui` shadcn primitives; `src/components/charts` Recharts.

## Definition of done
Typecheck, lint, unit tests, and production build pass. Features work end to end with seeded data.
Secrets stay in `.env`; examples go in `.env.example`. Update `docs/PROGRESS.md` and commit each
milestone.
