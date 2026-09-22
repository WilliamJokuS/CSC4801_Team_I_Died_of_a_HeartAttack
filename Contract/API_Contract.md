# API Contract

Normative for all three teammates. Response shapes reference the TypeScript types already committed in `frontend/src/types/index.ts` — build endpoints to return those shapes rather than inventing new ones. Any change to a route already listed here needs a small PR the other two review before merge (see workflow discussion — this file is the shared interface).

## Ownership

| Person | Owns | Requirements covered |
|---|---|---|
| **A** | Auth, sessions, `users`/`candidate_profiles`/`company_profiles`, authorization middleware, security cross-cutting concerns | FP-AUTH-1, FP-AUTH-2, FP-AUTH-3, FP-CAN-1, FP-EMP-1, FP-SEC-1, FP-SEC-2, FP-SEC-3, FP-SEC-4 |
| **B** | `jobs`, `applications`, matching score | FP-CAN-2, FP-CAN-3, FP-EMP-2, FP-EMP-3, FP-MATCH-1, FP-MATCH-2 |
| **C** | `availability_slots`, booking, seed data, Docker/CI, `INSTALL.md`/`SPEC.md`/`README.md` mapping table | FP-SCHED-1, FP-SCHED-2, FP-SCHED-3, FP-DOC-1, FP-DOC-2, FP-DOC-3 |

Person A's authorization middleware is a shared dependency — B and C's protected routes call it rather than reimplementing role/ownership checks. Land that early; it blocks the other two.

## Conventions

- **Base URL:** `/api`
- **Auth:** JWT bearer token. `POST /api/auth/login` and `POST /api/auth/register` return `{ "token": string, "user": AuthUser }`. Subsequent requests send `Authorization: Bearer <token>`. No refresh-token flow in scope; token expiry documented in `SPEC.md`.
- **IDs:** UUID strings, matches `id: string` fields in `frontend/src/types/index.ts`.
- **Timestamps:** ISO 8601 UTC, e.g. `2026-09-23T10:00:00Z`.
- **Lists:** plain JSON arrays, no pagination envelope (matches existing mock data shape).
- **Error envelope:** `{ "error": { "code": string, "message": string } }` on all 4xx/5xx responses.
- **Status codes (FP-AUTH-3):** unauthenticated → `401`; wrong role/not owner → `403`; object doesn't exist (or caller shouldn't know it exists) → `404`; conflicting state change → `409`.

---

## Person A — Auth, Accounts, Profiles

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, display_name, role }` | `{ token, user: AuthUser }` | none |
| POST | `/api/auth/login` | `{ email, password }` | `{ token, user: AuthUser }` | none |
| POST | `/api/auth/logout` | — | `204` | authenticated |
| GET | `/api/me` | — | `AuthUser` | authenticated |
| GET | `/api/candidates/me/profile` | — | `CandidateProfile` | Candidate |
| PUT | `/api/candidates/me/profile` | `{ display_name, skills, resume_text }` | `CandidateProfile` | Candidate, owner only |
| GET | `/api/employers/me/profile` | — | `CompanyProfile` | Employer |
| PUT | `/api/employers/me/profile` | `{ company_name, description }` | `CompanyProfile` | Employer, owner only |

Error cases to cover: duplicate email on register (`409`), wrong password on login (`401`), reading another candidate's profile by ID if such a route is ever exposed (`403`) — FP-CAN-1 requires resume text be readable only by its owner.

---

## Person B — Jobs, Applications, Matching

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| GET | `/api/jobs` | — | `ScoredJob[]` (candidate: all active jobs w/ own match_score + has_applied, sorted desc by score, tie-break by case-insensitive title then job id) | Candidate |
| POST | `/api/jobs` | `{ title, description, required_skills }` | `Job` | Employer |
| GET | `/api/jobs/mine` | — | `Job[]` (employer's own postings) | Employer |
| GET | `/api/jobs/{id}` | — | `Job` | authenticated |
| PUT | `/api/jobs/{id}` | `{ title, description, required_skills }` | `Job` | Employer, owner only |
| DELETE | `/api/jobs/{id}` | — | `204`, or `409` if applications/slots exist | Employer, owner only |
| POST | `/api/jobs/{id}/applications` | — | `Application` (status `Pending`) | Candidate; `409` on duplicate apply |
| GET | `/api/applications/mine` | — | `ScoredApplication[]` (candidate's own applications) | Candidate |
| GET | `/api/jobs/{id}/applicants` | — | `ScoredApplication[]` (sorted desc by score, tie-break by case-insensitive candidate display_name then candidate id) | Employer, job owner only |
| PUT | `/api/applications/{id}/status` | `{ status }` | `Application` | Employer, owner of the job only |

Matching function (FP-MATCH-1) must be one shared implementation called by both `GET /api/jobs` and `GET /api/jobs/{id}/applicants` — do not duplicate the scoring logic per endpoint.

---

## Person C — Scheduling & Booking

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| GET | `/api/employers/me/availability` | — | `AvailabilitySlot[]` | Employer |
| POST | `/api/employers/me/availability` | `{ start_time, end_time }` | `AvailabilitySlot` | Employer; `400` on bad duration/end-before-start |
| DELETE | `/api/employers/me/availability/{id}` | — | `204`, or `409` if `is_booked` | Employer, owner only |
| GET | `/api/applications/{id}/available-slots` | — | `AvailabilitySlot[]` (unbooked, future, belonging to the job's employer) | Candidate, application owner only |
| POST | `/api/applications/{id}/book` | `{ slot_id }` | `Application` (with `interview_slot_id` set) | Candidate, application owner only |

`POST /api/applications/{id}/book` must enforce, atomically, all of FP-SCHED-2's eligibility conditions and return `409 { error: { code: "SLOT_TAKEN", message: "Slot already booked" } }` on a lost race, per FP-SCHED-3.

---

## Cross-cutting: seeded/system

| Method | Path | Owner |
|---|---|---|
| GET | `/api/health` | Person C (Docker/CI needs a liveness check) |

---

## Open items to resolve before coding starts

1. JWT expiry duration — pick a number, document it in `SPEC.md`.
2. Whether `PUT /api/jobs/{id}` allows partial updates or requires the full object — pick one, document it.
3. Confirm `required_skills`/`skills` are stored as JSON arrays vs. a normalized skills table — schema currently assumes JSON arrays (simpler, sufficient for the FP-MATCH-1 formula).
