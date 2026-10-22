-- Empties every application table, keeping the schema and migration history.
-- LOCAL / DEMO DATABASES ONLY. Run via `npm run db:reset` (or as the first half of `npx prisma db seed`).
TRUNCATE TABLE
  applications,
  availability_slots,
  jobs,
  company_profiles,
  candidate_profiles,
  users
CASCADE;
