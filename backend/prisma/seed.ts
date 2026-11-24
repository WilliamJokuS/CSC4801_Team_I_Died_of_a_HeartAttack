// `npx prisma db seed` (wired in prisma.config.ts): reset, then load the deterministic demo data.
// Usage: tsx prisma/seed.ts [reset|seed|all]   (default: all)
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const mode = process.argv[2] ?? 'all';
const files = { reset: ['reset.sql'], seed: ['seed.sql'], all: ['reset.sql', 'seed.sql'] }[mode];
if (!files) {
  console.error(`Unknown mode "${mode}"; use reset, seed, or all`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (see .env.example)');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  const referenceDate = process.env.DEMO_SEED_REFERENCE_DATE;
  if (mode !== 'reset' && referenceDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
      throw new Error('DEMO_SEED_REFERENCE_DATE must use YYYY-MM-DD (UTC)');
    }
    await client.query("SELECT set_config('csc4801.seed_reference_date', $1, true)", [referenceDate]);
  }
  for (const file of files) {
    // No parameters, so pg sends the file as one simple query and runs every statement in it.
    await client.query(readFileSync(new URL(`./sql/${file}`, import.meta.url), 'utf8'));
  }
  await client.query('COMMIT');
  for (const file of files) console.log(`Ran prisma/sql/${file}`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
