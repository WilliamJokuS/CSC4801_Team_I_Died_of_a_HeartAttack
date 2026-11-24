# Frontend response to bug report (for Duston)

- **Date:** 2026-11-24
- **From:** Ean Jie (frontend)
- **Report audited at:** `2985f60`
- **Fix commit:** `3e44f00`: Fix BUG-FE-18: reload page state after 409/404 conflicts

## Summary

| Item | Status |
|---|---|
| BUG-FE-18a: availability delete `409 SLOT_BOOKED` | Fixed, test passes |
| BUG-FE-18b: booking `409 SLOT_IN_PAST` and other 409/404 | Fixed, test passes |
| BUG-FE-18c: dashboard delete `409 JOB_HAS_DEPENDENTS` | Fixed, test passes |
| BUG-FE-18d: apply `409 ALREADY_APPLIED` | Fixed in the frontend. **The test needs a change in `testing/`** (see below) |
| V-DOC-1: `SLOT_OVERLAP` mapping in `apiErrorMessage.ts` | **Not changed.** It conflicts with your existing unit tests (see below) |

## What changed

`frontend/src/lib/apiErrorMessage.ts` has a new helper, `isStaleStateError(err)`. It returns true for an `ApiError` with status 409 or 404.

In each page below, the catch branch now calls the page's load function with `{ silent: true }`. A silent reload refreshes the data in place, without the full-page loading screen, and keeps the error message visible.

- `EmployerAvailabilityPage.tsx`: when a delete fails with 409/404, the slots reload. A slot that was booked meanwhile then shows "Booked by …" with Delete disabled.
- `CandidateBookInterviewPage.tsx`: every 409 (`SLOT_TAKEN`, `SLOT_IN_PAST`, `NOT_INTERVIEWING`, `ALREADY_BOOKED`) and every 404 clears `selectedSlotId` and reloads. Before this fix, only `SLOT_TAKEN` did.
- `EmployerDashboardPage.tsx`: when a delete fails with 409/404, the jobs reload. A silent reload doesn't clear `actionError`.
- `CandidateJobsView.tsx`: `ALREADY_APPLIED` sets `has_applied: true` on that job at once (the button changes to "Already applied" and is disabled), then the jobs reload. On a 404, the jobs also reload.

## Requests for `testing/`

### 1. BUG-FE-18d fails at its own wait step

`open-bugs.test.tsx:1212`:

```ts
await findByText(/already applied/i);
```

This throws `TestingLibraryElementError: Found multiple elements with the text: /already applied/i`. The page shows the message in two places by design: the toast and the inline error in the job panel. After the fix, the button text "Already applied" also matches. The test fails the same way on `2985f60` without my change, so this step can never pass.

Suggested change:

```ts
await findAllByText(/already applied/i);
```

The assertion after it (the Apply button is gone or disabled) should then pass.

### 2. `SLOT_OVERLAP`: the report and the unit tests disagree

The report asks for a friendly `SLOT_OVERLAP` message in `apiErrorMessage.ts`. I added one, and two of your unit tests then failed, because they require the server's message to be passed through as is:

- `testing/src/frontend/auth-and-routing.test.tsx:446` expects `apiErrorMessage(...)` to return `'You already have a slot that overlaps this time'`.
- `testing/src/frontend/pages-coverage.test.tsx:846` expects the page to show `/overlaps this time/i`.

The server's message is already user-friendly, so I reverted the mapping and kept your tests as they are. If you agree, please drop V-DOC-1 (frontend share) from the report. If you do want a custom message, update those two tests first, and I'll add the mapping.

## Test results at `3e44f00`

- `npx tsc -b` (in `frontend/`): passes
- `npm run lint` (in `frontend/`): 0 errors, 18 warnings
- `npm --prefix testing test`: 406/406 pass
- `npm --prefix testing run test:bugs`: BUG-FE-1 to BUG-FE-18c pass, and BUG-FE-18d fails as described above. The other 7 failures are backend (BUG-BE-7 to 11) and shared (BUG-SH-1/2), not frontend.
