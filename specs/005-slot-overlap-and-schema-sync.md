# Spec 005 — Employer slot overlap and schema documentation

- **Date** 2026-11-24
- **Owner** Backend (William)
- **Affects** `POST /api/employers/me/availability`, `availability_slots`, and the database schema documentation
- **Status** Behavior implemented and tested. Shared contract and database documentation updates are pending team review.

## Problem

The server rejects overlapping availability for the same employer. The published API contract needs to document the conflict, and the database schema document needs to describe the constraint that enforces it. Its demo seed notes also describe two applications already pointing to one slot, while the actual seed leaves both applications unbooked and eligible to compete for it.

## Proposed documentation

- Add `409 SLOT_OVERLAP` to the availability creation response and error table. It applies to overlapping slots for the same employer, including identical intervals. A slot may begin exactly when the previous slot ends. The request and successful response shapes stay the same.
- Describe the `btree_gist` extension and `availability_slots_no_overlap` exclusion constraint. It compares employer equality and overlap of half-open `[start_time, end_time)` ranges. PostgreSQL enforces it during concurrent inserts.
- Match the database document to the migration's `Role` and `ApplicationStatus` enums and foreign-key delete actions. Describe the two eligible seeded applications with `interview_slot_id = NULL`.
- Record the endpoint behavior in the API status table and synchronize the shared contract documents after team review.

## Verification

`BUG-BE-1` checks the API response for identical slots. The live PostgreSQL overlap case checks that two competing inserts yield one `201` and one `409 SLOT_OVERLAP`, with one stored row. It also checks the same response for sequential overlap. Both tests passed on `0cd4d56`. [Bug regressions](../testing/src/regression/open-bugs.test.tsx) [Live concurrency tests](../testing/src/live-pg/concurrency.live.test.ts)
