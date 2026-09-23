# Database Schema

Relational schema for the recruiting platform (`REQUIREMENTS.md`). Engine: **PostgreSQL**, accessed through the **Prisma** ORM. IDs are UUID strings. Timestamps are `timestamptz`, stored and compared in UTC, rendered as ISO 8601 (e.g. `2026-09-23T10:00:00Z`).

The tables below are implemented as Prisma models in `backend/prisma/schema.prisma`; that file (plus its generated migrations under `backend/prisma/migrations/`) is the source of truth, this document is the reference. `jsonb` columns map to Prisma `Json` fields. Only the backend owner edits the schema/migrations; changes to table shape here should be agreed by the team first (see `AGENTS.md`).

## users

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| email | text | UNIQUE, NOT NULL |
| password_hash | text | NOT NULL (bcrypt/argon2, never plaintext) |
| role | text | NOT NULL, CHECK IN ('Candidate', 'Employer') |
| display_name | text | NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

Notes: `email` uniqueness satisfies FP-AUTH-1. `password_hash` never returned by any endpoint (FP-AUTH-2).

## candidate_profiles

| Column | Type | Constraints |
|---|---|---|
| user_id | uuid | PK, FK -> users.id ON DELETE CASCADE |
| skills | jsonb | NOT NULL, DEFAULT '[]' (array of trimmed, lowercase strings, deduped at write time per FP-MATCH-1) |
| resume_text | text | NOT NULL, DEFAULT '' |

Notes: row created at registration time when `role = 'Candidate'`. Only the owning user may read/write (FP-CAN-1).

## company_profiles

| Column | Type | Constraints |
|---|---|---|
| user_id | uuid | PK, FK -> users.id ON DELETE CASCADE |
| company_name | text | NOT NULL |
| description | text | NOT NULL, DEFAULT '' |

Notes: row created at registration time when `role = 'Employer'` (FP-EMP-1).

## jobs

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| employer_id | uuid | NOT NULL, FK -> users.id |
| title | text | NOT NULL, CHECK (title <> '') |
| description | text | NOT NULL, CHECK (description <> '') |
| required_skills | jsonb | NOT NULL, DEFAULT '[]' (may be empty per FP-EMP-2) |
| is_active | boolean | NOT NULL, DEFAULT true (soft delete: "current (not deleted)" jobs per FP-CAN-2) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

Index: `(employer_id)`.

## applications

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| job_id | uuid | NOT NULL, FK -> jobs.id |
| candidate_id | uuid | NOT NULL, FK -> users.id |
| status | text | NOT NULL, DEFAULT 'Pending', CHECK IN ('Pending','Interviewing','Rejected','Accepted') |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| interview_slot_id | uuid | NULL, FK -> availability_slots.id, UNIQUE |

Constraint: `UNIQUE (job_id, candidate_id)` — enforces "apply once" at the DB layer (FP-CAN-3), not just in application code.

`interview_slot_id UNIQUE` means a slot can be linked to at most one application. This is the concurrency mechanism for FP-SCHED-3: booking is a single `UPDATE ... WHERE interview_slot_id IS NULL` (or transaction with row lock) that either succeeds or violates the unique constraint, so exactly one of two racing candidates wins.

## availability_slots

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| employer_id | uuid | NOT NULL, FK -> users.id |
| start_time | timestamptz | NOT NULL |
| end_time | timestamptz | NOT NULL, CHECK (end_time = start_time + interval '30 minutes') |
| is_booked | boolean | NOT NULL, DEFAULT false |

Index: `(employer_id, start_time)`.

Notes: `is_booked` is a denormalized convenience flag kept in sync with `applications.interview_slot_id` inside the same booking transaction — the `applications.interview_slot_id` UNIQUE constraint is the actual source of truth for "can this slot still be booked," not this flag alone. Deletion of a slot where `is_booked = true` must be rejected at the application layer (FP-SCHED-1).

## Entity relationships

```
users (1) ---- (0..1) candidate_profiles
users (1) ---- (0..1) company_profiles
users/employer (1) ---- (*) jobs
users/candidate (1) ---- (*) applications ---- (1) jobs
users/employer (1) ---- (*) availability_slots
applications (0..1) ---- (0..1) availability_slots   [via applications.interview_slot_id, UNIQUE]
```

## Seed data requirements (FP-DOC-3)

The seed script (`backend/prisma/seed.ts`, run via `npx prisma db seed` or the project's `npm run seed`) must populate, at minimum:

- 2 `users` rows with `role = 'Candidate'` + matching `candidate_profiles`
- 2 `users` rows with `role = 'Employer'` + matching `company_profiles`
- 2 `jobs` rows with non-empty `required_skills`
- `applications` covering all 4 status values
- skill combinations reproducing all 4 FP-MATCH-1 examples (`Python,SQL`→`Python,SQL`=100; `Python`→`Python,SQL`=50; `Rust`→`Python,SQL`=0; any→[]=100)
- 2 `applications` in `Interviewing` status pointed at the **same** `availability_slots` row (both currently unbooked) to exercise the FP-SCHED-3 race
- all seed passwords/emails clearly marked as local/demo in `README.md`
