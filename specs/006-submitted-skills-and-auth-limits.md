# Spec 006 — Submitted skills and auth limits

- **Date** 2026-11-24
- **Affects** Candidate profiles, employer job writes, login, and registration

## Submitted skills

The limits of 50 entries and 50 characters per entry apply before normalization. Whitespace, duplicates, and blank entries count against the submitted limits. Valid lists are still trimmed, lowercased, and deduplicated before storage.

## Running server auth limits

Login and registration share a per-client limit of 20 requests per minute and a cap of four in-flight requests per process. A client over its limit gets `429 AUTH_RATE_LIMITED`. When the server has no auth capacity, it returns `503 AUTH_BUSY`. Both use the existing JSON error envelope and include `Retry-After`. Accepted attempts still use the same `401 INVALID_CREDENTIALS` response for an unknown email and a wrong password.
