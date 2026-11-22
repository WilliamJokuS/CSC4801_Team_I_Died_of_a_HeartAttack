# Backend

Owned by: William

Node.js + TypeScript REST API under `/api` (Express 5, Prisma 7 on PostgreSQL). Implements `../Contract/API_Contract.md`.

## Setup

```bash
cd backend
npm ci                                            # also runs `prisma generate`
cp .env.example .env                              # placeholders; set a real JWT_SECRET locally
docker compose -f docker-compose.dev.yml up -d    # local Postgres (recruiting + recruiting_test)
npm run migrate:dev                               # apply / create migrations
npm run dev                                       # http://localhost:8080/api
```

## Layout

| Path | Purpose |
|---|---|
| `prisma/schema.prisma` | Database schema (mirrors `Contract/Database_schema.md`) |
| `src/app.ts` | `createApp(deps)` — builds the Express app without listening, so tests can inject a test-DB Prisma client and JWT secret |
| `src/server.ts` | Entry point: reads config, starts the listener |
| `src/auth/` | Password hashing, JWT sign/verify, register/login/me service |
| `src/middleware/auth.ts` | `requireAuth(secret)` → 401, `requireRole(...roles)` → 403 |
| `src/lib/errors.ts` | `HttpError` + helpers; renders the `{ error: { code, message } }` envelope |
| `src/profiles/service.ts` | Candidate and company profiles (always the caller's own, via `/me`) |
| `src/jobs/service.ts` | Job create/list/get/update/delete, ownership checks, soft delete |
| `src/lib/skills.ts` | Skill normalization (trim, lowercase, drop empties, dedupe), shared with matching; job-tag normalization (case kept) |
| `src/matching/index.ts` | FP-MATCH-1 `matchScore` and both tie-break comparators — the only implementation, used by `GET /api/jobs` and the applicant list |
| `src/applications/service.ts` | Scored job list, apply, own applications, applicant list, status changes |
| `src/scheduling/service.ts` | Availability slots and atomic booking (FP-SCHED-1..3); `validateSlotTimes` and `bookingError` are pure for unit tests |
| `prisma/sql/`, `prisma/seed.ts` | `reset.sql` / `seed.sql` demo data; `npx prisma db seed` runs both |
| `src/lib/params.ts` | `parseId` — a non-UUID path id is `404` |
| `src/routes/` | One router per contract section |

## Auth design

- Passwords: bcrypt, cost 12, random salt per hash. Passwords over 72 bytes are rejected rather than silently truncated.
- Emails are trimmed and lowercased before storage/lookup; uniqueness is enforced by the `users.email` UNIQUE constraint (`409 EMAIL_TAKEN`).
- Tokens: HS256 JWT, `sub` = user id, `role` claim, expiry `JWT_EXPIRES_IN` (24h). No refresh tokens.
- Logout is stateless: `POST /api/auth/logout` returns `204` and the client discards the token.
- Login returns the same `401 INVALID_CREDENTIALS` for an unknown email and a wrong password, and runs a bcrypt compare in both cases, so neither the response nor its timing reveals which emails are registered.
- Registration creates the matching `candidate_profiles` / `company_profiles` row in the same insert. An employer's `company_name` starts as their `display_name`.
- Protected routes: `router.get(path, requireAuth(secret), requireRole('Employer'), handler)`. Ownership checks (403 vs 404) belong in each service.

### `AuthUser`

```ts
{ id: string; email: string; role: 'Candidate' | 'Employer'; display_name: string; created_at: string }
```

### Error codes

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body fails validation |
| 400 | `INVALID_JSON` | Malformed JSON body |
| 401 | `UNAUTHORIZED` | Missing / invalid / expired token |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `FORBIDDEN` | Wrong role or not the owner |
| 404 | `NOT_FOUND` | Object or route doesn't exist |
| 409 | `EMAIL_TAKEN` | Register with an existing email |
| 409 | `JOB_HAS_DEPENDENTS` | Delete a job that has applications |
| 409 | `ALREADY_APPLIED` | Second application to the same job |
| 409 | `SLOT_BOOKED` | Delete a booked slot |
| 409 | `SLOT_OVERLAP` | Create a slot overlapping one of the employer's own slots (DB exclusion constraint `availability_slots_no_overlap`) |
| 409 | `NOT_INTERVIEWING` | Book while the application isn't `Interviewing` |
| 409 | `ALREADY_BOOKED` | Book when the application already has a slot |
| 409 | `SLOT_TAKEN` | Book a slot that's already booked (message `Slot already booked`) |
| 409 | `SLOT_IN_PAST` | Book a slot whose start time has passed |

Response shapes: `../specs/002-profile-and-job-shapes.md` (profiles, jobs), `../specs/003-application-and-scheduling-shapes.md` (applications, scheduling), and `../specs/004-job-tags-and-ui-fields.md` (job `tags` and `company_description`, `applicant_count` on `GET /api/jobs/mine`, `booking` on `GET /api/employers/me/availability`).

## Booking transaction (FP-SCHED-3)

`bookSlot` runs in one transaction: lock the application row, then the slot row (`FOR UPDATE`, always in that order), check eligibility, then claim the slot with a conditional `UPDATE availability_slots SET is_booked = true WHERE id = ? AND is_booked = false AND start_time > now`. Two racing candidates serialize on the slot's row lock; the second reads the slot after the first commits and gets `409 SLOT_TAKEN`. `applications.interview_slot_id UNIQUE` backs this up (a duplicate link is also mapped to `409`). Any failure rolls back both rows.

## Backend repair validation

Use the contract to write the expected API result and database state before changing the code. Reproduce the failure on an isolated database, keep the smallest failing scenario, and rerun it after the patch. For lock races, use separate connections and confirm the request is waiting (for example, with `pg_blocking_pids`) before releasing the blocker. Check the affected rows as well as the response.

### Evidence from the recent fixes

| Requirement and scenario | Before the fix | Verified after the fix |
|---|---|---|
| FP-SCHED-2. Hold the slot row lock until an in-flight booking's start time passes, then release it. | The booking succeeded. | `409 SLOT_IN_PAST`. The slot remains unbooked and the application remains unlinked. |
| FP-SCHED-1. Insert an overlapping slot in a separate uncommitted transaction. Start another slot creation, wait for it to block, then roll back the blocker after the start time. | The waiting insert created a past slot. | `400 VALIDATION_ERROR`. No slot from either transaction is stored. |
| FP-SCHED-1. Let two same-employer requests pass the overlap pre-check before either inserts. | The old schema permitted both rows. | One `201` and one `409 SLOT_OVERLAP`. Exactly one slot is stored. Back-to-back slots and the same time for a different employer remain valid. |
| FP-EMP-2. Pause the first edit after its write, then start a second edit on the same job. | The first call returned the second edit's values. | The second writer waits for the first transaction. Each edit returns its own values, and the second edit is the stored result. |
| FP-EMP-2. Let two deletes both read the job as active before either takes the write lock. | Both deletes reported success. | One succeeds and one returns `404 NOT_FOUND`. The job is soft-deleted once. |
| FP-AUTH-3. Log in, delete the account in the test database, then reuse the token for a profile update. | The profile write reached Prisma and returned a server error. | `401 UNAUTHORIZED`. The write is rejected before reaching the profile service. |
| FP-CAN-1 / FP-EMP-2. Submit a whitespace-padded 50-character skill and case-insensitive duplicate skills. | Validation counted the raw characters and items. | The validator normalizes first, then applies both limits. The API stores the normalized skills. |

The concurrency checks above used standalone reproduction scripts against PostgreSQL 18.6. The existing `BUG-BE` tests cover duplicate slot creation, stale tokens, and skill normalization with a fake database. Use real PostgreSQL to verify lock waits, transaction rollback, and the exclusion constraint.

### Rerun the automated checks

From the repository root, after installing the backend and testing dependencies:

```bash
npm --prefix backend run typecheck
cd testing
node node_modules/vitest/vitest.mjs run --configLoader runner src/unit src/frontend
node node_modules/vitest/vitest.mjs run --configLoader runner src/regression -t BUG-BE
```

For live checks, use a disposable `recruiting_test` database. With the development Compose database running, run the following from `backend/`. The seed command resets the selected database.

```bash
export DATABASE_URL=postgres://app:app@127.0.0.1:5432/recruiting_test
npm run migrate
npm run db:seed
```

The overlap migration was verified on a clean schema by applying its SQL in order with the other migrations. On an existing schema, overlapping rows can prevent it from applying (`23P01`). Check existing slots before deployment and preserve linked bookings when resolving overlaps.

## Demo data

`npx prisma db seed` (or `npm run db:seed`) resets and seeds; `npm run db:reset` only empties the tables. Local/demo credentials, password `password123` for all: candidates `alice@`, `bob@`, `chen@`, `diana@`, `ethan@`, `fatima@`, `gabriel@`, `hannah@`, `ivan@`, `julia@demo.test`; employers `hr@acme.demo.test`, `hr@northwind.demo.test`, `hr@harbor.demo.test`.
