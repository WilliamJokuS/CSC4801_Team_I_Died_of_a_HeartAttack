-- Serialize an employer's inserts before checking the overlap exclusion constraint.
-- The transaction lock is released on commit or rollback, including when a slot starts while waiting.
CREATE FUNCTION lock_employer_slot_inserts() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('availability_slots:' || NEW.employer_id::text, 0));
  RETURN NEW;
END;
$$;

CREATE TRIGGER serialize_employer_slot_inserts
BEFORE INSERT ON availability_slots
FOR EACH ROW EXECUTE FUNCTION lock_employer_slot_inserts();
