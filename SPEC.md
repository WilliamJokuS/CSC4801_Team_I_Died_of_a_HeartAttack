# SPEC

Living specification for the recruiting and candidate matching platform. Required by `reference/REQUIREMENTS.md` FP-PROC-1: this document must describe the architecture, data model and relationships, authentication/authorization design, API routes or server actions, major UI screens, matching contract, booking transaction, and security controls, and must match the graded commit — keep it updated as the system is built, not written once at the end.

The requirement–test mapping lives in `README.md`, not here (FP-DOC-2).

> Status: skeleton only. Fill in each section as the corresponding part is built. An empty section below is a known gap, not a decision.

## 1. Architecture

<!-- Overall system shape: frontend, backend, database, how they're deployed together. Diagram optional. -->

## 2. Data model and relationships

<!-- Summarize the tables in Contract/Database_schema.md and how they relate. Link to it rather than duplicating the full column list. -->

See [`Contract/Database_schema.md`](Contract/Database_schema.md).

## 3. Authentication and authorization design

<!-- JWT flow, token lifetime (see Contract/API_Contract.md), password hashing, how role/ownership checks are enforced server-side (FP-AUTH-3). -->

## 4. API routes / server actions

<!-- Link to the contract; note here only what needs more explanation than a route table gives. -->

See [`Contract/API_Contract.md`](Contract/API_Contract.md) and [`Contract/API_Status.md`](Contract/API_Status.md) for current implementation status.

## 5. Major UI screens

<!-- One entry per screen: candidate dashboard, job detail, employer applicant list, etc. -->

## 6. Matching contract

<!-- Where the FP-MATCH-1 scoring function lives, and confirmation both candidate and employer views call the same implementation. -->

## 7. Booking transaction

<!-- How FP-SCHED-3 atomicity is implemented (transaction + row lock / unique constraint), and what happens on a lost race. -->

## 8. Security controls

<!-- SQL injection prevention (parameterized queries / Prisma), secrets handling, rate limiting if any. -->

**SQL injection (FP-SEC-2):** all queries go through Prisma; no raw string-concatenated SQL.

**XSS (FP-SEC-3): resolved.** Escaping happens once, at render time, in `frontend/` — not on write in `backend/`.

- `backend/` stores resume, skills, company, and job text exactly as submitted (only non-empty/length validation, no HTML escaping on write).
- `frontend/` renders all user-controlled text as JSX text (`{text}`), which React escapes by default. `dangerouslySetInnerHTML` is never used on user-controlled text.
- Rationale: escaping on write and again on render (React's default) double-encodes and corrupts the displayed text (e.g. `&lt;script&gt;` shown literally instead of the user's actual content). Escaping exactly once, at render, avoids that class of bug. If the product ever needs to support user-submitted formatted HTML, that requires an allow-list sanitizer (e.g. DOMPurify) per FP-SEC-3 — out of scope unless a `specs/` entry adds it.
- Required unit test (`<script>alert(1)</script>`) is a **frontend component test** — render a component that displays user text (e.g. job description, resume, skills) with that payload as the prop/data value and assert the DOM contains no `<script>` element, only escaped text. Lives in `testing/`, importing the component from `frontend/src` (see `AGENTS.md` "Testing across folders").

## 9. Optional AI enhancement (FP-MATCH-2)

<!-- If implemented: what it does, and the data-flow documentation required when user text is sent to an LLM. If not implemented, mark N/A here and in the README mapping table. -->
