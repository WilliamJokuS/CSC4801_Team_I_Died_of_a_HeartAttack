# Backend

Owned by: William

Node.js + TypeScript REST API under `/api` (Express 5, Prisma 7 on PostgreSQL). Implements `../Contract/API_Contract.md`.

## Setup

```bash
cd backend
npm ci                                            # also runs `prisma generate`
cp .env.example .env                              # placeholders; set a real JWT_SECRET locally
docker compose -f docker-compose.dev.yml up -d    # local Postgres (recruiting + recruiting_test)
npm run migrate:dev                               # apply / create migrations
npm run dev                                       # http://localhost:8080/api
```

## Layout

| Path | Purpose |
|---|---|
| `prisma/schema.prisma` | Database schema (mirrors `Contract/Database_schema.md`) |
| `src/app.ts` | `createApp(deps)` — builds the Express app without listening, so tests can inject a test-DB Prisma client and JWT secret |
| `src/server.ts` | Entry point: reads config, starts the listener |
| `src/auth/` | Password hashing, JWT sign/verify, register/login/me service |
| `src/middleware/auth.ts` | `requireAuth(secret)` → 401, `requireRole(...roles)` → 403 |
| `src/lib/errors.ts` | `HttpError` + helpers; renders the `{ error: { code, message } }` envelope |
| `src/routes/` | One router per contract section |

## Auth design

- Passwords: bcrypt, cost 12, random salt per hash. Passwords over 72 bytes are rejected rather than silently truncated.
- Emails are trimmed and lowercased before storage/lookup; uniqueness is enforced by the `users.email` UNIQUE constraint (`409 EMAIL_TAKEN`).
- Tokens: HS256 JWT, `sub` = user id, `role` claim, expiry `JWT_EXPIRES_IN` (24h). No refresh tokens.
- Logout is stateless: `POST /api/auth/logout` returns `204` and the client discards the token.
- Login returns the same `401 INVALID_CREDENTIALS` for an unknown email and a wrong password, and runs a bcrypt compare in both cases, so neither the response nor its timing reveals which emails are registered.
- Registration creates the matching `candidate_profiles` / `company_profiles` row in the same insert. An employer's `company_name` starts as their `display_name`.
- Protected routes: `router.get(path, requireAuth(secret), requireRole('Employer'), handler)`. Ownership checks (403 vs 404) belong in each service.

### `AuthUser`

```ts
{ id: string; email: string; role: 'Candidate' | 'Employer'; display_name: string; created_at: string }
```

### Error codes

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body fails validation |
| 400 | `INVALID_JSON` | Malformed JSON body |
| 401 | `UNAUTHORIZED` | Missing / invalid / expired token |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `FORBIDDEN` | Wrong role or not the owner |
| 404 | `NOT_FOUND` | Object or route doesn't exist |
| 409 | `EMAIL_TAKEN` | Register with an existing email |
