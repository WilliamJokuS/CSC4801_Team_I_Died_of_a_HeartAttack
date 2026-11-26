# CSC4801 Recruiting & Candidate Matching Platform

A full-stack recruiting platform built for the CSC4801 final project. Candidates find and apply to jobs ranked by how well their skills match. Employers post jobs, review applicants sorted by match score, and publish interview slots. Candidates book those slots safely, even when two people try to book the same one at once.

Built with **TypeScript / JavaScript**.

## Team

| Person | Name | Role | Folder |
|---|---|---|---|
| A | Ean Jie | Frontend | `frontend/` |
| B | William | Backend | `backend/` |
| C | Duston | Testing / bug finding | `testing/` |

Each member edits only their own folder. See [`AGENTS.md`](AGENTS.md) for the rules AI agents follow in this repo.

## Features

**Candidate**
- Register, log in, log out
- Edit own profile: display name and technical skills
- Enter, view, and replace a private raw-text resume
- Dashboard of all active jobs, sorted by match score (highest first)
- Apply to a job once; track status (`Pending`, `Interviewing`, `Rejected`, `Accepted`)
- Book one interview slot when an application is `Interviewing`

**Employer**
- Register, log in, log out
- Edit company profile: name and description
- Create, view, edit, and delete own job postings (delete blocked with `409` if applications exist, including any with interview bookings)
- View applicants per job, sorted by match score
- Set application status
- Create and delete future 30-minute interview slots

**Match score (FP-MATCH-1)**

Skills are trimmed, lowercased, and deduplicated. With candidate skills `C` and required skills `R`:

```text
score = 100                                    when |R| = 0
score = floor(100 * |C ∩ R| / |R|)             otherwise
```

## Architecture

