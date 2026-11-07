# Testing

Owned by: Duston

Automated unit test suite for the CSC4801 Recruiting & Candidate Matching Platform. Reaches across into `../backend/src` and `../frontend/src` by relative import (per `AGENTS.md` "Testing across folders") to exercise the team's actual business logic and UI components without calling external services or shared databases.

## Setup & Running Tests

```bash
cd testing
npm ci
npm test
```

`npm test` runs `vitest run --configLoader native src/unit src/frontend` non-interactively and exits nonzero on failure.

To run the open-bug regression suite (which asserts the expected fixed behavior for bugs reported to `frontend/` and `backend/`):

```bash
npm run test:bugs
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
| `src/frontend/xss.test.tsx` | `FP-SEC-3` | Renders `JobDetailPanel`, `JobListingCard`, `JobDetailDialog`, and `EmployerApplicantsPage` in `jsdom` with `<script>alert(1)</script>` and other XSS vectors; asserts escaped text and zero `<script>` elements |
| `src/frontend/workflows.test.tsx` | `FP-CAN-2`, `FP-CAN-3`, `FP-EMP-2`, `FP-EMP-3`, `FP-SCHED-2`, `FP-SCHED-3` | React Testing Library UI workflow tests for `CandidateBookInterviewPage` (`409 SLOT_TAKEN` race recovery), `CandidateJobsView` (search & apply), `EmployerDashboardPage` (delete guard + confirm modal), `EmployerApplicantsPage` (status confirmation dialog), `SkillsField`, and `TagsField` |
| `src/unit/static-checks.test.ts` | `FP-MATCH-1`, `FP-AUTH-2`, `FP-SEC-2`, `FP-SEC-3`, `FP-SEC-4` | Verifies single `matchScore` implementation, no unsafe raw SQL or HTML injection (`dangerouslySetInnerHTML`), no HTML-escaping on write, `.env.example` placeholder hygiene, and `JWT_SECRET` length enforcement |
| `src/unit/seed.test.ts` | `FP-ARCH-1`, `FP-DOC-3` | Verifies deterministic `seed.sql` / `reset.sql` (demo accounts, valid `password123` bcrypt hashes, 4 match examples, all 4 application statuses, 2 `Interviewing` candidates racing for a slot) and `/api/health` (`200` vs `503`) |
| `src/regression/open-bugs.test.tsx` | `FP-EMP-3`, `FP-MATCH-1`, `FP-SCHED-1`, `FP-CAN-1` | Regression tests (`npm run test:bugs`) reproducing open bugs reported to `frontend/` and `backend/`; each test asserts the expected fixed behavior and turns green once its fix lands |
