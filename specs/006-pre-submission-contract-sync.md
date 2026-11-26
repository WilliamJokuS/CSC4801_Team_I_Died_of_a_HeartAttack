# Spec 006: Pre-submission contract and schema sync

- **Date:** 2026-11-26
- **Written by:** Testing / Bug Finding (Duston)
- **Affects:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/employers/me/availability`, cross-route error responses, `availability_slots`, and seed documentation

## Problem

Several defensive fixes and concurrency hardening measures already implemented in `backend/` and `testing/` are not yet reflected in `Contract/API_Contract.md` and `Contract/Database_schema.md`:

1. Auth endpoints (`POST /api/auth/register` and `POST /api/auth/login`) enforce per-IP rate limiting (`429 AUTH_RATE_LIMITED`) and an in-flight concurrency cap (`503 AUTH_BUSY`) in the server entrypoint.
2. `POST /api/employers/me/availability` rejects overlapping slots with `409 SLOT_OVERLAP` (introduced in `specs/005`, not yet added to `API_Contract.md`), and slot timestamps enforce millisecond precision and UTC year `<= 9999`.
3. Persisted text fields reject NUL bytes (`\u0000`) and unpaired UTF-16 surrogates, and registration emails enforce a 254-character maximum.
4. Transient Prisma/PostgreSQL connection, lock, and statement timeouts on any route return `503 DB_UNAVAILABLE` instead of `500 INTERNAL`.
5. `availability_slots` has both the `availability_slots_no_overlap` GiST exclusion constraint (`specs/005`) and the `serialize_employer_slot_inserts` `BEFORE INSERT` advisory-lock trigger, and the `Database_schema.md` seed notes still describe the two racing `Interviewing` applications as pointing at the slot rather than unbooked (`interview_slot_id = NULL`).

## What needs to change

- Update `Contract/API_Contract.md` to document:
  - `429 AUTH_RATE_LIMITED` and `503 AUTH_BUSY` on `/api/auth/register` and `/api/auth/login`;
  - `409 SLOT_OVERLAP` on `POST /api/employers/me/availability`;
  - cross-route `503 DB_UNAVAILABLE` on transient database/lock timeouts; and
  - the 254-char registration email limit, NUL/unpaired-surrogate text check, and slot timestamp millisecond precision / UTC year `<= 9999` validation rules.
- Update `Contract/Database_schema.md` to document `availability_slots_no_overlap` (`btree_gist`), `serialize_employer_slot_inserts`, the Prisma PostgreSQL enum types (`Role`, `ApplicationStatus`), and the unbooked (`interview_slot_id = NULL`) racing seed applications.

## Why

Keeps the published API contract and database schema aligned with the tested implementation at the graded commit (`FP-PROC-1`) without changing runtime behavior.
