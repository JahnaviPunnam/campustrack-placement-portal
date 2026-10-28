# Decision Log

These decisions resolve ambiguities in the brief. They are binding for implementation.

1. **Auth.js v5 JWT sessions, no Prisma adapter.** Credentials login does not need database
   sessions. Edge middleware uses the provider-free config; bcrypt/Prisma only run in the Node
   `authorize` callback. This keeps middleware fast and edge-safe.
2. **bcryptjs instead of native bcrypt.** Same bcrypt algorithm and hash compatibility, without
   native build failures on Windows/clean clones. Cost factor 10 for seed speed, 12 at runtime.
3. **SQLite limits.** Prisma enums, `Json`, and scalar lists are not used. Statuses/roles are string
   unions validated by Zod; multi-values are CSVs; snapshots are JSON strings. Raw SQL is avoided so
   switching the provider to PostgreSQL only requires datasource/migration changes.
4. **Extra models beyond the minimum.** `RoleProfile`/`RoleProfileSkill` implement target-role gap
   analysis; `LearningResource` implements recommendations; `PlacementPolicy` makes one-offer and
   dream-offer rules configurable; `EligibilityOverride` gives auditable overrides; `SavedCandidate`
   supports recruiter talent pools.
5. **Offers are officer-recorded and accepted by default.** The brief does not define a student
   acceptance flow. Officers can mark an offer declined/revoked. Placement metrics count each
   student once using their highest accepted offer.
6. **Drive tiers:** 1 = mass, 2 = standard, 3 = dream. `PlacementPolicy.blockedPlacedTiers` defaults
   to `1,2`. A placed student may apply to a blocked tier only as a dream upgrade: dream policy on,
   new package > best accepted package + configured increase. Such applications are flagged
   `isDreamOffer` and warned, and count as an exception to `maxOffersPerStudent`.
7. **Profile verification is required by default on new drives.** This makes the officer approval
   workflow meaningful. Drives can explicitly disable the requirement. Seed marks demo/eligible
   students verified and leaves a few pending to demonstrate the queue.
8. **Withdrawn applications may reapply** before the deadline by resetting the existing row (unique
   student+drive). Rejected/offered applications are terminal. Recruiter-invited applications use
   the same row/source field.
9. **Recruiter candidate search covers verified students across the campus**, as requested. Resumes
   are readable only for verified students, only by recruiters/officers/self, and every access is
   audited. A recruiter "shortlist" for one of their drives creates an `Application` with
   `source=RECRUITER` and `status=SHORTLISTED` after the eligibility engine passes; it never bypasses
   eligibility.
10. **Recruiter onboarding uses a one-time temporary password** displayed to the officer. There is
    no email service. `mustChangePassword` forces a change. Officers can reset passwords.
11. **No background jobs/cron.** Expired drives are rejected on read and by the engine. Officers may
    close drives manually. Newly eligible notifications run synchronously on drive activation.
12. **Rate limiting is in-memory** (sliding window per IP+email) because no external services are
    allowed. It resets on restart and is single-instance only; documented in README.
13. **Analytics and reports are computed on demand** from indexed Prisma queries. Median is computed
    in TypeScript. At this data size caching is unnecessary; React server components stream results.
14. **PDF exports use pdfkit** server-side with Helvetica and CSV-safe ASCII output. No headless
    browser is required.
15. **Polling fallback is 12 seconds**, with SSE reconnect/backoff. Events carry minimal ids/types;
    clients refetch authorized data. SSE is single-process (matches SQLite/local storage).
16. **Application status model:** `APPLIED → SHORTLISTED → IN_PROCESS → OFFERED`, plus `REJECTED`
    and `WITHDRAWN`. Round results are `PENDING/SCHEDULED/PASSED/FAILED/ABSENT/WAIVED`. Passing the
    final round keeps `IN_PROCESS` until an offer is recorded; failing/absence rejects.
17. **Profile completeness formula:** phone+location 10, academics 20, resume 20, both links 10,
    at least 5 skills 25 (linear), evidence on 2 skills 10, target role 5. Total 100.
18. **Skill match formula:** weighted sum of `min(1, proficiency / minProficiency)` over all
    required skills × 100, weights clamped 1–5. No required skills = 100.
19. **CSV import is partial:** valid rows import in a transaction, invalid rows are reported with
    row numbers; existing roll numbers are updated idempotently. Exports escape spreadsheet formulas.
20. **Time and money:** all timestamps stored UTC and displayed in the server/browser locale; CGPA is
    on a 10-point scale; package is LPA as a one-decimal `Float`.
21. **Student registration** creates the account/profile and redirects to login; verification is a
    separate officer action. No email verification/password reset (no external services).
22. **Hard deletes are limited to draft drives and cascade-owned rows.** Users, companies, and
    catalog skills are deactivated instead of deleted to preserve audit history.
23. **E2E strategy:** Playwright uses the seeded dev database and role-based selectors. Unit tests
    are pure and database-free; production builds do not run tests.

24. **Session revocation uses `User.sessionVersion`.** JWT payloads carry the version at login; guards reject mismatches. Password changes/resets, recruiter deactivation, and company deactivation increment it so stale sessions stop working immediately.
25. **Inactive companies cannot act.** Recruiters from a deactivated company are blocked by `requireRecruiter`, and company deactivation increments recruiter session versions in the same transaction.
26. **Recruiter drive requests enter the officer approval queue.** Recruiters can create company-scoped requests (`source=RECRUITER`, `PENDING_APPROVAL`) but cannot publish drives. Only rejected recruiter requests are editable/resubmittable; approval remains an officer action.
27. **Recruiter ranking is explicit.** Drive selection ranks by the shared eligibility engine and match score. Without a drive, candidates rank by weighted skill coverage against selected skills; AND mode treats missing selected skills as zero, so coverage reflects the full requirement set.
28. **Real-time delivery uses one SSE stream per role area plus polling fallback.** Clients subscribe to their user channel (and role/company channels where applicable), dedupe notification IDs, and refresh server-rendered data on minimal events. Polling every 12 seconds starts only while the stream is disconnected; the bell keeps a slower 30-second safety poll.
29. **Report exports are dedicated, scoped endpoints.** Eligible-list exports are officer-only; shortlist exports allow officers or the owning recruiter's company. Both support whole-drive and per-round shortlist scopes, CSV/PDF, Zod-validated parameters, no-store responses, and audit records. CSV cells neutralize spreadsheet formulas. Placement reports continue to use the existing officer-only `/api/officer/reports/placement` route.
30. **Redirect pages validate the database session before redirecting.** Landing, login, and registration use `getCurrentUser()` rather than trusting the JWT role alone. This prevents redirect loops when a stale token survives a database reset, user deletion, deactivation, or session-version change; an invalid session renders the public page and can be replaced at the next sign-in.