| Layer | Technology | Folder |
|---|---|---|
| Frontend | React + TypeScript, Vite, Tailwind CSS | `frontend/` |
| Backend | Node.js + TypeScript REST API (`/api`) | `backend/` |
| Database | PostgreSQL via Prisma ORM | `backend/prisma/` |
| Tests | Vitest unit, frontend, regression, and live PostgreSQL tests | `testing/` |
| Docker setup | App image serving the UI and API, with a PostgreSQL 16 container | [INSTALL.md](INSTALL.md#8-docker) |

- The API uses JWT bearer tokens and stores bcrypt password hashes.
- The server validates the session on protected routes and checks the role and object owner where required.
- Booking locks the application and slot inside a transaction. A unique slot link ensures one booking per slot. A candidate who loses the race receives `409 Slot already booked`.

Full API routes: [`Contract/API_Contract.md`](Contract/API_Contract.md). Tables and relationships: [`Contract/Database_schema.md`](Contract/Database_schema.md).

## Quick start

Follow [INSTALL.md](INSTALL.md) for local development or the two-container Docker setup, including prerequisites, database setup, migrations, and startup.

## Demo accounts

Run the following from the repository root after applying migrations. It resets the configured local database and loads the demo accounts.

```bash
npm --prefix backend run db:seed
```

| Role | Email | Local demo password |
|---|---|---|
| Candidate | `alice@demo.test` | `password123` |
| Candidate | `bob@demo.test` | `password123` |
| Employer | `hr@acme.demo.test` | `password123` |
| Employer | `hr@northwind.demo.test` | `password123` |

## Running tests

Run this from the repository root after installing dependencies in all three projects.

```bash
npm --prefix testing test
```

The unit suite runs non-interactively and exits nonzero on failure. Run `npm --prefix testing run test:bugs` for the audit regressions. The live concurrency suite runs separately against a disposable PostgreSQL database. [Test setup](testing/README.md)

## Requirement–test mapping

Each row links to implementation or documentation and names the relevant tests or verification evidence. The first column uses the IDs from [the project requirements](reference/REQUIREMENTS.md).

| Requirement | Implementation | Named tests or verification |
|---|---|---|
| FP-ARCH-1 | [Browser router](frontend/src/App.tsx), [Express server](backend/src/server.ts), [Prisma schema](backend/prisma/schema.prisma), [installation](INSTALL.md) | [seed.test.ts](testing/src/unit/seed.test.ts) — “returns 200 { status: "ok" } when the database responds”. [Docker smoke test](INSTALL.md#8-docker) covers startup and API health. |
| FP-AUTH-1 | [Auth service](backend/src/auth/service.ts), [auth routes](backend/src/routes/auth.ts), [auth context](frontend/src/context/AuthContext.tsx) | [auth.test.ts](testing/src/unit/auth.test.ts) — “registers a Candidate: 201 with a token and the AuthUser shape”, “registers an Employer and starts company_name as the display name”, “keeps emails unique: a duplicate is 409 EMAIL_TAKEN and creates no second user”, “logs in with the right credentials: 200 with a token and the user”, “logout returns 204 for a valid token”. |
| FP-AUTH-2 | [Password hashing](backend/src/auth/password.ts), [auth service](backend/src/auth/service.ts) | [auth.test.ts](testing/src/unit/auth.test.ts) — “stores a bcrypt hash (cost 12), never the plaintext password”, “never returns the password, its hash, or any credential from register, login or /me”. |
| FP-AUTH-3 | [Auth middleware](backend/src/middleware/auth.ts), [API routes](backend/src/routes/) | [authorization.test.ts](testing/src/unit/authorization.test.ts) — route cases for “FP-AUTH-3 wrong role is 403 on every role-restricted endpoint” and “FP-AUTH-3 missing objects are 404”. [auth.test.ts](testing/src/unit/auth.test.ts) — “logout without a token is 401”. |
| FP-CAN-1 | [Profile service](backend/src/profiles/service.ts), [candidate profile page](frontend/src/pages/CandidateProfilePage.tsx) | [candidate.test.ts](testing/src/unit/candidate.test.ts) — “views their own profile: name, skills and resume”, “persists the raw-text resume and lets the owner view it again”, “lets the owner replace the resume; the old text is gone”, “saved skills are used by the matching function on the dashboard”. |
| FP-CAN-2 | [Application service](backend/src/applications/service.ts), [candidate overview](frontend/src/pages/CandidateOverviewPage.tsx), [job browser](frontend/src/pages/CandidateJobsView.tsx) | [candidate.test.ts](testing/src/unit/candidate.test.ts) — “lists every current job with title, company, required skills, description and a match score”, “breaks ties by case-insensitive title, then by id”; [open-bugs.test.tsx](testing/src/regression/open-bugs.test.tsx) — “(FP-CAN-2): Candidate dashboard lists all active jobs with required skills and "View" opens the clicked job”. |
| FP-CAN-3 | [Application service](backend/src/applications/service.ts), [candidate applications page](frontend/src/pages/CandidateApplicationsPage.tsx) | [candidate.test.ts](testing/src/unit/candidate.test.ts) — “applying creates an application with status Pending owned by the caller”, “a duplicate application is 409 ALREADY_APPLIED and creates no second row”, “shows the job, employer, status, match score and booking for each of the caller's applications”, “a candidate cannot change an application status (403) and the status stays”. |
| FP-EMP-1 | [Profile service](backend/src/profiles/service.ts), [employer profile page](frontend/src/pages/EmployerProfilePage.tsx) | [employer.test.ts](testing/src/unit/employer.test.ts) — “views the company name and description”, “edits the company profile and sees the change on the next read”, “an update changes only the caller's profile, never another employer's”. |
| FP-EMP-2 | [Jobs service](backend/src/jobs/service.ts), [job form](frontend/src/pages/EmployerJobFormPage.tsx), [employer dashboard](frontend/src/pages/EmployerDashboardPage.tsx) | [employer.test.ts](testing/src/unit/employer.test.ts) — “creates a job owned by the caller with normalized skills and company details”, “edits a job: PUT replaces title, description, skills and tags”, “a job with no applications is deleted: 204, then 404 and absent from every list”, “a job that has applications is 409 JOB_HAS_DEPENDENTS and nothing changes”. Ownership cases are also listed under FP-SEC-1. |
| FP-EMP-3 | [Application service](backend/src/applications/service.ts), [employer applicants page](frontend/src/pages/EmployerApplicantsPage.tsx) | [employer.test.ts](testing/src/unit/employer.test.ts) — “lists applicants sorted by match score, highest first”, “each row shows identity, skills, score, status and interview booking”, parameterized “the owner can set %s”, “another employer cannot change the status (403)”. |
| FP-MATCH-1 | [Shared scoring and sorting](backend/src/matching/index.ts), [skill normalization](backend/src/lib/skills.ts) | [matching.test.ts](testing/src/unit/matching.test.ts) — “example 1: Python, SQL vs Python, SQL scores 100”, “example 2: Python vs Python, SQL scores 50”, “example 3: Rust vs Python, SQL scores 0”, “example 4: any skills vs an empty required list scores 100”, “breaks equal scores by case-insensitive title, so "apple" sorts before "Banana"”, “breaks equal score and equal title (any case) by job id”, “breaks equal scores by case-insensitive candidate display name”, “breaks equal score and equal name (any case) by candidate id”. |
| FP-MATCH-2 | N/A | N/A |
| FP-SCHED-1 | [Scheduling service](backend/src/scheduling/service.ts), [overlap constraint](backend/prisma/migrations/20261029160000_slot_no_overlap/migration.sql), [employer availability page](frontend/src/pages/EmployerAvailabilityPage.tsx) | [scheduling.test.ts](testing/src/unit/scheduling.test.ts) — “creates a future 30-minute slot owned by the caller, returned as UTC ISO strings”, “rejects end before start”, “refuses to delete a booked slot with 409 SLOT_BOOKED and leaves it in place”; [open-bugs.test.tsx](testing/src/regression/open-bugs.test.tsx) — “(FP-SCHED-1): POST /api/employers/me/availability rejects duplicate identical slots for the same employer”. |
| FP-SCHED-2 | [Scheduling service](backend/src/scheduling/service.ts), [candidate booking page](frontend/src/pages/CandidateBookInterviewPage.tsx) | [scheduling.test.ts](testing/src/unit/scheduling.test.ts) — “links the application to the slot, marks it booked, and returns the updated application”, “is 404 for a missing slot and for a slot owned by a different employer”, “rejects a slot in the past with 409 SLOT_IN_PAST”, “keeps the booking and the slot unavailable after the application leaves Interviewing”. |
| FP-SCHED-3 | [Booking transaction](backend/src/scheduling/service.ts), [unique slot link](backend/prisma/schema.prisma) | [scheduling.test.ts](testing/src/unit/scheduling.test.ts) — “two eligible candidates race for one slot: exactly one wins, the other gets 409 "Slot already booked"”, “the loser's application is left untouched”, “booking takes row locks on the application and then the slot, in that order, inside one transaction”. [Live concurrency suite](testing/src/live-pg/concurrency.live.test.ts) covers database lock waits. |
| FP-SEC-1 | [Auth middleware](backend/src/middleware/auth.ts), [profiles](backend/src/profiles/service.ts), [jobs](backend/src/jobs/service.ts), [applications](backend/src/applications/service.ts), [scheduling](backend/src/scheduling/service.ts) | [authorization.test.ts](testing/src/unit/authorization.test.ts) — “each candidate's profile endpoint returns only their own resume”, “a profile update by Bob changes only Bob's row, whatever ids the body carries”, “Bob cannot read Alice's application by id (403 on available-slots)”, “a candidate cannot change any application status, including their own (403)”, “PUT another employer's job is 403 and the job is unchanged”, “GET another employer's applicant list is 403 and discloses no applicant”, “Bob booking with Alice's application id is 403 and nothing is linked”. |
| FP-SEC-2 | [Prisma client](backend/src/lib/prisma.ts), [booking transactions](backend/src/scheduling/service.ts) | [sql-injection.test.ts](testing/src/unit/sql-injection.test.ts) — “an email containing SQL metacharacters reaches the lookup as one exact bound value”, “every raw statement the booking flow issues carries its ids as bound values, not in the SQL text”. |
| FP-SEC-3 | [Job detail panel](frontend/src/components/jobs/JobDetailPanel.tsx), [candidate profile page](frontend/src/pages/CandidateProfilePage.tsx) | [xss.test.tsx](testing/src/frontend/xss.test.tsx) — “JobDetailPanel shows the payload as visible text, not as a `<script>` element”, “shows the hostile display name and job title as text and creates no executable markup”. |
| FP-SEC-4 | [Backend config](backend/src/config.ts), [environment template](backend/.env.example), [test fixtures](testing/src/support/fakePrisma.ts) | [static-checks.test.ts](testing/src/unit/static-checks.test.ts) — “only .env.example files are tracked by git (no real .env is committed)”, “rejects a missing JWT_SECRET”. The live suite uses a disposable test database. |
| FP-PROC-1 | [Living specification](SPEC.md), [API contract](Contract/API_Contract.md), [design records](specs/) | Compare the specification to the router, Prisma schema, and services at the graded commit. |
| FP-DOC-1 | [Installation instructions](INSTALL.md) | The [Docker instructions](INSTALL.md#8-docker) cover building from source, applying migrations, demo seeding, and running the test suites. |
| FP-DOC-2 | [README.md](README.md) | Review the overview, installation link, demo accounts, limitations, and this mapping. |
| FP-DOC-3 | [Seed runner](backend/prisma/seed.ts), [seed SQL](backend/prisma/sql/seed.sql) | [seed.test.ts](testing/src/unit/seed.test.ts) — “includes at least two candidates and two employers with valid bcrypt hashes for password123”, “includes at least two jobs with non-empty required skills”, “includes the four required FP-MATCH-1 examples against seeded candidates and jobs”, “includes applications covering all four statuses (Pending, Interviewing, Rejected, Accepted)”, “includes two Interviewing candidates without bookings eligible to race for the same available slot”. |
| FP-TEST-1 | [Vitest configuration](testing/vitest.config.ts), [test command](testing/package.json) | Run `npm --prefix testing test`. The named functional cases appear in this table. |
| FP-SUB-1 | [Submission protocol](reference/REQUIREMENTS.md#10-submission-protocol), [Docker instructions](INSTALL.md#8-docker) | [GitHub Actions](.github/workflows/verify.yml) runs the test suites and builds the Docker image from `main`. The course submission uses the permanent commit URL. |

## Required deliverables checklist

From [`reference/REQUIREMENTS.md`](reference/REQUIREMENTS.md). All must be on `main` at the graded commit.

- [x] Browser UI for both roles in `frontend/`
- [x] API enforcing business rules and authorization in `backend/`
- [x] PostgreSQL migrations
- [x] One seed command with at least two candidates, two employers, two jobs with skills, the four match-score examples, all four application statuses, and two `Interviewing` candidates able to race for one slot
- [x] Unit tests for each functional requirement, including authorization outcomes and object access, the match examples and tie-breaks, SQL parameter binding, XSS rendering, and booking conflicts
- [x] One test command that exits nonzero on failure
- [x] `Dockerfile` that builds and runs the full environment from a clean checkout
- [x] `INSTALL.md`: prerequisite versions, install, env vars, DB setup, seed, run, test, Docker commands, troubleshooting
- [x] `SPEC.md`: architecture, data model, auth design, API routes, UI screens, matching, booking transaction, security controls
- [x] `.env.example` with placeholders only; no real secrets or personal data in the repo
- [x] [Audit issue template](.github/ISSUE_TEMPLATE/audit_bug_report.yml)
- [ ] Audit labels from `reference/templates/github/` enabled on GitHub
- [ ] Repository public before the Week 12 audit window

## Documents

| Document | Purpose |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Rules for AI coding agents |
| [`Contract/API_Contract.md`](Contract/API_Contract.md) | API routes and response shapes |
| [`Contract/API_Status.md`](Contract/API_Status.md) | Per-endpoint implementation status (frontend/backend) |
| [`Contract/Database_schema.md`](Contract/Database_schema.md) | Database tables and relationships |
| [`specs/`](specs/TEMPLATE.md) | Write-ups for contract changes: problem, what changed, why |
| [`reference/REQUIREMENTS.md`](reference/REQUIREMENTS.md) | Graded product requirements |
| [`reference/PEER_REVIEW.md`](reference/PEER_REVIEW.md) | Cross-team audit procedure |
| [`reference/DOCKER.md`](reference/DOCKER.md) | Docker build/run guidance |
| [`INSTALL.md`](INSTALL.md) | Setup, run, test, and push instructions |
| [`SPEC.md`](SPEC.md) | Living specification |

## Known limitations

- Candidate saved jobs are stored in the browser and stay on that browser.
- Resumes support raw text.
- Sessions use a fixed token lifetime. Logging out clears the browser session. An already-issued token remains valid until expiration as long as the account and role still match.
- The current Docker setup starts PostgreSQL in a separate container.

## License

[MIT](LICENSE)
