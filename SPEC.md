# SPEC

Living specification for the CSC4801 recruiting and candidate matching platform. The requirement-to-test mapping lives in [README.md](README.md#requirementtest-mapping).

## 1. Architecture

The frontend is a React single-page application built with Vite and Tailwind CSS. It calls an Express REST API under `/api`. The backend implements the business rules and accesses PostgreSQL through Prisma.

During local development, Vite proxies API requests to the backend. Where a production frontend build is present, Express serves the frontend and API from the same origin. The current Docker workflow runs the app and PostgreSQL 16 in separate containers on a private Docker network. [Installation](INSTALL.md)

## 2. Data model and relationships

Each user has a unique email, a password hash, a role, and a role-specific profile. Candidate profiles hold skills and private resume text. Company profiles hold the company name and description. Employers own jobs and availability slots. An application joins a candidate and a job, with a unique constraint on that pair. Its optional interview slot link is also unique, so each slot can be linked to at most one application. Jobs are soft deleted through `is_active` after checking for applications. [Prisma schema](backend/prisma/schema.prisma)

## 3. Authentication and authorization design

Registration creates the user and their role-specific profile together. The backend hashes passwords with bcrypt and a per-password salt at cost 12. Registration and login return the public user data and a signed bearer token. The default token lifetime is 24 hours. The backend requires a signing secret of at least 32 characters. [Auth service](backend/src/auth/service.ts) [Configuration](backend/src/config.ts)

Protected requests validate the token and check the account and role against the database. Server-side role and ownership checks return `401` for invalid or missing sessions, `403` for insufficient access, and `404` for missing objects the caller could otherwise access. Candidate profiles and resume text are accessible through the owner's profile endpoint. Employer applicant responses omit resume text. [Auth middleware](backend/src/middleware/auth.ts) [Profile routes](backend/src/routes/profiles.ts) [Application service](backend/src/applications/service.ts)

Logout clears the client session. The server validates the session before returning `204`. Tokens expire on their original schedule. The frontend clears the local session even if the logout request fails, and detects session changes made in another tab. [Auth routes](backend/src/routes/auth.ts) [Auth context](frontend/src/context/AuthContext.tsx)

## 4. API routes

The API groups endpoints into authentication and current user, candidate and company profiles, job listings and employer job management, applications and applicant management, availability and booking, and health. Business conflicts such as duplicate applications and a slot taken during booking have distinct error codes. [API contract](Contract/API_Contract.md) [API status](Contract/API_Status.md)

## 5. Major UI screens

- Public pages provide the landing page, role-based registration, and login.
- The candidate overview lists active jobs with match scores, required skills, and links to job details. Candidate screens also support job browsing, browser-local saved jobs, private profile and resume editing, application tracking, and interview booking.
- The employer dashboard lists owned job postings. Employers can edit their company profile, create and edit jobs, review and update applicants, and manage interview availability. [Frontend routes](frontend/src/App.tsx)

## 6. Matching contract

Candidate skills and job required skills are stored as PostgreSQL `jsonb` arrays of strings. The shared backend `matchScore` function trims and lowercases both skill lists and drops empty and duplicate entries. It returns 100 for an empty set of required skills. Otherwise it returns the floor of 100 times the fraction of required skills the candidate has. Resume text stays outside the scoring inputs. [Prisma schema](backend/prisma/schema.prisma) [Matching implementation](backend/src/matching/index.ts)

Candidate jobs and employer applicant lists use the same score and sort descending. Jobs break ties by lowercased title and then job ID. Applicants break ties by lowercased display name and then candidate ID. [Jobs service](backend/src/jobs/service.ts) [Application service](backend/src/applications/service.ts)

## 7. Availability and booking

Availability consists of future 30-minute intervals. API times use ISO 8601 with a required `Z` or numeric offset. PostgreSQL stores the instants with `timestamptz`, and the API returns UTC strings. The frontend displays local time with a timezone label. A database exclusion constraint rejects overlapping intervals for the same employer. Back-to-back intervals are allowed. Booked slots remain unavailable and cannot be deleted. [Scheduling service](backend/src/scheduling/service.ts) [Overlap migration](backend/prisma/migrations/20261029160000_slot_no_overlap/migration.sql) [Time display](frontend/src/lib/formatDateTime.ts)

Booking locks the application row, verifies ownership, then locks and reads the slot. While holding the locks, the transaction checks the application's `Interviewing` status, employer, existing booking, and the slot's availability and start time. A conditional update claims the slot, then the transaction links the application to it. A database uniqueness constraint protects that link. When two eligible candidates race for one slot, the loser receives `409 SLOT_TAKEN` with the message `Slot already booked`. A failed transaction rolls back both writes. A later application status change preserves the booking. [Booking transaction](backend/src/scheduling/service.ts) [Application service](backend/src/applications/service.ts)

## 8. Security controls

- **Database access.** Application queries use Prisma. Explicit locking SQL uses tagged, parameterized `$queryRaw` calls. The seed runner uses `pg.Client` to execute the checked-in reset and seed SQL files. [Scheduling service](backend/src/scheduling/service.ts) [Seed runner](backend/prisma/seed.ts)
- **HTML rendering.** React escapes user-controlled text through standard JSX rendering. Profile and job fields are validated and skills are normalized on write. The rendering tests verify that a script-shaped string appears as text without creating a script element. [Rendering tests](testing/src/frontend/xss.test.tsx)
- **Secrets and test isolation.** Environment examples contain local placeholders. Unit tests use isolated fixtures, and the optional live suite requires a disposable PostgreSQL test database. [Environment template](backend/.env.example) [Test setup](testing/README.md)

## 9. Optional AI enhancement (FP-MATCH-2)

N/A. The application ranks jobs and applicants using the deterministic skills score.
