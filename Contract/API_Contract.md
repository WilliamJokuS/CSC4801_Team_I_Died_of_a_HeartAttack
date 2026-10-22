# API Contract

The shared interface between the frontend and the backend. The backend implements every endpoint below; the frontend calls them. Response shapes should match TypeScript types shared between both sides — by convention, kept in `frontend/src/types/index.ts` once the frontend project exists; until then this document is the source of truth for shapes. Any change to an existing route must be agreed by the team before merge (see `AGENTS.md` "Changing the API contract").

> **Status:** includes [specs/001](../specs/001-authuser-shape.md), [002](../specs/002-profile-and-job-shapes.md), [003](../specs/003-application-and-scheduling-shapes.md), and [004](../specs/004-job-tags-and-ui-fields.md), agreed by all three members on 2026-10-23. The specs keep the reasoning behind each decision.

**Database:** PostgreSQL, accessed through the [Prisma](https://www.prisma.io/) ORM. See `Database_schema.md` for tables and `INSTALL.md` for setup.

## Conventions

- **Base URL:** `/api`
- **Auth:** JWT bearer token. `POST /api/auth/login` and `POST /api/auth/register` return `{ "token": string, "user": AuthUser }`. Later requests send `Authorization: Bearer <token>`. No refresh-token flow; token expiry is documented in `SPEC.md`.
- **IDs:** UUID strings. A path id that isn't a UUID is `404`.
- **Timestamps:** ISO 8601 UTC, e.g. `2026-09-23T10:00:00Z`. Timestamps sent by the client must include `Z` or an explicit offset.
- **Lists:** plain JSON arrays, no pagination envelope.
- **Error envelope:** `{ "error": { "code": string, "message": string } }` on all 4xx/5xx responses. Codes are listed in [Error codes](#error-codes).
- **Status codes (FP-AUTH-3):** unauthenticated → `401`; wrong role/not owner → `403`; object doesn't exist (or caller shouldn't know it exists) → `404`; conflicting state change → `409`. Where both apply, `404` is checked before `403`: a missing object is `404` for everyone, and an existing object owned by someone else is `403`.
- **`PUT` bodies are full replacements:** every field is required unless marked optional, and an omitted optional field is reset to its default.

---

## Types

```ts
type Role = 'Candidate' | 'Employer';
type ApplicationStatus = 'Pending' | 'Interviewing' | 'Rejected' | 'Accepted';

/** Never includes password_hash or any other credential (FP-AUTH-2). */
interface AuthUser {
  id: string;
  email: string;                 // trimmed + lowercased on register/login
  role: Role;
  display_name: string;
  created_at: string;
}

interface CandidateProfile {
  user_id: string;
  display_name: string;          // same value as AuthUser.display_name
  skills: string[];              // normalized: trimmed, lowercase, no empties, no duplicates
  resume_text: string;           // private to the owning candidate (FP-CAN-1)
}

interface CompanyProfile {
  user_id: string;
  company_name: string;
  description: string;
}

interface Job {
  id: string;
  employer_id: string;
  company_name: string;          // from the employer's company profile (FP-CAN-2)
  company_description: string;   // from the employer's company profile ('' if unset)
  title: string;
  description: string;
  required_skills: string[];     // normalized like skills; may be empty
  tags: string[];                // display labels; case kept; never an input to matching
  created_at: string;
}

/** GET /api/jobs/mine only. */
interface EmployerJob extends Job {
  applicant_count: number;       // > 0 exactly when DELETE /api/jobs/{id} returns 409
}

/** GET /api/jobs row. */
interface ScoredJob extends Job {
  match_score: number;           // 0–100 for the calling candidate (FP-MATCH-1)
  has_applied: boolean;
}

interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  created_at: string;
  interview_slot_id: string | null;
}

/** Row of GET /api/applications/mine and GET /api/jobs/{id}/applicants. Never carries resume text. */
interface ScoredApplication extends Application {
  match_score: number;
  job: { id: string; title: string; company_name: string };
  candidate: { id: string; display_name: string; skills: string[] };
  interview_slot: AvailabilitySlot | null;
}

interface AvailabilitySlot {
  id: string;
  employer_id: string;
  start_time: string;            // ISO 8601 UTC
  end_time: string;              // always start_time + 30 minutes
  is_booked: boolean;
}

/** GET /api/employers/me/availability only. Never includes the candidate's email, skills, or resume. */
interface EmployerSlot extends AvailabilitySlot {
  booking: {
    application_id: string;
    job_id: string;
    job_title: string;
    candidate_id: string;
    candidate_display_name: string;
  } | null;                      // null when the slot isn't booked
}
```

### Validation

Failures return `400 VALIDATION_ERROR`, with the offending field named in `message`.

| Field | Rule |
|---|---|
| `email` | valid email; stored trimmed and lowercased |
| `password` | 8–72 bytes |
| `display_name` | non-empty after trim, ≤ 100 chars (stored trimmed) |
| `role` | `Candidate` or `Employer` |
| `skills`, `required_skills` | array of strings, ≤ 50 items, each ≤ 50 chars; normalized before storing, so `[" Python", "python", ""]` is stored and returned as `["python"]` |
| `tags` | optional, default `[]`; array of strings, ≤ 10 after normalization, each ≤ 30 chars after trim; trimmed, empties dropped, duplicates removed case-insensitively keeping the first spelling, so `[" Remote", "remote", "Full-time"]` → `["Remote", "Full-time"]` |
| `resume_text` | string, ≤ 20,000 chars, may be empty |
| `company_name` | non-empty after trim, ≤ 200 chars |
| `description` (company) | string, ≤ 5,000 chars, may be empty |
| `title` | non-empty after trim, ≤ 200 chars |
| `description` (job) | non-empty after trim, ≤ 10,000 chars |
| `status` | one of the four `ApplicationStatus` values |
| `start_time`, `end_time` | ISO 8601 with `Z` or an offset; `end_time` after `start_time`, exactly 30 minutes later; `start_time` in the future |
| `slot_id` | UUID |

Request bodies are limited to 100 kB (`413 PAYLOAD_TOO_LARGE`).

---

## Auth

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, display_name, role }` | `201 { token, user: AuthUser }` | none; `400`, `409 EMAIL_TAKEN` |
| POST | `/api/auth/login` | `{ email, password }` | `200 { token, user: AuthUser }` | none; `400`, `401 INVALID_CREDENTIALS` (same code and message for unknown email and wrong password) |
| POST | `/api/auth/logout` | — | `204` | authenticated; `401` |
| GET | `/api/me` | — | `200 AuthUser` | authenticated; `401` (missing, invalid, or expired token) |

Logout is stateless: the server does not revoke the JWT, and the client discards the token. Registration creates the matching candidate or company profile; an employer's `company_name` starts as their `display_name`.

## Profiles

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| GET | `/api/candidates/me/profile` | — | `200 CandidateProfile` | Candidate; `401`, `403` |
| PUT | `/api/candidates/me/profile` | `{ display_name, skills, resume_text }` | `200 CandidateProfile` | Candidate, owner only; `400`, `401`, `403` |
| GET | `/api/employers/me/profile` | — | `200 CompanyProfile` | Employer; `401`, `403` |
| PUT | `/api/employers/me/profile` | `{ company_name, description }` | `200 CompanyProfile` | Employer, owner only; `400`, `401`, `403` |

Resume text is readable only by its owner (FP-CAN-1). Profile routes only act on the caller (`/me`), so no request can name another user's profile or resume. Any route that exposes another candidate's profile or resume must return `403`.

## Jobs

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| GET | `/api/jobs` | — | `200 ScoredJob[]`: all active jobs with the caller's `match_score` and `has_applied`, sorted desc by score, tie-break by case-insensitive title then job id | Candidate; `401`, `403` |
| POST | `/api/jobs` | `{ title, description, required_skills, tags? }` | `201 Job` | Employer; `400`, `401`, `403` |
| GET | `/api/jobs/mine` | — | `200 EmployerJob[]` (employer's own postings, newest first) | Employer; `401`, `403` |
| GET | `/api/jobs/{id}` | — | `200 Job` | authenticated; `401`, `404` (missing or deleted) |
| PUT | `/api/jobs/{id}` | `{ title, description, required_skills, tags? }` | `200 Job` | Employer, owner only; `400`, `401`, `403`, `404` |
| DELETE | `/api/jobs/{id}` | — | `204`, or `409 JOB_HAS_DEPENDENTS` if the job has applications | Employer, owner only; `401`, `403`, `404` |

A `PUT` without `tags` clears the job's tags (full replacement), so edit forms must always send them. Tags never affect the match score or ordering; filtering by tag is done client-side over the sorted `GET /api/jobs` result.

Deletion is a soft delete (`is_active = false`); a deleted job is `404` on every route and no longer listed. Interview slots belong to an employer, not a job; the only way a slot depends on a job is through an application's booking, so "has applications" covers both kinds of dependent record in FP-EMP-2.

## Applications

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| POST | `/api/jobs/{id}/applications` | — | `201 Application` (status `Pending`) | Candidate; `401`, `403`, `404` (missing or deleted job), `409 ALREADY_APPLIED` |
| GET | `/api/applications/mine` | — | `200 ScoredApplication[]` (caller's own applications, newest first) | Candidate; `401`, `403` |
| GET | `/api/jobs/{id}/applicants` | — | `200 ScoredApplication[]`, sorted desc by score, tie-break by case-insensitive candidate display_name then candidate id | Employer, job owner only; `401`, `403`, `404` |
| PUT | `/api/applications/{id}/status` | `{ status }` | `200 Application` | Employer, owner of the job only; `400`, `401`, `403`, `404` |

The match score (FP-MATCH-1) must be one shared implementation called by both `GET /api/jobs` and `GET /api/jobs/{id}/applicants` (`backend/src/matching/index.ts`). A status change leaves an existing booking in place (FP-SCHED-2).

## Scheduling & Booking

| Method | Path | Request body | Response | Auth |
|---|---|---|---|---|
| GET | `/api/employers/me/availability` | — | `200 EmployerSlot[]` (booked and open, earliest first) | Employer; `401`, `403` |
| POST | `/api/employers/me/availability` | `{ start_time, end_time }` | `201 AvailabilitySlot` | Employer; `400` on missing timezone / end not after start / not exactly 30 minutes / start not in the future; `401`, `403` |
| DELETE | `/api/employers/me/availability/{id}` | — | `204`, or `409 SLOT_BOOKED` if booked | Employer, owner only; `401`, `403`, `404` |
| GET | `/api/applications/{id}/available-slots` | — | `200 AvailabilitySlot[]` (unbooked, future, belonging to the job's employer) | Candidate, application owner only; `401`, `403`, `404` |
| POST | `/api/applications/{id}/book` | `{ slot_id }` | `200 Application` (with `interview_slot_id` set) | Candidate, application owner only; `400`, `401`, `403`, `404`, `409` |

`POST /api/applications/{id}/book` must enforce all FP-SCHED-2 eligibility conditions atomically and return `409 { "error": { "code": "SLOT_TAKEN", "message": "Slot already booked" } }` when it loses a race (FP-SCHED-3). Its other outcomes:

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | application missing, or slot missing / belonging to a different employer than the application's job |
| `409` | `NOT_INTERVIEWING` | application status isn't `Interviewing` |
| `409` | `ALREADY_BOOKED` | application already has a slot |
| `409` | `SLOT_TAKEN` | slot already booked (including losing a race) |
| `409` | `SLOT_IN_PAST` | slot start time has passed |

Any failure leaves both the application and the slot unchanged.

## System

| Method | Path | Response | Auth |
|---|---|---|---|
| GET | `/api/health` | `200 { status: "ok" }` when the server and database are reachable; `503 DB_UNAVAILABLE` otherwise | none |

---

## Error codes

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body or field fails validation |
| 400 | `INVALID_JSON` | Malformed JSON body |
| 400 | `BAD_REQUEST` | Other malformed request the body parser rejects (e.g. unsupported charset) |
| 401 | `UNAUTHORIZED` | Missing / invalid / expired token |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `FORBIDDEN` | Wrong role or not the owner |
| 404 | `NOT_FOUND` | Object or route doesn't exist |
| 409 | `EMAIL_TAKEN` | Register with an existing email |
| 409 | `ALREADY_APPLIED` | Second application to the same job |
| 409 | `JOB_HAS_DEPENDENTS` | Delete a job that has applications |
| 409 | `SLOT_BOOKED` | Delete a booked slot |
| 409 | `NOT_INTERVIEWING`, `ALREADY_BOOKED`, `SLOT_TAKEN`, `SLOT_IN_PAST` | Booking failures (see above) |
| 413 | `PAYLOAD_TOO_LARGE` | Request body over 100 kB |
| 503 | `DB_UNAVAILABLE` | `GET /api/health` can't reach the database |
| 500 | `INTERNAL` | Unexpected server error (details are logged, never returned) |

---

## Resolved decisions

1. **JWT expiry:** 24 hours. No refresh-token flow; the client must re-login after expiry.
2. **`PUT /api/jobs/{id}`:** requires the full object (`title`, `description`, `required_skills`), not a partial update. Matches `PUT` semantics (replace, not merge); the frontend edit form must always send all three fields, plus `tags` to keep them (specs/004).
3. **Skills storage:** JSON arrays (Prisma `Json` fields on PostgreSQL `jsonb` columns), not a normalized skills table. Job tags use the same storage. See `Database_schema.md`.
4. **Response shapes** (specs/001–004, agreed 2026-10-23): as defined in [Types](#types) above.
