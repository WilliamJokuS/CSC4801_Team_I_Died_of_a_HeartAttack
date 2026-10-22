# Frontend handoff

Written by William (backend) for Ean Jie (frontend) and their agent. Everything the frontend needs to connect to the backend, plus suggested UI/UX features. Read [`AGENTS.md`](../AGENTS.md) first; the troubleshooting table there covers setup errors.

## 1. Status

All 25 routes in [`Contract/API_Contract.md`](../Contract/API_Contract.md) are implemented and tested ([`Contract/API_Status.md`](../Contract/API_Status.md)). Response shapes are defined in:

| Spec | Defines |
|---|---|
| [`specs/001`](../specs/001-authuser-shape.md) | `AuthUser`, auth error codes |
| [`specs/002`](../specs/002-profile-and-job-shapes.md) | `CandidateProfile`, `CompanyProfile`, `Job`, validation limits |
| [`specs/003`](../specs/003-application-and-scheduling-shapes.md) | `ScoredJob`, `Application`, `ScoredApplication`, `AvailabilitySlot`, booking error codes |
| [`specs/004`](../specs/004-job-tags-and-ui-fields.md) | Job `tags` and `company_description`, `EmployerJob.applicant_count`, `EmployerSlot.booking` |

The specs still need Ean Jie's and Duston's agreement before `API_Contract.md` is updated, but the backend already returns exactly these shapes.

## 2. Run the backend locally

```bash
cd backend
npm ci
cp .env.example .env            # then set JWT_SECRET (>= 32 chars, see AGENTS.md):
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
docker compose -f docker-compose.dev.yml up -d   # Postgres
npm run migrate                 # apply migrations
npx prisma db seed              # reset + demo data
npm run dev                     # http://localhost:8080/api
```

Re-run `npx prisma db seed` any time to reset the data.

**Demo accounts** (local only, password `password123` for all):

| Role | Emails | Useful for |
|---|---|---|
| Candidate | `alice@demo.test` (python, sql) | Scores 100 on "Data Analyst"; `Interviewing`, can book an Acme slot |
| Candidate | `bob@demo.test` (python) | Scores 50; also `Interviewing` at Acme, so he races Alice for the same slots |
| Candidate | `chen@demo.test` (rust) | Scores 0; a `Rejected` application |
| Candidate | `ethan@demo.test` | Already has a booked interview |
| Candidate | `julia@demo.test` | No skills; empty profile and resume |
| Candidate | `diana@`, `fatima@`, `gabriel@`, `hannah@`, `ivan@demo.test` | Other skill sets and statuses (`Pending`, `Accepted`, ...) |
| Employer | `hr@acme.demo.test` | 5 jobs; `Interviewing`, `Rejected` and `Accepted` applicants; 2 open slots |
| Employer | `hr@northwind.demo.test`, `hr@harbor.demo.test` | 5 jobs each; a booked slot at Northwind |

## 3. Connect the frontend

A working, unstyled reference frontend is on branch **`william/minimal-frontend`**. Copy these into your `frontend/` instead of writing fetch code:

| Copy | What it gives you |
|---|---|
| `frontend/src/api/client.ts` | `request()`: adds the bearer token, sends/parses JSON, turns the `{ error: { code, message } }` envelope into an `ApiError` (`status`, `code`, `message`), clears the session on `401` |
| `frontend/src/api/endpoints.ts` | One typed function per route: `authApi`, `profileApi`, `jobsApi`, `applicationsApi`, `schedulingApi`, `systemApi` |
| `frontend/src/types/index.ts` | Every request and response type |
| `server.proxy` in `frontend/vite.config.ts` | Forwards `/api` to `http://localhost:8080` in dev, so there's no CORS setup |

```bash
git fetch origin
git checkout origin/william/minimal-frontend -- frontend/src/api frontend/src/types
```

Then pages call e.g. `await jobsApi.listScored()` and catch `ApiError`. The reference pages in `frontend/src/pages/` show each call in use.

## 4. Rules the UI must follow

- **XSS (FP-SEC-3, graded):** render user text (names, resume, job and company text, skills, tags) only as JSX text `{value}`. Never use `dangerouslySetInnerHTML` with it. Don't HTML-escape it yourself either: the backend stores text as typed, and React escapes once (`SPEC.md` §8).
- **Dashboard order (FP-CAN-2, graded):** `GET /api/jobs` comes back already sorted (score, then title, then id). Filtering is fine; re-sorting it is not.
- **Applicant order (FP-EMP-3, graded):** `GET /api/jobs/{id}/applicants` is also pre-sorted. Keep it.
- **Editing a job:** `PUT /api/jobs/{id}` replaces the whole job. Always send `title`, `description`, `required_skills` **and `tags`**, or the tags are cleared.
- **Booking conflicts (FP-SCHED-3, graded):** `POST /api/applications/{id}/book` can return `409 SLOT_TAKEN` "Slot already booked" when someone else got the slot first. Show a message and reload the slot list.
- **Time zones (FP-SCHED-1):** the API sends and expects ISO 8601 UTC (`2027-01-11T02:00:00Z`). Send `Date.toISOString()`; display in local time with the zone shown. Slots are exactly 30 minutes: compute `end_time = start + 30 min`.
- **Don't rely on hidden buttons for security:** the backend enforces roles and ownership. Hiding things in the UI is only for UX.

