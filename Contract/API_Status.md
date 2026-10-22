# API Status

Tracks how far each endpoint in [`API_Contract.md`](API_Contract.md) has progressed. Update this file, don't just say it in chat — it's the shared source of truth for "is this ready to build against yet."

**Status values:**

| Status | Meaning |
|---|---|
| `Missing` | Not started on either side. |
| `Backend done` | Backend implemented and manually verified; frontend hasn't wired it up yet. |
| `Frontend done` | Frontend built against the contract shape (mock or real); backend not done yet. |
| `Both done` | Implemented on both sides and working together. |
| `Needs changes` | Something doesn't match — see the linked spec in `specs/`. |

Whoever finishes their side flips the status. Whoever finds a mismatch sets it to `Needs changes` and writes a spec in `specs/` (see [`AGENTS.md`](../AGENTS.md#changing-the-api-contract)).

## Auth

| Endpoint | Status | Notes |
|---|---|---|
| `POST /api/auth/register` | Backend done | `AuthUser` shape in [specs/001](../specs/001-authuser-shape.md) |
| `POST /api/auth/login` | Backend done | `AuthUser` shape in [specs/001](../specs/001-authuser-shape.md) |
| `POST /api/auth/logout` | Backend done | Stateless: `204`, client discards the token |
| `GET /api/me` | Backend done | `AuthUser` shape in [specs/001](../specs/001-authuser-shape.md) |

## Profiles

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/candidates/me/profile` | Backend done | Shape in [specs/002](../specs/002-profile-and-job-shapes.md) |
| `PUT /api/candidates/me/profile` | Backend done | Shape in [specs/002](../specs/002-profile-and-job-shapes.md); skills normalized on save |
| `GET /api/employers/me/profile` | Backend done | Shape in [specs/002](../specs/002-profile-and-job-shapes.md) |
| `PUT /api/employers/me/profile` | Backend done | Shape in [specs/002](../specs/002-profile-and-job-shapes.md) |

## Jobs

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/jobs` | Backend done | Shape in [specs/003](../specs/003-application-and-scheduling-shapes.md); score from `backend/src/matching`; `tags` + `company_description` per [specs/004](../specs/004-job-tags-and-ui-fields.md) |
| `POST /api/jobs` | Backend done | Shape in [specs/002](../specs/002-profile-and-job-shapes.md); optional `tags` per [specs/004](../specs/004-job-tags-and-ui-fields.md) |
| `GET /api/jobs/mine` | Backend done | Returns `EmployerJob[]` (`applicant_count`) per [specs/004](../specs/004-job-tags-and-ui-fields.md) |
| `GET /api/jobs/{id}` | Backend done | Shape in [specs/002](../specs/002-profile-and-job-shapes.md); `tags` + `company_description` per [specs/004](../specs/004-job-tags-and-ui-fields.md) |
| `PUT /api/jobs/{id}` | Backend done | Shape in [specs/002](../specs/002-profile-and-job-shapes.md); optional `tags`, omitted clears them, per [specs/004](../specs/004-job-tags-and-ui-fields.md) |
| `DELETE /api/jobs/{id}` | Backend done | Shape in [specs/002](../specs/002-profile-and-job-shapes.md); `409 JOB_HAS_DEPENDENTS` if the job has applications |

## Applications

| Endpoint | Status | Notes |
|---|---|---|
| `POST /api/jobs/{id}/applications` | Backend done | Shape in [specs/003](../specs/003-application-and-scheduling-shapes.md); `409 ALREADY_APPLIED` |
| `GET /api/applications/mine` | Backend done | Shape in [specs/003](../specs/003-application-and-scheduling-shapes.md) |
| `GET /api/jobs/{id}/applicants` | Backend done | Shape in [specs/003](../specs/003-application-and-scheduling-shapes.md) |
| `PUT /api/applications/{id}/status` | Backend done | Shape in [specs/003](../specs/003-application-and-scheduling-shapes.md) |

## Scheduling & Booking

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/employers/me/availability` | Backend done | Returns `EmployerSlot[]` (`booking`) per [specs/004](../specs/004-job-tags-and-ui-fields.md) |
| `POST /api/employers/me/availability` | Backend done | Shape in [specs/003](../specs/003-application-and-scheduling-shapes.md); times need `Z` or an offset |
| `DELETE /api/employers/me/availability/{id}` | Backend done | Shape in [specs/003](../specs/003-application-and-scheduling-shapes.md); `409 SLOT_BOOKED` |
| `GET /api/applications/{id}/available-slots` | Backend done | Shape in [specs/003](../specs/003-application-and-scheduling-shapes.md) |
| `POST /api/applications/{id}/book` | Backend done | Shape in [specs/003](../specs/003-application-and-scheduling-shapes.md); atomic, `409 SLOT_TAKEN` on a lost race |

## System

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/health` | Backend done | `503 DB_UNAVAILABLE` if the database is unreachable |
