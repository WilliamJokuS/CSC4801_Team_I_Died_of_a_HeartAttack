# Spec 007 — Slot timestamp precision

- **Date** 2026-11-24
- **Affects** `POST /api/employers/me/availability`

The scheduling API accepts ISO 8601 timestamps with a timezone that are exactly representable at millisecond precision. Fractional digits beyond the third must be zero. A nonzero digit beyond the third returns `400 VALIDATION_ERROR`, so the API never silently rounds an interview time. This documents the validation already enforced by the backend.
