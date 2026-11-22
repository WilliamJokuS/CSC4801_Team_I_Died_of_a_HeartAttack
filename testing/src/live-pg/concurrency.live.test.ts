/**
 * Live PostgreSQL concurrency regression suite (commit db6a0f1).
 *
 * Runs separately from `npm test` via `npm run test:live` against a real,
 * disposable PostgreSQL database (`TEST_DATABASE_URL`, defaulting to local
 * Docker Compose `recruiting_test`) with all Prisma migrations applied
 * (including the `availability_slots_no_overlap` GiST exclusion constraint).
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  SLOT_DURATION_MS,
  applyMigrationsAndVerify,
  createBarrier,
  createDeferred,
  createLiveApp,
  getTestDatabaseUrl,
  openPgClient,
  seedApplication,
  seedCandidate,
  seedEmployer,
  seedJob,
  seedSlot,
  truncateAllTables,
  waitForBlockedBy,
  waitUntilAfter,
} from './pgHarness.js';

const testDatabaseUrl = getTestDatabaseUrl();

describe('Live PostgreSQL concurrency regressions (commit db6a0f1)', () => {
  let adminPool: pg.Pool;

  beforeAll(async () => {
    await applyMigrationsAndVerify(testDatabaseUrl);
    adminPool = new pg.Pool({ connectionString: testDatabaseUrl, max: 4 });
  });

  beforeEach(async () => {
    await truncateAllTables(adminPool);
  });

  afterAll(async () => {
    if (adminPool) await adminPool.end();
  });

  it('FP-SCHED-2: booking that waits on a slot row lock past the start time fails with 409 SLOT_IN_PAST and leaves slot/application unchanged', async () => {
    const employer = await seedEmployer(adminPool);
    const candidate = await seedCandidate(adminPool);
    const job = await seedJob(adminPool, employer.id);
    const startTime = new Date(Date.now() + 1_200);
    const slot = await seedSlot(adminPool, employer.id, startTime);
    const application = await seedApplication(adminPool, job.id, candidate.id, { status: 'Interviewing' });

    const app = createLiveApp(testDatabaseUrl);
    const blocker = await openPgClient(testDatabaseUrl);

    try {
      // Hold a FOR UPDATE row lock on the slot in a separate transaction.
      await blocker.client.query('BEGIN');
      await blocker.client.query('SELECT id FROM availability_slots WHERE id = $1::uuid FOR UPDATE', [slot.id]);

      // Sanity check: the slot is still in the future when the booking request begins.
      expect(Date.now()).toBeLessThan(startTime.getTime());

      const bookingPromise = app.request('POST', `/applications/${application.id}/book`, {
        token: candidate.token,
        body: { slot_id: slot.id },
      });

      // Confirm PostgreSQL sees the booking transaction waiting on blocker's row lock.
      const blocked = await waitForBlockedBy(adminPool, blocker.pid);
      expect(blocked.length).toBeGreaterThanOrEqual(1);
      expect(blocked.some((row) => row.blocking_pids.includes(blocker.pid))).toBe(true);

      // Hold the lock until after the slot's start time has passed, then release.
      await waitUntilAfter(startTime, 50);
      await blocker.client.query('ROLLBACK');

      const res = await bookingPromise;
      expect(res.status).toBe(409);
      expect(res.body?.error?.code).toBe('SLOT_IN_PAST');

      // Assert final database state: slot stays unbooked, application has no linked slot.
      const slotRow = await adminPool.query<{ is_booked: boolean }>(
        'SELECT is_booked FROM availability_slots WHERE id = $1::uuid',
        [slot.id],
      );
      expect(slotRow.rows).toEqual([{ is_booked: false }]);

      const appRow = await adminPool.query<{ interview_slot_id: string | null }>(
        'SELECT interview_slot_id FROM applications WHERE id = $1::uuid',
        [application.id],
      );
      expect(appRow.rows).toEqual([{ interview_slot_id: null }]);
    } finally {
      await blocker.rollbackAndClose();
      await app.close();
    }
  });

  it('FP-SCHED-1: slot creation blocked on an overlapping uncommitted insert past start time rolls back with 400 VALIDATION_ERROR and leaves no rows', async () => {
    const employer = await seedEmployer(adminPool);
    const startTime = new Date(Date.now() + 1_200);
    const endTime = new Date(startTime.getTime() + SLOT_DURATION_MS);

    const app = createLiveApp(testDatabaseUrl);
    const blocker = await openPgClient(testDatabaseUrl);

    try {
      // Insert an overlapping near-future slot in a separate transaction without committing.
      await blocker.client.query('BEGIN');
      await blocker.client.query(
        `INSERT INTO availability_slots (id, employer_id, start_time, end_time, is_booked)
         VALUES ($1::uuid, $2::uuid, $3, $4, false)`,
        [randomUUID(), employer.id, startTime, endTime],
      );

      // Sanity check: the requested slot is still in the future when creation starts.
      expect(Date.now()).toBeLessThan(startTime.getTime());

      const createPromise = app.request('POST', '/employers/me/availability', {
        token: employer.token,
        body: { start_time: startTime.toISOString(), end_time: endTime.toISOString() },
      });

      // Confirm PostgreSQL sees the insert blocked by the uncommitted overlapping transaction.
      const blocked = await waitForBlockedBy(adminPool, blocker.pid);
      expect(blocked.length).toBeGreaterThanOrEqual(1);
      expect(blocked.some((row) => row.blocking_pids.includes(blocker.pid))).toBe(true);

      // Wait until the requested start time has passed, then roll back the blocking transaction.
      await waitUntilAfter(startTime, 50);
      await blocker.client.query('ROLLBACK');

      const res = await createPromise;
      expect(res.status).toBe(400);
      expect(res.body?.error?.code).toBe('VALIDATION_ERROR');

      // Assert neither transaction left a row in availability_slots.
      const rows = await adminPool.query<{ id: string }>(
        'SELECT id FROM availability_slots WHERE employer_id = $1::uuid',
        [employer.id],
      );
      expect(rows.rows).toHaveLength(0);
    } finally {
      await blocker.rollbackAndClose();
      await app.close();
    }
  });

  it('FP-SCHED-1: overlapping same-employer slot inserts racing past pre-checks yield one 201 and one 409 SLOT_OVERLAP, matching sequential overlap, with one row stored', async () => {
    const employer = await seedEmployer(adminPool);
    const baseStart = new Date(Date.now() + 2 * 60 * 60_000); // +2h in the future
    const slotAStart = baseStart;
    const slotAEnd = new Date(slotAStart.getTime() + SLOT_DURATION_MS);
    // Overlaps slot A by 15 minutes; a sequential request for slot B overlaps whichever wins.
    const slotBStart = new Date(baseStart.getTime() + 15 * 60_000);
    const slotBEnd = new Date(slotBStart.getTime() + SLOT_DURATION_MS);

    const preCheckBarrier = createBarrier(2);
    const preCheckCounts: number[] = [];

    const hook = {
      async afterAvailabilitySlotFindMany(rows: unknown[]) {
        preCheckCounts.push(rows.length);
        await preCheckBarrier.arrive();
      },
    };

    const appA = createLiveApp(testDatabaseUrl, hook);
    const appB = createLiveApp(testDatabaseUrl, hook);
    const sequentialApp = createLiveApp(testDatabaseUrl);

    try {
      const [resA, resB] = await Promise.all([
        appA.request('POST', '/employers/me/availability', {
          token: employer.token,
          body: { start_time: slotAStart.toISOString(), end_time: slotAEnd.toISOString() },
        }),
        appB.request('POST', '/employers/me/availability', {
          token: employer.token,
          body: { start_time: slotBStart.toISOString(), end_time: slotBEnd.toISOString() },
        }),
      ]);

      // Confirm both requests passed the overlap pre-check seeing 0 existing rows.
      expect(preCheckCounts).toEqual([0, 0]);

      const concurrent = [resA, resB];
      const winner = concurrent.find((r) => r.status === 201);
      const loser = concurrent.find((r) => r.status === 409);

      expect(winner, `expected one 201, got ${JSON.stringify(concurrent)}`).toBeDefined();
      expect(loser, `expected one 409, got ${JSON.stringify(concurrent)}`).toBeDefined();
      expect(loser!.body?.error?.code).toBe('SLOT_OVERLAP');

      // Assert exactly one row remains after the concurrent race.
      const afterConcurrent = await adminPool.query<{ id: string }>(
        'SELECT id FROM availability_slots WHERE employer_id = $1::uuid',
        [employer.id],
      );
      expect(afterConcurrent.rows).toHaveLength(1);
      expect(afterConcurrent.rows[0].id).toBe(winner!.body.id);

      // Compare with a sequential overlap request where the pre-check sees the existing slot.
      const sequential = await sequentialApp.request('POST', '/employers/me/availability', {
        token: employer.token,
        body: { start_time: slotBStart.toISOString(), end_time: slotBEnd.toISOString() },
      });
      expect(sequential.status).toBe(409);
      expect(sequential.body?.error?.code).toBe('SLOT_OVERLAP');
      expect(sequential.body).toEqual(loser!.body);

      // Assert exactly one row still remains after the sequential overlap.
      const afterSequential = await adminPool.query<{ id: string }>(
        'SELECT id FROM availability_slots WHERE employer_id = $1::uuid',
        [employer.id],
      );
      expect(afterSequential.rows).toHaveLength(1);
      expect(afterSequential.rows[0].id).toBe(winner!.body.id);
    } finally {
      preCheckBarrier.releaseAll();
      await Promise.all([appA.close(), appB.close(), sequentialApp.close()]);
    }
  });

  it('FP-EMP-2: simultaneous job edits serialize on the update lock so each edit returns its own values and the stored row holds B values', async () => {
    const employer = await seedEmployer(adminPool);
    const job = await seedJob(adminPool, employer.id, {
      title: 'Original Role',
      description: 'Original description',
      requiredSkills: ['sql'],
      tags: ['Onsite'],
    });

    const editAUpdated = createDeferred<number>();
    const releaseEditA = createDeferred<void>();

    const appA = createLiveApp(testDatabaseUrl, {
      async afterTxJobUpdateMany(getBackendPid, result) {
        expect(result.count).toBe(1);
        const pidA = await getBackendPid();
        editAUpdated.resolve(pidA);
        await releaseEditA.promise;
      },
    });
    const appB = createLiveApp(testDatabaseUrl);

    const payloadA = {
      title: 'Edit A Title',
      description: 'Edit A description',
      required_skills: ['python', 'docker'],
      tags: ['Remote'],
    };
    const payloadB = {
      title: 'Edit B Title',
      description: 'Edit B description',
      required_skills: ['typescript', 'postgresql'],
      tags: ['Hybrid', 'Full-time'],
    };

    try {
      const editAPromise = appA.request('PUT', `/jobs/${job.id}`, {
        token: employer.token,
        body: payloadA,
      });

      // Pause edit A after its UPDATE and before its response read.
      const pidA = await editAUpdated.promise;

      // Start edit B on a separate connection and confirm PostgreSQL blocks it on edit A.
      const editBPromise = appB.request('PUT', `/jobs/${job.id}`, {
        token: employer.token,
        body: payloadB,
      });

      const blocked = await waitForBlockedBy(adminPool, pidA);
      expect(blocked.length).toBeGreaterThanOrEqual(1);
      expect(blocked.some((row) => row.blocking_pids.includes(pidA))).toBe(true);

      // Release edit A so it reads its own row, commits, and unblocks edit B.
      releaseEditA.resolve();

      const [resA, resB] = await Promise.all([editAPromise, editBPromise]);

      expect(resA.status).toBe(200);
      expect(resA.body).toMatchObject({
        id: job.id,
        title: payloadA.title,
        description: payloadA.description,
        required_skills: payloadA.required_skills,
        tags: payloadA.tags,
      });

      expect(resB.status).toBe(200);
      expect(resB.body).toMatchObject({
        id: job.id,
        title: payloadB.title,
        description: payloadB.description,
        required_skills: payloadB.required_skills,
        tags: payloadB.tags,
      });

      // Assert final stored row contains edit B's values.
      const stored = await adminPool.query<{
        title: string;
        description: string;
        required_skills: string[];
        tags: string[];
        is_active: boolean;
      }>('SELECT title, description, required_skills, tags, is_active FROM jobs WHERE id = $1::uuid', [job.id]);

      expect(stored.rows).toEqual([
        {
          title: payloadB.title,
          description: payloadB.description,
          required_skills: payloadB.required_skills,
          tags: payloadB.tags,
          is_active: true,
        },
      ]);
    } finally {
      releaseEditA.resolve();
      await Promise.all([appA.close(), appB.close()]);
    }
  });

  it('FP-EMP-2: simultaneous deletes on an active job with no applications yield one 204 and one 404 NOT_FOUND, leaving the job inactive', async () => {
    const employer = await seedEmployer(adminPool);
    const job = await seedJob(adminPool, employer.id, { title: 'Deletable Role' });

    const activeReadBarrier = createBarrier(2);
    const activeReads: boolean[] = [];
    const lockHolderReady = createDeferred<number>();
    const releaseLockHolder = createDeferred<void>();

    const hooks = {
      async afterJobFindFirst(row: unknown) {
        activeReads.push(row !== null);
        await activeReadBarrier.arrive();
      },
      async afterTxQueryRaw(getBackendPid: () => Promise<number>, rows: unknown[]) {
        // Only the transaction that acquired the FOR UPDATE lock on the active row holds it.
        if (rows.length > 0) {
          const holderPid = await getBackendPid();
          lockHolderReady.resolve(holderPid);
          await releaseLockHolder.promise;
        }
      },
    };

    const appA = createLiveApp(testDatabaseUrl, hooks);
    const appB = createLiveApp(testDatabaseUrl, hooks);

    try {
      const deleteAPromise = appA.request('DELETE', `/jobs/${job.id}`, { token: employer.token });
      const deleteBPromise = appB.request('DELETE', `/jobs/${job.id}`, { token: employer.token });

      // Both deletes read the job as active, then one acquires the FOR UPDATE lock while the other waits.
      const holderPid = await lockHolderReady.promise;
      const blocked = await waitForBlockedBy(adminPool, holderPid);
      expect(blocked.length).toBeGreaterThanOrEqual(1);
      expect(blocked.some((row) => row.blocking_pids.includes(holderPid))).toBe(true);

      // Release the lock holder so it soft-deletes and commits, then the waiter rechecks is_active.
      releaseLockHolder.resolve();

      const [resA, resB] = await Promise.all([deleteAPromise, deleteBPromise]);

      // Confirm both deletes passed the initial active read before racing on the locked recheck.
      expect(activeReads).toEqual([true, true]);

      const responses = [resA, resB];
      const deleted = responses.find((r) => r.status === 204);
      const missing = responses.find((r) => r.status === 404);

      expect(deleted, `expected one 204, got ${JSON.stringify(responses)}`).toBeDefined();
      expect(missing, `expected one 404, got ${JSON.stringify(responses)}`).toBeDefined();
      expect(missing!.body?.error?.code).toBe('NOT_FOUND');

      // Assert the job is inactive afterward.
      const stored = await adminPool.query<{ is_active: boolean }>('SELECT is_active FROM jobs WHERE id = $1::uuid', [
        job.id,
      ]);
      expect(stored.rows).toEqual([{ is_active: false }]);
    } finally {
      activeReadBarrier.releaseAll();
      releaseLockHolder.resolve();
      await Promise.all([appA.close(), appB.close()]);
    }
  });
});
