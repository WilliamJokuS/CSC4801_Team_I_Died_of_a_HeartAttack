# AGENTS.md

Rules for AI coding agents (Claude Code, MiMo, etc.) working in this repository. Read this file before making any change.

## Team roles and folder ownership

Each team member owns exactly one folder. An agent working for a team member **may only create, edit, or delete files inside that member's folder**.

| Person | Name | Role | May edit |
|---|---|---|---|
| A | Ean Jie | Frontend | `frontend/` only |
| B | William | Backend | `backend/` only |
| C | Duston | Testing / bug finding | `testing/` only |

Rules:

1. Before editing, confirm which person you are working for. If it is not clear, **ask** — do not guess.
2. Never modify files outside your owner's folder, even to "fix" something small. If a change is needed elsewhere, stop and tell the user what should change and which person owns it.
3. If your owner's folder (`frontend/`, `backend/`, or `testing/`) doesn't exist yet, create it and scaffold the project inside it (e.g. `npm create vite@latest`, or an equivalent init command). That's normal for the first task in that folder, not something to ask about — just follow the tech stack below and the shapes in `Contract/`.
4. Reading any file in the repository is allowed. Only writing is restricted.
5. Shared files at the repository root (`README.md`, `AGENTS.md`, `Dockerfile`, `INSTALL.md`, `SPEC.md`, `.env.example`, `.gitignore`) and everything in `Contract/` are edited only when the user explicitly asks for that specific file. Changes to `Contract/` (the API contract and database schema) must be agreed by all three members first — see "Changing the API contract" below. Writing a new file in `specs/` is always allowed (that's how a change gets proposed); editing an existing `specs/` file after it's written is not, treat it as a record.
6. The testing agent (Duston) reports bugs found in `frontend/` or `backend/` to the owner; it does not fix them in place.

## Changing the API contract

`Contract/API_Contract.md` and `Contract/Database_schema.md` are the fixed interface both `frontend/` and `backend/` build against. Neither side edits them without first writing a spec.

If Ean Jie (frontend) needs a new field, endpoint, or a changed response shape from the backend — or if William (backend) wants to change something the frontend already depends on — do this instead of editing the contract directly:

1. Copy [`specs/TEMPLATE.md`](specs/TEMPLATE.md) to `specs/NNN-short-name.md` (next unused 3-digit number, e.g. `001-job-search-filter.md`) and fill it in, with the date at the top: the problem, what needs to change, and why.
2. Update `API_Contract.md` (and `Database_schema.md` if tables change) to match the spec, then implement.
3. Update the endpoint's row in [`Contract/API_Status.md`](Contract/API_Status.md) to reflect the new state.

An agent asked to add or change an API endpoint should check `Contract/API_Status.md` first, write the spec, then follow this process rather than editing `API_Contract.md` directly with no record of why.

## Git: no automatic commits

- **Never run `git commit`, `git push`, `git merge`, `git rebase`, or `git reset` on your own.** Only do so when the user explicitly asks in that message.
- Leave all changes uncommitted in the working tree so the owner can review them.
- Never force-push, and never rewrite history on `main`.
- When the user does ask for a commit, stage only files inside the owner's folder.

## Tech stack

- Language: **TypeScript** (JavaScript where a tool requires it).
- Frontend: React + Vite + Tailwind CSS.
- Backend: Node.js + TypeScript REST API under `/api`.
- Database: PostgreSQL (see `Contract/Database_schema.md`).
- The API shapes in `Contract/API_Contract.md` are the shared interface between frontend and backend. Build to them; don't invent new shapes.

## Engineering rules

1. Read the relevant code, callers, tests, and `Contract/` docs before editing.
2. Prefer small, targeted changes over rewrites. Don't change unrelated behavior.
3. Never hard-code secrets, credentials, or real personal data. `.env.example` contains placeholders only.
4. Enforce role and ownership checks on the server (`401` / `403` / `404` / `409` as specified in `reference/REQUIREMENTS.md` FP-AUTH-3).
5. Use parameterized queries or an ORM. Never build SQL by string concatenation.
6. Escape user-controlled text when rendering, and do it in `frontend/` only — via React's default JSX escaping, never `dangerouslySetInnerHTML` with user input. Don't add HTML-escaping in `backend/`; store text as submitted. See `SPEC.md` §8 for why (double-escaping).
7. The match score (FP-MATCH-1) has exactly one implementation, used by both candidate and employer views.
8. Treat authentication, authorization, job/application state, and booking as high-risk areas.

## Testing rules

- Unit tests must exercise the real business logic and assert observable outcomes. No placeholder or `pass`-style tests.
- Don't delete, skip, or weaken a test to make a change pass.
- Tests must not call real third-party or paid services. Use mocks or fakes.
- Tests that use a database must use an isolated test database, never a shared or production one.
- Every requirement ID in `reference/REQUIREMENTS.md` must map to named tests in the `README.md` table.

### Testing across folders

`testing/` is its own npm project, but most of what FP-TEST-1 requires (matching, booking conflict handling, authorization, SQL-injection safety) is logic that lives in `backend/`, and the FP-SEC-3 XSS test targets a component in `frontend/`. `testing/` is allowed to import source files from `backend/src` and `frontend/src` directly by relative path (e.g. `import { calculateScore } from '../../backend/src/matching'`) — that is reading, not editing, and reading any folder is always allowed (rule 4 above). Configure the test runner (Jest/Vitest) in `testing/` to transpile/resolve TypeScript outside its own directory rather than mocking the logic under test or reimplementing it — a reimplementation doesn't satisfy "exercise the team's actual business logic."

No npm workspace is used for this (see `specs/` for that discussion if it changes); the three projects stay independently `npm ci`-able per `INSTALL.md`, `testing/` just reaches across via relative imports for its own test files.

## Troubleshooting common errors

Check this table before changing code to "fix" one of these. Most are local setup, not bugs.

| Symptom | Cause | Fix |
|---|---|---|
| Backend exits on start: `JWT_SECRET must be at least 32 characters` | `backend/.env` still has the `change-me` placeholder or another short secret | Generate one and put it in `backend/.env` (see below). Do **not** weaken or remove the check. |
| Backend exits on start: `Missing required environment variable ...` | No `backend/.env` | `cp backend/.env.example backend/.env`, then set `JWT_SECRET` |
| Every request returns `401 UNAUTHORIZED` right after logging in worked before | The backend's `JWT_SECRET` changed (or you switched to another person's backend), so old tokens no longer verify | Log out and log in again. Expected behavior, not a bug. |
| Frontend shows `HTTP_502` / `Bad Gateway` | The Vite dev proxy is up but the backend isn't running on port 8080 | Start it: `cd backend && npm run dev` |
| `503 DB_UNAVAILABLE`, or Prisma can't connect | Postgres isn't running | `cd backend && docker compose -f docker-compose.dev.yml up -d` |
| `500` / Prisma error mentioning a missing column (e.g. `tags`) | Your database is behind the committed migrations | `cd backend && npm run migrate` |
| Demo logins fail with `401 INVALID_CREDENTIALS` | Database not seeded, or reset since | `cd backend && npx prisma db seed` (demo password `password123`) |

### `JWT_SECRET`: what it is

Login returns a JWT: a token saying "user X, role Y, valid 24h", plus a signature computed from those contents and `JWT_SECRET`. The backend recomputes the signature on every request, so a token whose user or role was edited is rejected with `401`. That only holds while the secret is secret: with a known secret (such as the placeholder in `.env.example`, which is public on GitHub), anyone can sign a valid token for any user and role. That is why the backend refuses to start with a secret under 32 characters.

Rules:

- Each person generates their **own** secret for their local `backend/.env`:
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- Never commit a real secret, never put one in `.env.example`, and never share secrets between teammates. The frontend never needs it: it only stores and sends the token.
- Changing the secret logs everyone out (old tokens fail with `401`). That is expected.
- The `Dockerfile` must generate a random secret at container start, not bake one into the image or the repo.
- Unit tests pass their own secret to `createApp(...)` (`backend/src/app.ts`) and don't read `.env`.

## Before finishing a task

Report to the user:

- what changed (files, all inside the owner's folder)
- tests added or updated
- test commands run and whether they passed
- anything outside the owner's folder that needs to change, and who owns it

Do not claim tests passed if they were not run.
