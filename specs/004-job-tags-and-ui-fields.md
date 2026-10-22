# Spec 004: Job tags, company description, applicant counts, and slot bookers

- **Date:** 2026-10-23
- **Written by:** William (backend)
- **Affects:** `POST /api/jobs`, `PUT /api/jobs/{id}`, every response containing `Job` (`GET /api/jobs`, `GET /api/jobs/mine`, `GET /api/jobs/{id}`, `POST`/`PUT /api/jobs`), `GET /api/employers/me/availability`; table `jobs` (new column `tags`)

## Problem

The UI planned for the final design needs five things the API doesn't provide today:

1. **Job tags** (e.g. `Remote`, `Full-time`, `Junior`) to label job cards and filter the job list. Only `required_skills` exists, and it feeds the match score, so it can't double as general labels.
2. **The company description** on the job detail screen. `Job` carries `company_name` but not the description, and a candidate has no route to read another user's company profile.
3. **How many applicants each posting has**, on the employer's job list. The only way today is one `GET /api/jobs/{id}/applicants` request per job.
4. **Whether a job can be deleted**, so the UI can disable "Delete" instead of letting it fail with `409 JOB_HAS_DEPENDENTS`. Same missing data as 3.
5. **Who booked each slot**, on the employer's availability screen. `AvailabilitySlot` only says `is_booked: true`.

## What needs to change

### 1. Job tags (schema change)

**`Database_schema.md`, table `jobs`:** add

| Column | Type | Constraints |
|---|---|---|
| tags | jsonb | NOT NULL, DEFAULT '[]' (array of strings) |

Existing rows get `[]` from the default, so the migration needs no backfill.

**`Job`** gains `tags: string[]`.

**`POST /api/jobs` and `PUT /api/jobs/{id}`** accept an optional `tags` field:

```json
{ "title": "...", "description": "...", "required_skills": ["python"], "tags": ["Remote", "Full-time"] }
```

| Rule | Detail |
|---|---|
| Optional | Omitted means `[]`. `PUT` is still a full replacement (Resolved decision #2), so a `PUT` without `tags` **clears** them: the edit form must send the current tags back. |
| Limits | ≤ 10 tags, each ≤ 30 characters after trimming; otherwise `400 VALIDATION_ERROR` |
| Normalization | Trimmed, empties dropped, duplicates removed **case-insensitively**, keeping the first spelling. Unlike skills, case is preserved for display: `[" Remote", "remote", "Full-time"]` is stored and returned as `["Remote", "Full-time"]`. |

Tags are display and filtering labels only. They are **not** an input to the match score (FP-MATCH-1 is skills only) and don't change any sort order. Filtering by tag happens in the frontend over the already-sorted `GET /api/jobs` result; no query parameter is added.

### 2. Company description on `Job`

**`Job`** gains `company_description: string`, read from the employer's `company_profiles.description` the same way `company_name` already is (empty string if not set). It appears everywhere `Job` does, including `ScoredJob`. `ScoredApplication.job` is unchanged.

### 3 and 4. Applicant count on the employer's own jobs

`GET /api/jobs/mine` returns `EmployerJob[]` instead of `Job[]`:

```ts
interface EmployerJob extends Job {
  applicant_count: number;   // applications for this job, any status
}
```

Only `GET /api/jobs/mine` returns this field; other employers and candidates never see a job's applicant count.

`applicant_count > 0` is exactly the condition under which `DELETE /api/jobs/{id}` returns `409 JOB_HAS_DEPENDENTS` (specs/002), so the UI can disable "Delete" with an explanation. The `409` stays the source of truth: an application can arrive after the list was loaded, so the UI must still handle it.

### 5. Booking details on the employer's slots

`GET /api/employers/me/availability` returns `EmployerSlot[]` instead of `AvailabilitySlot[]`:

```ts
interface EmployerSlot extends AvailabilitySlot {
  booking: {
    application_id: string;
    job_id: string;
    job_title: string;
    candidate_id: string;
    candidate_display_name: string;
  } | null;                  // null when the slot isn't booked
}
```

Only the slot's owner gets this (the route is already `/me`). It never includes the candidate's email, skills, or resume (FP-CAN-1). `GET /api/applications/{id}/available-slots` is unchanged: it only returns unbooked slots, so there's nothing to add.

### Unchanged

Status codes, error codes, authorization, and every other request body stay as they are. All changes add fields; nothing is removed or renamed, so a client written against specs 001–003 keeps working, apart from the `PUT` tags note in §1.

### Follow-up work once agreed

- Backend: migration adding `jobs.tags`, validation and normalization, the new fields, and tags for the seeded jobs in `prisma/sql/seed.sql`.
- `API_Contract.md`: add `tags` to the job request bodies, and `EmployerJob` / `EmployerSlot` to the response column of the two routes.
- `Database_schema.md`: the `tags` column above.
- `frontend/src/types/index.ts`: the same field and type additions.

## Why

- Each field replaces either an extra request per item (applicant counts, company description) or data the UI can't get at all (tags, who booked a slot).
- `tags` is kept separate from `required_skills` so labels like `Remote` can never change a match score, which FP-MATCH-1 defines from skills alone.
- Tags keep their casing because they're shown as typed. Skills are lowercased because matching compares them.
- `tags` is optional so existing clients and tests that create jobs without it keep working.
- Applicant counts and booking details go only on the owner's `/mine` and `/me` routes, so they don't leak to candidates or other employers (FP-AUTH-3, FP-SEC-1). Bookings expose only a display name, never resume or contact details.
- A JSON array column matches how skills are stored (Resolved decision #3), rather than adding a tags table.

Needs agreement from Ean Jie (frontend) and Duston (testing) before `API_Contract.md` and `Database_schema.md` are updated and the backend is changed.
