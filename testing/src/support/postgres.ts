import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { vi } from 'vitest';

const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
export const { Client } = require('pg') as typeof import('../../../backend/node_modules/@types/pg');

const migrationDirectory = new URL('../../../backend/prisma/migrations/', import.meta.url);
export const migrations = readdirSync(migrationDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

export async function migrate(client: InstanceType<typeof Client>, names = migrations) {
  for (const name of names) {
    await client.query(readFileSync(new URL(`${name}/migration.sql`, migrationDirectory), 'utf8'));
  }
}

export async function withTestDatabase<T>(
  run: (client: InstanceType<typeof Client>, url: string) => Promise<T>,
): Promise<T> {
  const adminUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl) throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL server with permission to create test databases');

  const name = `recruiting_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    try {
      const url = new URL(adminUrl);
      url.pathname = `/${name}`;
      const client = new Client({ connectionString: url.href });
      try {
        await client.connect();
        return await run(client, url.href);
      } finally {
        await client.end();
      }
    } finally {
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    }
  } finally {
    await admin.end();
  }
}

export async function loadPrisma(url: string) {
  vi.resetModules();
  vi.stubEnv('DATABASE_URL', url);
  vi.stubEnv('JWT_SECRET', 'test-only-generated-client-secret-123');
  try {
    return (await import('../../../backend/src/lib/prisma.js')).prisma;
  } finally {
    vi.unstubAllEnvs();
  }
}