## 5. Error codes → user-facing messages

`ApiError.code` is stable; map it to friendly text in one place:

| Code | Status | Suggested message |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Show `message`; it names the field |
| `INVALID_JSON` | 400 | "Something went wrong. Please try again." |
| `UNAUTHORIZED` | 401 | "Your session has expired. Please log in again." (redirect to login) |
| `INVALID_CREDENTIALS` | 401 | "Wrong email or password." |
| `FORBIDDEN` | 403 | "You don't have access to this." |
| `NOT_FOUND` | 404 | "This item no longer exists." |
| `EMAIL_TAKEN` | 409 | "An account with this email already exists." |
| `ALREADY_APPLIED` | 409 | "You've already applied to this job." |
| `JOB_HAS_DEPENDENTS` | 409 | "This job has applicants, so it can't be deleted." |
| `SLOT_BOOKED` | 409 | "This slot is booked, so it can't be deleted." |
| `NOT_INTERVIEWING` | 409 | "You can book an interview once the employer moves you to Interviewing." |
| `ALREADY_BOOKED` | 409 | "You've already booked an interview for this application." |
| `SLOT_TAKEN` | 409 | "Someone just booked that slot. Please pick another." |
| `SLOT_IN_PAST` | 409 | "That time has passed. Please pick another slot." |
| `PAYLOAD_TOO_LARGE` | 413 | "That's too much text." |
| `NETWORK_ERROR` | — | "Can't reach the server." (set by `client.ts`, not the backend) |

## 6. Recommended UI/UX features

Suggestions only; the design is Ean Jie's call. Each says whether the data already exists.

### Candidate

| Feature | Data | Notes |
|---|---|---|
| **Skill chips with match highlighting** on job cards: green = candidate has it, grey = missing | Available (`required_skills` + candidate `skills` from `GET /candidates/me/profile`) | Highest value: explains the score ("2 of 3 skills") instead of a bare number |
| **Match-score badge**, coloured by range (e.g. 80+ green, 50–79 amber, <50 grey) | Available (`match_score`) | |
| **Job cards** instead of a table: title, company, score, skill chips, tags | Available | |
| **Job tags** as chips, plus a tag filter (Remote, Full-time, ...) | Available (spec 004 `tags`) | Filter client-side; keep the server's order |
| **Search box** over title, company, skills | Available | Client-side filter |
| **Job detail** panel or page with full description and company description | Available (spec 004 `company_description`) | |
| **"Applied" state** on cards | Available (`has_applied`) | Disable Apply when true |
| **Status badges** on applications: Pending / Interviewing / Rejected / Accepted | Available | |
| **"Book your interview" prompt** when status is `Interviewing` and there's no booking | Available (`status`, `interview_slot`) | |
| **Slot picker** grouped by day, with a confirm step | Available (`GET /applications/{id}/available-slots`) | Handle `409 SLOT_TAKEN` by reloading |
| **Skill tag input** on the profile (Enter or comma makes a chip) | Available | Max 50 skills, 50 chars each |
| **Resume character counter** | — | Limit 20,000 characters |

### Employer

| Feature | Data | Notes |
|---|---|---|
| **Job cards with applicant count** | Available (spec 004 `applicant_count` on `GET /jobs/mine`) | |
| **Disable "Delete" when `applicant_count > 0`**, with a tooltip | Available | Still handle `409 JOB_HAS_DEPENDENTS`: an application can arrive after the page loaded |
| **Tag editor** on the job form | Available (spec 004) | Max 10 tags, 30 chars each; send them on every `PUT` |
| **Applicant list** with status badges, status filter, and matched/missing skill chips | Available (`candidate.skills`, `match_score`, `status`) | Keep the server's order |
| **Confirm before Rejected/Accepted** | — | UI only |
| **Weekly calendar** for availability: click a time to create a 30-minute slot | Available | |
| **Show who booked each slot** (candidate name and job) | Available (spec 004 `booking` on `GET /employers/me/availability`) | |

### Everywhere

| Feature | Notes |
|---|---|
| Toast notifications for success and errors | Use the table in §5 |
| Loading skeletons and helpful empty states | e.g. "No jobs match your skills yet — add skills to your profile" |
| Real URLs with React Router | Back button, refresh and shareable job links work |
| Show the time zone on every time | FP-SCHED-1 asks for unambiguous times |
| Client-side form validation matching the backend | Password 8–72 bytes, required fields, the limits above |
| Mobile layout: stacked cards instead of tables | |

### If you need more from the backend

Don't work around a missing field in the frontend. Write a `specs/NNN-...md` entry (see `AGENTS.md` "Changing the API contract") or ask William.
