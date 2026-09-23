# API Contract

The shared interface between the frontend and the backend. The backend implements every endpoint below; the frontend calls them. Response shapes should match TypeScript types shared between both sides — by convention, kept in `frontend/src/types/index.ts` once the frontend project exists; until then this document is the source of truth for shapes. Any change to an existing route must be agreed by the team before merge (see `AGENTS.md` "Changing the API contract").

**Database:** PostgreSQL, accessed through the [Prisma](https://www.prisma.io/) ORM. See `Database_schema.md` for tables and `INSTALL.md` for setup.

## Conventions

- **Base URL:** `/api`
- **Auth:** JWT bearer token. `POST /api/auth/login` and `POST /api/auth/register` return `{ "token": string, "user": AuthUser }`. Later requests send `Authorization: Bearer <token>`. No refresh-token flow; token expiry is documented in `SPEC.md`.
- **IDs:** UUID strings.
- **Timestamps:** ISO 8601 UTC, e.g. `2026-09-23T10:00:00Z`.
- **Lists:** plain JSON arrays, no pagination envelope.
- **Error envelope:** `{ "error": { "code": string, "message": string } }` on all 4xx/5xx responses.
- **Status codes (FP-AUTH-3):** unauthenticated → `401`; wrong role/not owner → `403`; object doesn't exist (or caller shouldn't know it exists) → `404`; conflicting state change → `409`.

---

## Auth

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, display_name, role }` | `{ token, user: AuthUser }` | none; `409` on duplicate email |
| POST | `/api/auth/login` | `{ email, password }` | `{ token, user: AuthUser }` | none; `401` on wrong credentials |
| POST | `/api/auth/logout` | — | `204` | authenticated |
| GET | `/api/me` | — | `AuthUser` | authenticated |

## Profiles

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| GET | `/api/candidates/me/profile` | — | `CandidateProfile` | Candidate |
| PUT | `/api/candidates/me/profile` | `{ display_name, skills, resume_text }` | `CandidateProfile` | Candidate, owner only |
| GET | `/api/employers/me/profile` | — | `CompanyProfile` | Employer |
| PUT | `/api/employers/me/profile` | `{ company_name, description }` | `CompanyProfile` | Employer, owner only |

Resume text is readable only by its owner (FP-CAN-1). Any route that exposes another candidate's profile or resume must return `403`.

## Jobs

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| GET | `/api/jobs` | — | `ScoredJob[]`: all active jobs with the caller's `match_score` and `has_applied`, sorted desc by score, tie-break by case-insensitive title then job id | Candidate |
| POST | `/api/jobs` | `{ title, description, required_skills }` | `Job` | Employer |
| GET | `/api/jobs/mine` | — | `Job[]` (employer's own postings) | Employer |
| GET | `/api/jobs/{id}` | — | `Job` | authenticated |
| PUT | `/api/jobs/{id}` | `{ title, description, required_skills }` | `Job` | Employer, owner only |
| DELETE | `/api/jobs/{id}` | — | `204`, or `409` if applications/slots exist | Employer, owner only |

## Applications

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| POST | `/api/jobs/{id}/applications` | — | `Application` (status `Pending`) | Candidate; `409` on duplicate apply |
| GET | `/api/applications/mine` | — | `ScoredApplication[]` (caller's own applications) | Candidate |
| GET | `/api/jobs/{id}/applicants` | — | `ScoredApplication[]`, sorted desc by score, tie-break by case-insensitive candidate display_name then candidate id | Employer, job owner only |
| PUT | `/api/applications/{id}/status` | `{ status }` | `Application` | Employer, owner of the job only |

The match score (FP-MATCH-1) must be one shared implementation called by both `GET /api/jobs` and `GET /api/jobs/{id}/applicants`.

## Scheduling & Booking

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| GET | `/api/employers/me/availability` | — | `AvailabilitySlot[]` | Employer |
| POST | `/api/employers/me/availability` | `{ start_time, end_time }` | `AvailabilitySlot` | Employer; `400` on bad duration/end-before-start/past time |
| DELETE | `/api/employers/me/availability/{id}` | — | `204`, or `409` if booked | Employer, owner only |
| GET | `/api/applications/{id}/available-slots` | — | `AvailabilitySlot[]` (unbooked, future, belonging to the job's employer) | Candidate, application owner only |
| POST | `/api/applications/{id}/book` | `{ slot_id }` | `Application` (with `interview_slot_id` set) | Candidate, application owner only |

`POST /api/applications/{id}/book` must enforce all FP-SCHED-2 eligibility conditions atomically and return `409 { "error": { "code": "SLOT_TAKEN", "message": "Slot already booked" } }` when it loses a race (FP-SCHED-3).

## System

| Method | Path | Response | Auth |
|---|---|---|---|
| GET | `/api/health` | `200` when the server and database are reachable | none |

---

## Resolved decisions

1. **JWT expiry:** 24 hours. No refresh-token flow; the client must re-login after expiry.
2. **`PUT /api/jobs/{id}`:** requires the full object (`title`, `description`, `required_skills`), not a partial update. Matches `PUT` semantics (replace, not merge); the frontend edit form must always send all three fields.
3. **Skills storage:** JSON arrays (Prisma `Json` fields on PostgreSQL `jsonb` columns), not a normalized skills table. See `Database_schema.md`.
