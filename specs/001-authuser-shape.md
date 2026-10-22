# Spec 001: Define the `AuthUser` shape

- **Date:** 2026-09-28
- **Written by:** William (backend)
- **Affects:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me`; the auth error codes (all auth endpoints)

## Problem

The response shape for the auth endpoints listed above (`AuthUser`) is not defined in `API_Contract.md`. This spec defines it.

## What needs to change

**Before:** `AuthUser` is referenced but undefined.

**After:** add this definition to the Auth section of `API_Contract.md`:

```ts
interface AuthUser {
  id: string;                          // UUID
  email: string;                       // trimmed + lowercased on register/login
  role: 'Candidate' | 'Employer';
  display_name: string;
  created_at: string;                  // ISO 8601 UTC
}
```

`AuthUser` never includes `password_hash` or any other credential (FP-AUTH-2).

Also add these details:

| Endpoint | Success | Errors (`error.code`) |
|---|---|---|
| `POST /api/auth/register` | `201 { token, user: AuthUser }` | `400 VALIDATION_ERROR` / `INVALID_JSON`, `409 EMAIL_TAKEN` |
| `POST /api/auth/login` | `200 { token, user: AuthUser }` | `400 VALIDATION_ERROR` / `INVALID_JSON`, `401 INVALID_CREDENTIALS` (same code and message for unknown email and wrong password) |
| `POST /api/auth/logout` | `204` | `401 UNAUTHORIZED` |
| `GET /api/me` | `200 AuthUser` | `401 UNAUTHORIZED` (missing, invalid, or expired token) |

Register validation: `email` must be a valid email; `password` must be 8–72 bytes; `display_name` must be non-empty (max 100 chars) after trimming; `role` must be `Candidate` or `Employer`.

Logout is stateless: the server does not revoke the JWT, and the client discards the token. Tokens expire after 24h (Resolved decision #1).

## Why

- The fields are the non-secret columns of `users` in `Database_schema.md`, so no schema change is needed. `role` lets the frontend decide which dashboard to show; `display_name` is shown in the UI.
- Profile data (skills, resume, company) stays on the profile endpoints so that `AuthUser` stays small and never carries resume text (FP-CAN-1).
- `201` is the standard status for creating a resource. Returning the same `401` for unknown email and wrong password avoids revealing which emails have accounts.
- Without this, the frontend and backend each guess the shape, and mismatches show up only at integration.

The backend already returns exactly this shape (see `backend/src/auth/service.ts`). Needs agreement from Ean Jie (frontend) and Duston (testing) before `API_Contract.md` is updated.
