# Testing

Owned by: Duston

Automated unit test suite for the CSC4801 Recruiting & Candidate Matching Platform. Reaches across into `../backend/src` and `../frontend/src` by relative import (per `AGENTS.md` "Testing across folders") to exercise the team's actual business logic and UI components without calling external services or shared databases.

## Setup & Running Tests

On a clean checkout, also install dependencies in `backend/` and `frontend/` (`npm ci` in each), since this suite imports `../backend/src` and `../frontend/src` directly and `test:live` invokes Prisma from `backend/node_modules`.

```bash
cd testing
npm ci
npm test
```

`npm test` runs `vitest run --configLoader runner src/unit src/frontend` non-interactively and exits nonzero on failure.

To run the bug regression suite (which asserts the expected fixed behavior for bugs reported to `frontend/` and `backend/` — failing while open and turning green once fixed):

```bash
npm run test:bugs
```

### Live PostgreSQL Concurrency Suite

The concurrency regression suite runs separately from `npm test` against a real, disposable PostgreSQL database with all Prisma migrations applied (including the `availability_slots_no_overlap` GiST exclusion constraint). It tests real row locks, exclusion-constraint waits/rollbacks, and transaction serialization using separate `pg` connections, synchronization barriers, and bounded `pg_blocking_pids` polling.

1. Start a local PostgreSQL instance (for example, the development Compose database, which creates `recruiting_test`):

   ```bash
   docker compose -f backend/docker-compose.dev.yml up -d
   ```

2. Set `TEST_DATABASE_URL` to a disposable database and run the live suite from `testing/`. The role must be able to create temporary test databases. Prisma migrations are applied automatically.

   ```bash
   cd testing
   TEST_DATABASE_URL=postgres://app:app@127.0.0.1:5432/recruiting_test npm run test:live
   ```

   On Windows PowerShell:

   ```powershell
   cd testing
   $env:TEST_DATABASE_URL = "postgres://app:app@127.0.0.1:5432/recruiting_test"
   npm run test:live
   ```

## Test Files

