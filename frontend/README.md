# Frontend

Owned by: Ean Jie

> **Placeholder UI** (branch `william/minimal-frontend`): a deliberately unstyled React + Vite app so the
> backend can be exercised end-to-end before the real design lands. The design work replaces
> `src/pages/`, `src/App.tsx`, and `src/index.css`. Keep `src/api/` and `src/types/`.

## Run

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173, /api proxied to http://localhost:8080
npm run build      # type-check + production build into dist/
```

Set `VITE_API_PROXY` to point the dev proxy at a different backend, or `VITE_API_BASE_URL` to call an
absolute API URL instead of the relative `/api`.

## Layout

| Path | Purpose |
|---|---|
| `src/types/index.ts` | API shapes from `Contract/` and `specs/001`–`specs/003` |
| `src/api/client.ts` | `request()`: bearer token, JSON, turns the `{ error: { code, message } }` envelope into `ApiError`, clears the session on `401` |
| `src/api/endpoints.ts` | One typed function per contract route (`authApi`, `profileApi`, `jobsApi`, `applicationsApi`, `schedulingApi`, `systemApi`) |
| `src/pages/` | Minimal screens for both roles; they call only `src/api/endpoints.ts` |
| `src/lib.tsx` | Small hooks (`useLoad`, `useAction`) and helpers |

User text is always rendered as JSX text, never `dangerouslySetInnerHTML` (FP-SEC-3, `SPEC.md` §8).
Times are sent as UTC ISO 8601 and shown in the browser's local timezone.
