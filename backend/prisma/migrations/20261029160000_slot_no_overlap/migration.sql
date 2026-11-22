-- An employer can't have two slots that overlap in time (including exact duplicates).
-- Half-open ranges '[)' so back-to-back slots (10:00-10:30, 10:30-11:00) are allowed.
-- Prisma can't model exclusion constraints, so this lives only in SQL.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "availability_slots"
  ADD CONSTRAINT "availability_slots_no_overlap"
  EXCLUDE USING gist ("employer_id" WITH =, tstzrange("start_time", "end_time", '[)') WITH &&);