| File | Requirements Covered | What It Tests |
|---|---|---|
| `src/unit/matching.test.ts` | `FP-MATCH-1` | `matchScore` (all 4 required examples, floor formula, trimming/lowercasing/deduping, empty handling) and both tie-breaking comparators (`compareScoredJobs`, `compareApplicants`) |
| `src/unit/scheduling.test.ts` | `FP-SCHED-1`, `FP-SCHED-2`, `FP-SCHED-3`, `FP-SEC-1` | 30-minute slot validation (`validateSlotTimes`), slot creation/deletion (`SLOT_BOOKED`), available-slot filtering, booking eligibility (`bookingError`, `bookSlot`), and concurrent race/rollback handling (`409 Slot already booked`) |
| `src/unit/auth.test.ts` | `FP-AUTH-1`, `FP-AUTH-2`, `FP-AUTH-3` | Registration, unique email (`409 EMAIL_TAKEN`), bcrypt cost-12 hashing, random salt, no secrets returned, login/logout, and JWT verification (`401` on missing/expired/tampered/alg:none tokens) |
| `src/unit/authorization.test.ts` | `FP-AUTH-3`, `FP-SEC-1` | `401` unauthenticated on every protected route, `403` wrong role on every role-restricted route, `404` missing/non-UUID objects, and all 3 `FP-SEC-1` cross-user object-access boundaries |
| `src/unit/candidate.test.ts` | `FP-CAN-1`, `FP-CAN-2`, `FP-CAN-3` | Candidate profile & private resume persistence/replacement, scored & sorted job recommendations dashboard, single application (`409 ALREADY_APPLIED`), and own application listing |
| `src/unit/employer.test.ts` | `FP-EMP-1`, `FP-EMP-2`, `FP-EMP-3`, `FP-MATCH-1` | Company profile CRUD, job CRUD, `409 JOB_HAS_DEPENDENTS` when deleting a job with applications, applicant list sorted by match score, candidate/employer score parity, and status transitions |
| `src/unit/sql-injection.test.ts` | `FP-SEC-2` | SQL metacharacter payloads (`'; DROP TABLE users; --`, `' OR '1'='1`, etc.) across profile, company, job, auth, and path/body IDs; verifies all values remain bound parameters |
| `src/unit/input-fuzzing.test.ts` | `FP-AUTH-1`, `FP-CAN-1`, `FP-EMP-1`, `FP-EMP-2`, `FP-SCHED-1` | JSON primitive/array/null/prototype-pollution body fuzzing across all 9 `POST`/`PUT` routes, plus exact character/count boundary tests |
| `src/frontend/xss.test.tsx` | `FP-SEC-3` | Renders `JobDetailPanel`, `JobListingCard`, `JobDetailDialog`, `EmployerApplicantsPage`, `CandidateProfilePage` (profile & resume), `CandidateApplicationsPage`, `EmployerAvailabilityPage`, and `CandidateJobsView` (search text) in `jsdom` with `<script>alert(1)</script>` and other XSS vectors; asserts escaped text and zero `<script>` elements |
| `src/frontend/workflows.test.tsx` | `FP-CAN-2`, `FP-CAN-3`, `FP-EMP-2`, `FP-EMP-3`, `FP-SCHED-2`, `FP-SCHED-3` | React Testing Library UI workflow tests for `CandidateBookInterviewPage` (slot reload on `409 SLOT_TAKEN`), `CandidateJobsView` (search & apply), `EmployerDashboardPage` (delete guard + confirm modal), `EmployerApplicantsPage` (status confirmation dialog), `SkillsField`, and `TagsField` |
| `src/frontend/auth-and-routing.test.tsx` | `FP-AUTH-1`, `FP-AUTH-2`, `FP-AUTH-3`, `FP-SEC-1` | Tests `AuthProvider`, `AuthPage` (client validation, register/login, `409 EMAIL_TAKEN`, `401 INVALID_CREDENTIALS`, no token in DOM), `ProtectedRoute` (unauthenticated `/login` redirect & cross-role guards), logout + `401 UNAUTHORIZED` auto-logout, `api/client.ts`, `safeReturnPath`, `apiErrorMessage`, `NotFoundPage`, and `ErrorBoundary` |
| `src/frontend/pages-coverage.test.tsx` | `FP-CAN-1`, `FP-CAN-2`, `FP-CAN-3`, `FP-EMP-1`, `FP-EMP-2`, `FP-EMP-3`, `FP-SCHED-1`, `FP-SCHED-2` | Full page workflow tests for `CandidateProfilePage`, `CandidateJobsView`, `CandidateApplicationsPage`, `CandidateBookInterviewPage`, `CandidateOverviewPage`, `EmployerProfilePage`, `EmployerJobFormPage` (create/edit/full PUT tags/ownership guard), `EmployerDashboardPage` (`409 JOB_HAS_DEPENDENTS`), `EmployerApplicantsPage`, and `EmployerAvailabilityPage` (create, `409 SLOT_OVERLAP`, booked delete guard, delete) |
| `src/unit/static-checks.test.ts` | `FP-MATCH-1`, `FP-AUTH-2`, `FP-SEC-2`, `FP-SEC-3`, `FP-SEC-4` | Verifies single `matchScore` implementation, no unsafe raw SQL or HTML injection (`dangerouslySetInnerHTML`), no HTML-escaping on write, `.env.example` placeholder hygiene, and `JWT_SECRET` length enforcement |
| `src/unit/seed.test.ts` | `FP-ARCH-1`, `FP-DOC-3` | Verifies deterministic `seed.sql` / `reset.sql` (demo accounts, valid `password123` bcrypt hashes, 4 match examples, all 4 application statuses, 2 `Interviewing` candidates racing for a slot) and `/api/health` (`200` vs `503`) |
| `src/unit/auth-limits.test.ts` | `FP-AUTH-1` | Verifies shared per-IP auth rate limiting (`429 AUTH_RATE_LIMITED` across login/register without affecting `/api/health`) and concurrent auth cap (`503 AUTH_BUSY` with capacity release) |
| `src/unit/dependency-versions.test.ts` | `FP-ARCH-1`, `FP-SUB-1` | Verifies patched runtime versions of `body-parser` (`>= 2.4`) and `zod` (`>= 4.6.6`) in `backend/` |
| `src/frontend/availability.test.tsx` | `FP-SCHED-1` | Tests DST nonexistent wall-time rejection, fall-back repeated wall-time offset selection, partial/cleared time edits (`BUG-FE-7`), and `crypto.randomUUID`-unavailable fallback in `EmployerAvailabilityPage` |
| `src/frontend/profile-saves.test.tsx` | `FP-CAN-1`, `FP-EMP-1` | Ensures candidate and employer profiles load before allowing replacement saves and disable draft inputs while saving |
| `src/frontend/session.test.tsx` | `FP-AUTH-1`, `FP-CAN-1` | Tests cross-tab session switching/logout, in-flight `SESSION_CHANGED` cancellation, immediate local logout cleanup, post-login `returnPath` (`BUG-FE-3`), avatar initials sync (`BUG-FE-10`), blocked-storage fallback, and 8-byte Unicode passwords |
| `src/regression/open-bugs.test.tsx` | Audit regressions | Frontend, backend, and repository checks from the audit |
| `src/live-pg/concurrency.live.test.ts` | `FP-SCHED-1`, `FP-SCHED-2`, `FP-EMP-2` | Live PostgreSQL concurrency regression suite (`npm run test:live`, commit `db6a0f1`): booking lock-wait past start time (`409 SLOT_IN_PAST`), blocked slot creation past start time (`400 VALIDATION_ERROR`), concurrent vs sequential overlapping slot inserts (`201` / `409 SLOT_OVERLAP`), simultaneous job edits serialization, and simultaneous job deletes locked recheck (`204` / `404 NOT_FOUND`) |
| `src/live-pg/database-deadlines.live.test.ts` | `FP-ARCH-1`, `FP-SCHED-3` | Bounded health, booking, and deletion responses during connection and lock stalls |
| `src/live-pg/seed-and-migrations.test.ts` | `FP-DOC-3`, `FP-SCHED-3` | Atomic reseeding, legacy overlap cleanup, and the seeded booking race |
