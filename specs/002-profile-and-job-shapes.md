# Spec 002: Define profile and job response shapes

- **Date:** 2026-09-28
- **Written by:** William (backend)
- **Affects:** `GET/PUT /api/candidates/me/profile`, `GET/PUT /api/employers/me/profile`, `POST /api/jobs`, `GET /api/jobs/mine`, `GET/PUT/DELETE /api/jobs/{id}`

## Problem

The response shapes for the profile and job endpoints listed above (`CandidateProfile`, `CompanyProfile`, `Job`) are not defined in `API_Contract.md`. This spec defines them.

## What needs to change

Add these definitions to `API_Contract.md`:

```ts
interface CandidateProfile {
  user_id: string;           // UUID
  display_name: string;      // same value as AuthUser.display_name
  skills: string[];          // normalized: trimmed, lowercase, no empties, no duplicates
  resume_text: string;       // private to the owning candidate (FP-CAN-1)
}

interface CompanyProfile {
  user_id: string;           // UUID
  company_name: string;
  description: string;
}

interface Job {
  id: string;                // UUID
  employer_id: string;       // UUID
  company_name: string;      // joined from the employer's company profile (FP-CAN-2)
  title: string;
  description: string;
  required_skills: string[]; // normalized like skills above; may be empty
  created_at: string;        // ISO 8601 UTC
}
```

**Validation** (failures → `400 VALIDATION_ERROR`):

| Field | Rule |
|---|---|
| `display_name` | non-empty after trim, ≤ 100 chars (stored trimmed) |
| `skills`, `required_skills` | array of strings, ≤ 50 items, each ≤ 50 chars; normalized before storing, so `[" Python", "python", ""]` is stored and returned as `["python"]` |
| `resume_text` | string, ≤ 20,000 chars, may be empty |
| `company_name` | non-empty after trim, ≤ 200 chars |
| `description` (company) | string, ≤ 5,000 chars, may be empty |
| `title` | non-empty after trim, ≤ 200 chars |
| `description` (job) | non-empty after trim, ≤ 10,000 chars |

All `PUT` bodies are full replacements; every field is required.

**Status codes and error codes:**

| Endpoint | Success | Errors |
|---|---|---|
| `PUT` profile routes | `200` + updated profile | `400`, `401`, `403` (wrong role) |
| `POST /api/jobs` | `201 Job` | `400`, `401`, `403` (not an Employer) |
| `GET /api/jobs/mine` | `200 Job[]`, newest first | `401`, `403` |
| `GET /api/jobs/{id}` | `200 Job` | `401`, `404` (missing, deleted, or not a UUID) |
| `PUT /api/jobs/{id}` | `200 Job` | `400`, `401`, `403 FORBIDDEN` (other employer's job), `404` |
| `DELETE /api/jobs/{id}` | `204` | `401`, `403`, `404`, `409 JOB_HAS_DEPENDENTS` |

For `PUT`/`DELETE` on a job, `404` is checked before `403`: a missing job is `404` for everyone, and an existing job owned by someone else is `403`.

**Job deletion:** a job is deletable only if it has no applications. Interview slots belong to an employer, not a job; the only way a slot depends on a job is through an application's `interview_slot_id`, so "has applications" covers both. Deletion is a soft delete (`is_active = false`, as `Database_schema.md` already specifies), and a deleted job is `404` on every route and no longer appears in `GET /api/jobs/mine` or `GET /api/jobs`.

## Why

- Without definitions, the frontend and backend each guess the shapes, and mismatches show up only at integration.
- The fields mirror the tables in `Database_schema.md`, so no schema change is needed. `display_name` appears on `CandidateProfile` because `PUT /api/candidates/me/profile` already accepts it.
- `company_name` on `Job` lets the dashboard and job detail pages meet FP-CAN-2 without an extra request per job.
- Normalizing skills when they're saved means the stored values are exactly what the match score (FP-MATCH-1) compares, and the UI shows what matching actually uses.
- Profile routes only ever act on the caller (`/me`), so no request can name another user's profile or resume, which covers FP-CAN-1 and FP-SEC-1 for profiles by construction.

The backend already implements exactly this (see `backend/src/profiles/service.ts` and `backend/src/jobs/service.ts`). Needs agreement from Ean Jie (frontend) and Duston (testing) before `API_Contract.md` is updated.
