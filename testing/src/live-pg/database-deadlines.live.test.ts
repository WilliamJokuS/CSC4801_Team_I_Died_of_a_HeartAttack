import { readFileSync } from 'node:fs';
import { createServer, type Socket } from 'node:net';
import inject from 'light-my-request';
import { expect, it } from 'vitest';
import { createApp } from '../../../backend/src/app.js';
import { loadPrisma, migrate, withTestDatabase } from '../support/postgres.js';
import { TEST_JWT_SECRET, tokenFor } from '../support/server.js';

const dbUnavailable = { error: { code: 'DB_UNAVAILABLE' } };

async function withinDeadline<T>(operation: PromiseLike<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Database request exceeded 4 seconds')), 4_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

it('health returns 503 when the database handshake stalls', async () => {
  const sockets = new Set<Socket>();
  const stall = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => stall.listen(0, '127.0.0.1', resolve));
  const address = stall.address();
  if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP port');
  const prisma = await loadPrisma(`postgres://test:test@127.0.0.1:${address.port}/test?sslmode=disable`);
  try {
    const app = createApp({ prisma, jwtSecret: TEST_JWT_SECRET, jwtExpiresIn: '1h' });
    const result = await withinDeadline(inject(app, { method: 'GET', url: '/api/health' }));
    expect(result.statusCode).toBe(503);
    expect(result.json()).toMatchObject(dbUnavailable);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => stall.close(() => resolve()));
    await prisma.$disconnect();
  }
});

it('booking and deletion return the same bounded 503 while another connection holds the slot lock', async () => {
  await withTestDatabase(async (blocker, url) => {
    await migrate(blocker);
    await blocker.query(readFileSync(new URL('../../../backend/prisma/sql/seed.sql', import.meta.url), 'utf8'));
    const employerId = '22222222-0000-4000-8000-000000000001';
    const candidateId = '11111111-0000-4000-8000-000000000001';
    const applicationId = '55555555-0000-4000-8000-000000000001';
    const slotId = '44444444-0000-4000-8000-000000000001';
    const prisma = await loadPrisma(url);
    try {
      const app = createApp({ prisma, jwtSecret: TEST_JWT_SECRET, jwtExpiresIn: '1h' });
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM availability_slots WHERE id = $1 FOR UPDATE', [slotId]);
      const requests = [
        inject(app, {
          method: 'POST', url: `/api/applications/${applicationId}/book`,
          headers: { authorization: `Bearer ${tokenFor(candidateId, 'Candidate')}` },
          payload: { slot_id: slotId },
        }),
        inject(app, {
          method: 'DELETE', url: `/api/employers/me/availability/${slotId}`,
          headers: { authorization: `Bearer ${tokenFor(employerId, 'Employer')}` },
        }),
      ];
      try {
        const results = await withinDeadline(Promise.all(requests));
        for (const result of results) {
          expect(result.statusCode, result.payload).toBe(503);
          expect(result.json()).toMatchObject(dbUnavailable);
        }
      } finally {
        await blocker.query('ROLLBACK');
        await Promise.allSettled(requests);
      }
      const slot = await blocker.query('SELECT is_booked FROM availability_slots WHERE id = $1', [slotId]);
      expect(slot.rows).toEqual([{ is_booked: false }]);
    } finally {
      await prisma.$disconnect();
    }
  });
});
