import 'dotenv/config';
import pg from 'pg';

type Slot = {
  id: string;
  employer_id: string;
  start_us: string;
  end_us: string;
};

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (see .env.example)');

const schema = new URL(url).searchParams.get('schema') ?? 'public';
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5_000 });
await client.connect();
try {
  await client.query("SELECT set_config('search_path', quote_ident($1), false)", [schema]);
  const { rows: [state] } = await client.query(`
    SELECT to_regclass('availability_slots') IS NOT NULL AS has_slots,
           EXISTS (
             SELECT 1 FROM pg_constraint
             WHERE conrelid = to_regclass('availability_slots')
               AND conname = 'availability_slots_no_overlap'
           ) AS has_constraint
  `);

  if (state.has_slots && !state.has_constraint) {
    await client.query('BEGIN');
    // Exclude concurrent slot writes and booking changes during cleanup.
    await client.query('LOCK TABLE applications, availability_slots IN EXCLUSIVE MODE');
    const { rows: overlaps } = await client.query<Slot>(`
      SELECT a.id, a.employer_id,
             (EXTRACT(EPOCH FROM a.start_time) * 1000000)::bigint AS start_us,
             (EXTRACT(EPOCH FROM a.end_time) * 1000000)::bigint AS end_us
      FROM availability_slots a
      WHERE EXISTS (
        SELECT 1 FROM availability_slots b
        WHERE a.employer_id = b.employer_id AND a.id <> b.id
          AND a.start_time < b.end_time AND b.start_time < a.end_time
      )
      ORDER BY (a.is_booked OR EXISTS (
        SELECT 1 FROM applications WHERE interview_slot_id = a.id
      )) DESC, random()
    `);

    const retained = new Map<string, { start: bigint; end: bigint }[]>();
    const removed: string[] = [];
    for (const slot of overlaps) {
      const start = BigInt(slot.start_us);
      const end = BigInt(slot.end_us);
      const employerSlots = retained.get(slot.employer_id) ?? [];
      if (employerSlots.some((other) => start < other.end && other.start < end)) {
        removed.push(slot.id);
      } else {
        employerSlots.push({ start, end });
        retained.set(slot.employer_id, employerSlots);
      }
    }
    if (removed.length > 0) {
      await client.query('DELETE FROM availability_slots WHERE id = ANY($1::uuid[])', [removed]);
    }
    await client.query('COMMIT');
    if (removed.length > 0) console.warn(`Removed ${removed.length} overlapping legacy interview slots.`);
  }
} finally {
  // Closing an open transaction rolls it back if cleanup failed.
  await client.end();
}
