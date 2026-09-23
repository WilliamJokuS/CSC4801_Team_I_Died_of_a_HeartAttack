# CSC4801 Recruiting & Candidate Matching Platform

A full-stack recruiting platform built for the CSC4801 final project. Candidates find and apply to jobs ranked by how well their skills match. Employers post jobs, review applicants sorted by match score, and publish interview slots. Candidates book those slots safely, even when two people try to book the same one at once.

Built with **TypeScript / JavaScript**.

> Status: in development. Sections marked **TODO** must be filled in before feature freeze (Week 11).

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
- Create, view, edit, and delete own job postings (delete blocked with `409` if applications or slots exist)
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
| Tests | Unit tests (TypeScript) | `testing/` |
| Deployment | Single `Dockerfile` that builds and runs everything | repo root |

- Auth: JWT bearer tokens; passwords hashed with bcrypt or argon2.
- Every protected route checks role and ownership on the server (`401` unauthenticated, `403` wrong role/owner, `404` missing, `409` conflict).
- Booking is atomic at the database layer: `applications.interview_slot_id` is `UNIQUE`, so only one of two concurrent bookings can succeed. The loser gets `409 Slot already booked`.

Full API routes: [`Contract/API_Contract.md`](Contract/API_Contract.md). Tables and relationships: [`Contract/Database_schema.md`](Contract/Database_schema.md).

## Quick start

See [`INSTALL.md`](INSTALL.md) for prerequisites, environment variables, the full setup, and what not to push.

```bash
# TODO: confirm once the Dockerfile exists
docker build -t csc4801 .
docker run -p 8080:8080 csc4801
```

## Demo accounts

Local/demo credentials only, created by the seed command. Not real users.

| Role | Email | Password |
|---|---|---|
| Candidate | TODO | TODO |
| Candidate | TODO | TODO |
| Employer | TODO | TODO |
| Employer | TODO | TODO |

Seed command: **TODO**

## Running tests

```bash
# TODO: confirm the exact command
npm test
```

The command runs the full unit-test suite non-interactively and exits nonzero on failure.

## Requirement–test mapping

Every requirement ID must map to its implementation files and named unit tests. **TODO: fill in as features land.**

| Requirement | Description | Implementation file(s) | Unit tests |
|---|---|---|---|
| FP-ARCH-1 | Full-stack boundary | | |
| FP-AUTH-1 | Accounts (register/login/logout, unique email) | | |
| FP-AUTH-2 | Password hashing, no secrets returned | | |
| FP-AUTH-3 | Server-side authorization (401/403/404) | | |
| FP-CAN-1 | Candidate profile and private resume | | |
| FP-CAN-2 | Recommendations sorted by match score | | |
| FP-CAN-3 | Apply once, view own applications | | |
| FP-EMP-1 | Company profile | | |
| FP-EMP-2 | Job CRUD, 409 on delete with dependents | | |
| FP-EMP-3 | Applicant list and status changes | | |
| FP-MATCH-1 | Skill-overlap score and tie-breaking | | |
| FP-MATCH-2 | Optional AI enhancement | | N/A |
| FP-SCHED-1 | 30-minute availability slots | | |
| FP-SCHED-2 | Booking eligibility | | |
| FP-SCHED-3 | Atomic booking, `409 Slot already booked` | | |
| FP-SEC-1 | Object access (no ID tampering) | | |
| FP-SEC-2 | SQL injection | | |
| FP-SEC-3 | Cross-site scripting | | |
| FP-SEC-4 | Secrets and test isolation | | |
| FP-PROC-1 | Living specification (`SPEC.md`) | | |
| FP-DOC-1 | `INSTALL.md` | | |
| FP-DOC-2 | This README | | |
| FP-DOC-3 | Deterministic seed data | | |
| FP-TEST-1 | Automated unit tests | | |
| FP-SUB-1 | Commit URL + Dockerfile | | |

## Required deliverables checklist

From [`reference/REQUIREMENTS.md`](reference/REQUIREMENTS.md). All must be on `main` at the graded commit.

- [ ] `frontend/`: browser UI for both roles
- [ ] `backend/`: API enforcing business rules and authorization
- [ ] PostgreSQL migrations
- [ ] Seed script (one command) with: 2 candidates, 2 employers, 2 jobs with skills, the 4 match-score examples, applications in all 4 statuses, 2 `Interviewing` candidates able to race for one slot
- [ ] `testing/`: unit tests for every functional requirement, including the 401/403/404 cases, the 4 score examples and both tie-breaks, the FP-SEC-1 boundaries, a SQL-injection test, an XSS test (`<script>alert(1)</script>`), and booking-conflict handling
- [ ] One test command that exits nonzero on failure
- [ ] `Dockerfile` that builds and runs the full environment from a clean checkout
- [ ] `INSTALL.md`: prerequisite versions, install, env vars, DB setup, seed, run, test, Docker commands, troubleshooting
- [ ] `SPEC.md`: architecture, data model, auth design, API routes, UI screens, matching, booking transaction, security controls
- [ ] `.env.example` with placeholders only; no real secrets or personal data in the repo
- [ ] Audit issue template and labels from `reference/templates/github/` enabled on GitHub
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
| [`SPEC.md`](SPEC.md) | Living specification (skeleton — fill in as features land) |

## Known limitations

- **TODO:** list before submission.

## License

[MIT](LICENSE)
