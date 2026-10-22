# Spec 003: Define application, scored-job, and scheduling shapes

- **Date:** 2026-10-23
- **Written by:** William (backend)
- **Affects:** `GET /api/jobs`, `POST /api/jobs/{id}/applications`, `GET /api/applications/mine`, `GET /api/jobs/{id}/applicants`, `PUT /api/applications/{id}/status`, `GET/POST /api/employers/me/availability`, `DELETE /api/employers/me/availability/{id}`, `GET /api/applications/{id}/available-slots`, `POST /api/applications/{id}/book`

## Problem

`API_Contract.md` names `ScoredJob`, `Application`, `ScoredApplication`, and `AvailabilitySlot` but doesn't define them, and doesn't list the error codes for applying, status changes, slots, or booking. This spec defines them.

## What needs to change

Add these definitions to `API_Contract.md`:

```ts
interface ScoredJob extends Job {           // Job from specs/002
  match_score: number;                      // 0–100, FP-MATCH-1, for the calling candidate
  has_applied: boolean;                     // the caller already has an application for this job
}

interface Application {
  id: string;                               // UUID
  job_id: string;
  candidate_id: string;
  status: 'Pending' | 'Interviewing' | 'Rejected' | 'Accepted';
  created_at: string;                       // ISO 8601 UTC
  interview_slot_id: string | null;
}

interface ScoredApplication extends Application {
  match_score: number;                      // candidate's skills vs the job's required skills
  job: { id: string; title: string; company_name: string };
  candidate: { id: string; display_name: string; skills: string[] };   // never resume_text
  interview_slot: AvailabilitySlot | null;
}

interface AvailabilitySlot {
  id: string;
  employer_id: string;
  start_time: string;                       // ISO 8601 UTC
  end_time: string;                         // always start_time + 30 minutes
  is_booked: boolean;
}
```

`ScoredApplication` is the row type for both `GET /api/applications/mine` (candidate's own, newest first) and `GET /api/jobs/{id}/applicants` (sorted by score desc, then case-insensitive `display_name`, then candidate id).

**Request bodies:** `PUT /api/applications/{id}/status` takes `{ status }`, one of the four values. `POST /api/employers/me/availability` takes `{ start_time, end_time }` as ISO 8601 timestamps that **must include `Z` or an offset**; they're stored as `timestamptz` and returned in UTC. `POST /api/applications/{id}/book` takes `{ slot_id }`.

**Status and error codes:**

| Endpoint | Success | Errors |
|---|---|---|
| `GET /api/jobs` | `200 ScoredJob[]` | `401`, `403` (not a Candidate) |
| `POST /api/jobs/{id}/applications` | `201 Application` (`Pending`) | `401`, `403`, `404` (missing/deleted job), `409 ALREADY_APPLIED` |
| `GET /api/applications/mine` | `200 ScoredApplication[]` | `401`, `403` |
| `GET /api/jobs/{id}/applicants` | `200 ScoredApplication[]` | `401`, `403` (not an Employer, or not the job's owner), `404` |
| `PUT /api/applications/{id}/status` | `200 Application` | `400`, `401`, `403` (not the job's owner), `404` |
| `GET /api/employers/me/availability` | `200 AvailabilitySlot[]`, earliest first, booked and open | `401`, `403` |
| `POST /api/employers/me/availability` | `201 AvailabilitySlot` | `400` (no timezone, end ≤ start, not exactly 30 min, start not in the future), `401`, `403` |
| `DELETE /api/employers/me/availability/{id}` | `204` | `401`, `403` (another employer's slot), `404`, `409 SLOT_BOOKED` |
| `GET /api/applications/{id}/available-slots` | `200 AvailabilitySlot[]` (job's employer, unbooked, future) | `401`, `403` (not the application's owner), `404` |
| `POST /api/applications/{id}/book` | `200 Application` | `400` (bad `slot_id`), `401`, `403` (not the application's owner), `404` (missing application, or slot missing / belongs to another employer), `409` (see below) |

Booking `409` codes: `NOT_INTERVIEWING` (status isn't `Interviewing`), `ALREADY_BOOKED` (application already has a slot), `SLOT_TAKEN` with message `Slot already booked` (slot already booked, including losing a race), `SLOT_IN_PAST`.

As in specs/002, `404` is checked before `403`: a missing object is `404` for everyone.

## Why

- Without definitions the frontend and backend each guess, and mismatches only show up at integration. The frontend already builds against exactly these shapes (`frontend/src/types/index.ts` on branch `william/minimal-frontend`).
- One `ScoredApplication` type serves both views because FP-CAN-3 (candidate: job, employer, status, booking) and FP-EMP-3 (employer: candidate identity, skills, score, status, booking) need overlapping data. It never includes resume text, so FP-CAN-1 privacy holds.
- Requiring a timezone on slot times makes them unambiguous (FP-SCHED-1).
- A slot from a different employer is `404` rather than `403` so a candidate can't probe other employers' slot ids.
- Distinct `409` codes let the UI explain why a booking failed; `SLOT_TAKEN` / `Slot already booked` is the exact wording the contract and FP-SCHED-3 require.

Implemented in `backend/src/applications/service.ts`, `backend/src/scheduling/service.ts`, and `backend/src/matching/index.ts`. Needs agreement from Ean Jie (frontend) and Duston (testing) before `API_Contract.md` is updated.
