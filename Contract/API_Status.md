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
| `POST /api/auth/register` | Missing | |
| `POST /api/auth/login` | Missing | |
| `POST /api/auth/logout` | Missing | |
| `GET /api/me` | Missing | |

## Profiles

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/candidates/me/profile` | Missing | |
| `PUT /api/candidates/me/profile` | Missing | |
| `GET /api/employers/me/profile` | Missing | |
| `PUT /api/employers/me/profile` | Missing | |

## Jobs

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/jobs` | Missing | |
| `POST /api/jobs` | Missing | |
| `GET /api/jobs/mine` | Missing | |
| `GET /api/jobs/{id}` | Missing | |
| `PUT /api/jobs/{id}` | Missing | |
| `DELETE /api/jobs/{id}` | Missing | |

## Applications

| Endpoint | Status | Notes |
|---|---|---|
| `POST /api/jobs/{id}/applications` | Missing | |
| `GET /api/applications/mine` | Missing | |
| `GET /api/jobs/{id}/applicants` | Missing | |
| `PUT /api/applications/{id}/status` | Missing | |

## Scheduling & Booking

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/employers/me/availability` | Missing | |
| `POST /api/employers/me/availability` | Missing | |
| `DELETE /api/employers/me/availability/{id}` | Missing | |
| `GET /api/applications/{id}/available-slots` | Missing | |
| `POST /api/applications/{id}/book` | Missing | |

## System

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/health` | Missing | |
