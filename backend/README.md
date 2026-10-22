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
| 409 | `NOT_INTERVIEWING` | Book while the application isn't `Interviewing` |
| 409 | `ALREADY_BOOKED` | Book when the application already has a slot |
| 409 | `SLOT_TAKEN` | Book a slot that's already booked (message `Slot already booked`) |
| 409 | `SLOT_IN_PAST` | Book a slot whose start time has passed |

Response shapes: `../specs/002-profile-and-job-shapes.md` (profiles, jobs), `../specs/003-application-and-scheduling-shapes.md` (applications, scheduling), and `../specs/004-job-tags-and-ui-fields.md` (job `tags` and `company_description`, `applicant_count` on `GET /api/jobs/mine`, `booking` on `GET /api/employers/me/availability`).

## Booking transaction (FP-SCHED-3)

`bookSlot` runs in one transaction: lock the application row, then the slot row (`FOR UPDATE`, always in that order), check eligibility, then claim the slot with a conditional `UPDATE availability_slots SET is_booked = true WHERE id = ? AND is_booked = false AND start_time > now`. Two racing candidates serialize on the slot's row lock; the second reads the slot after the first commits and gets `409 SLOT_TAKEN`. `applications.interview_slot_id UNIQUE` backs this up (a duplicate link is also mapped to `409`). Any failure rolls back both rows.

## Demo data

`npx prisma db seed` (or `npm run db:seed`) resets and seeds; `npm run db:reset` only empties the tables. Local/demo credentials, password `password123` for all: candidates `alice@`, `bob@`, `chen@`, `diana@`, `ethan@`, `fatima@`, `gabriel@`, `hannah@`, `ivan@`, `julia@demo.test`; employers `hr@acme.demo.test`, `hr@northwind.demo.test`, `hr@harbor.demo.test`.
