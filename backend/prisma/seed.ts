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
  for (const file of files) {
    // No parameters, so pg sends the file as one simple query and runs every statement in it.
    await client.query(readFileSync(new URL(`./sql/${file}`, import.meta.url), 'utf8'));
    console.log(`Ran prisma/sql/${file}`);
  }
} finally {
  await client.end();
}
