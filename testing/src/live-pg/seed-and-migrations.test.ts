import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { bookSlot, listAvailableSlots } from '../../../backend/src/scheduling/service.js';
import { loadPrisma, migrate, migrations, withTestDatabase } from '../support/postgres.js';

const backend = fileURLToPath(new URL('../../../backend/', import.meta.url));
const exec = promisify(execFile);

function runSeed(url: string, mode: 'all' | 'reset', env: NodeJS.ProcessEnv = {}) {
  return exec(process.execPath, ['--import', 'tsx', 'prisma/seed.ts', mode], {
    cwd: backend,
    env: { ...process.env, DATABASE_URL: url, ...env },
  });
}

it('rolls back a demo reset when seeding fails and supports an explicit reset', async () => {
  await withTestDatabase(async (client, url) => {
    await migrate(client, migrations.slice(0, 1));
    await client.query(
      'INSERT INTO users (id, email, password_hash, role, display_name) VALUES ($1, $2, $3, $4, $5)',
      ['22f910ea-373b-48cc-9927-436daf43d631', 'existing@demo.test', 'fixture', 'Candidate', 'Existing user'],
    );
    await expect(runSeed(url, 'all')).rejects.toMatchObject({ stderr: expect.stringMatching(/column "tags"/) });
    expect((await client.query('SELECT email FROM users')).rows).toEqual([{ email: 'existing@demo.test' }]);
    await runSeed(url, 'reset');
    expect((await client.query('SELECT email FROM users')).rows).toEqual([]);
  });
});

it('removes legacy overlaps before migration while preserving unrelated slots', async () => {
  await withTestDatabase(async (client, url) => {
    const legacy = migrations.slice(0, 2);
    await migrate(client, legacy);
    const options = { cwd: backend, env: { ...process.env, DATABASE_URL: url } };
    for (const name of legacy) {
      await exec(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'resolve', '--applied', name], options);
    }
    await client.query(readFileSync(new URL('../../../backend/prisma/sql/seed.sql', import.meta.url), 'utf8'));
    const booked = '44444444-0000-4000-8000-000000000003';
    const openDuplicate = '44444444-0000-4000-8000-000000000098';
    const firstAcme = '44444444-0000-4000-8000-000000000001';
    const bookedDuplicate = '44444444-0000-4000-8000-000000000099';
    const nonconflicting = '44444444-0000-4000-8000-000000000002';
    const alice = '55555555-0000-4000-8000-000000000001';
    const bob = '55555555-0000-4000-8000-000000000002';
    const addDuplicate = (id: string, original: string) => client.query(
      'INSERT INTO availability_slots (id, employer_id, start_time, end_time) SELECT $1, employer_id, start_time, end_time FROM availability_slots WHERE id = $2',
      [id, original],
    );
    await addDuplicate(openDuplicate, booked);
    await addDuplicate(bookedDuplicate, firstAcme);
    await client.query('UPDATE availability_slots SET is_booked = true WHERE id = ANY($1::uuid[])', [[firstAcme, bookedDuplicate]]);
    await client.query('UPDATE applications SET interview_slot_id = $1 WHERE id = $2', [firstAcme, alice]);
    await client.query('UPDATE applications SET interview_slot_id = $1 WHERE id = $2', [bookedDuplicate, bob]);

    await exec(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'migrate'], {
      ...options,
      shell: process.platform === 'win32',
    });

    const existing = (await client.query('SELECT id FROM availability_slots')).rows.map((row) => row.id);
    expect(existing).toHaveLength(5);
    expect(existing).toEqual(expect.arrayContaining([booked, nonconflicting]));
    expect(existing).not.toContain(openDuplicate);
    expect(existing.filter((id) => [firstAcme, bookedDuplicate].includes(id))).toHaveLength(1);
    expect((await client.query('SELECT id FROM applications')).rowCount).toBe(9);
    expect((await client.query(
      'SELECT interview_slot_id FROM applications WHERE id = ANY($1::uuid[]) AND interview_slot_id IS NOT NULL',
      [[alice, bob]],
    )).rowCount).toBe(1);
    expect((await client.query(
      'SELECT interview_slot_id FROM applications WHERE interview_slot_id = $1', [booked],
    )).rowCount).toBe(1);
  });
});

it('the seeded candidates see the same future slot with a reference date after January 2027', async () => {
  await withTestDatabase(async (client, url) => {
    await migrate(client);
    await runSeed(url, 'all', { DEMO_SEED_REFERENCE_DATE: '2030-06-15' });
    const prisma = await loadPrisma(url);
    try {
      const deps = { prisma, now: () => new Date('2030-06-15T23:59:59Z') };
      const alice = await listAvailableSlots(
        deps, '11111111-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000001',
      );
      const bob = await listAvailableSlots(
        deps, '11111111-0000-4000-8000-000000000002', '55555555-0000-4000-8000-000000000002',
      );
      expect(alice[0]?.start_time).toBe('2030-06-16T02:00:00.000Z');
      expect(bob.map((slot) => slot.id)).toContain(alice[0].id);

      const input = { slot_id: alice[0].id };
      const bookings = await Promise.allSettled([
        bookSlot(deps, '11111111-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000001', input),
        bookSlot(deps, '11111111-0000-4000-8000-000000000002', '55555555-0000-4000-8000-000000000002', input),
      ]);
      expect(bookings.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(bookings).toContainEqual(expect.objectContaining({
        status: 'rejected', reason: expect.objectContaining({ status: 409, code: 'SLOT_TAKEN' }),
      }));
      expect((await client.query(
        'SELECT interview_slot_id FROM applications WHERE interview_slot_id = $1', [input.slot_id],
      )).rows).toEqual([{ interview_slot_id: input.slot_id }]);
    } finally {
      await prisma.$disconnect();
    }
  });
});
