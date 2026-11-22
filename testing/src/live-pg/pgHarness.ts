import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import inject from 'light-my-request';
import pg from 'pg';
import { createApp } from '../../../backend/src/app.js';
import { PrismaClient } from '../../../backend/src/generated/prisma/client.js';
import { TEST_JWT_SECRET, tokenFor, type ApiResult, type TestServer } from '../support/server.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DEFAULT_TEST_DATABASE_URL = 'postgres://app:app@127.0.0.1:5432/recruiting_test';

export const SLOT_DURATION_MS = 30 * 60_000;

/**
 * Resolves the PostgreSQL connection string for the live concurrency suite.
 * Uses TEST_DATABASE_URL when set, falling back to the local Docker Compose
 * `recruiting_test` database. Refuses to target the main `recruiting` database.
 */
export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL?.trim() || DEFAULT_TEST_DATABASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid TEST_DATABASE_URL: "${url}"`);
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(`TEST_DATABASE_URL must use postgres:// or postgresql:// (got "${parsed.protocol}")`);
  }
  const dbName = parsed.pathname.replace(/^\/+/, '');
  if (!dbName || dbName === 'recruiting') {
    throw new Error(
      `Refusing to run destructive live tests against database "${dbName || '(empty)'}". ` +
        'Point TEST_DATABASE_URL at a disposable test database such as recruiting_test.',
    );
  }
  return url;
}

/**
 * Runs Prisma migrations (including `availability_slots_no_overlap`) against the
 * disposable test database and verifies the exclusion constraint is installed.
 */
export async function applyMigrationsAndVerify(connectionString: string): Promise<void> {
  const backendDir = join(ROOT, 'backend');
  const prismaCli = join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');

  try {
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: connectionString },
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message?: string };
    const details = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n').trim();
    throw new Error(
      `Failed to apply Prisma migrations to TEST_DATABASE_URL. ` +
        `Ensure PostgreSQL is running (e.g. "docker compose -f backend/docker-compose.dev.yml up -d") ` +
        `and TEST_DATABASE_URL points to an accessible disposable database.\n${details}`,
    );
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query<{ conname: string }>(
      `SELECT conname
       FROM pg_constraint
       WHERE conname = 'availability_slots_no_overlap'
         AND conrelid = 'availability_slots'::regclass`,
    );
    if (res.rows.length !== 1) {
      throw new Error('Expected exclusion constraint "availability_slots_no_overlap" on availability_slots after migrations');
    }
  } finally {
    await client.end().catch(() => {});
  }
}

export async function truncateAllTables(pool: pg.Pool): Promise<void> {
  await pool.query(
    'TRUNCATE TABLE applications, availability_slots, jobs, candidate_profiles, company_profiles, users RESTART IDENTITY CASCADE',
  );
}

export interface ManagedPgClient {
  client: pg.Client;
  pid: number;
  rollbackAndClose: () => Promise<void>;
}

/**
 * Opens an independent PostgreSQL connection and records its backend PID for
 * lock verification via `pg_blocking_pids`. Always pair with `try / finally`.
 */
export async function openPgClient(connectionString: string): Promise<ManagedPgClient> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  let closed = false;
  try {
    const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const pid = rows[0].pid;
    return {
      client,
      pid,
      async rollbackAndClose() {
        if (closed) return;
        closed = true;
        try {
          await client.query('ROLLBACK');
        } catch {
          // Ignore if no transaction is active or connection is already broken.
        } finally {
          await client.end().catch(() => {});
        }
      },
    };
  } catch (err) {
    await client.end().catch(() => {});
    throw err;
  }
}

export interface BlockedSessionRow {
  pid: number;
  state: string | null;
  wait_event_type: string | null;
  wait_event: string | null;
  blocking_pids: number[];
  query: string | null;
}

/**
 * Bounded polling on `pg_stat_activity` + `pg_blocking_pids(pid)` to confirm that
 * PostgreSQL sees at least one other backend actively blocked by `blockerPid`.
 */
export async function waitForBlockedBy(
  observer: pg.Pool | pg.Client,
  blockerPid: number,
  opts: { timeoutMs?: number; pollMs?: number } = {},
): Promise<BlockedSessionRow[]> {
  const timeoutMs = opts.timeoutMs ?? 5_000;
  const pollMs = opts.pollMs ?? 25;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const { rows } = await observer.query<BlockedSessionRow>(
      `SELECT pid,
              state,
              wait_event_type,
              wait_event,
              pg_blocking_pids(pid) AS blocking_pids,
              query
       FROM pg_stat_activity
       WHERE datname = current_database()
         AND pid <> pg_backend_pid()
         AND $1::int = ANY(pg_blocking_pids(pid))`,
      [blockerPid],
    );
    if (rows.length > 0) return rows;
    await sleep(pollMs);
  }

  const snapshot = await observer
    .query(
      `SELECT pid, state, wait_event_type, wait_event, pg_blocking_pids(pid) AS blocking_pids, left(query, 120) AS query
       FROM pg_stat_activity
       WHERE datname = current_database() AND pid <> pg_backend_pid()`,
    )
    .then((r) => JSON.stringify(r.rows))
    .catch(() => 'unavailable');

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for a backend blocked by PID ${blockerPid}. ` +
      `Active sessions: ${snapshot}`,
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Waits until Node's wall clock is strictly past `target + bufferMs`. */
export async function waitUntilAfter(target: Date, bufferMs = 50): Promise<void> {
  const targetMs = target.getTime() + bufferMs;
  while (Date.now() <= targetMs) {
    await sleep(Math.min(50, Math.max(5, targetMs - Date.now() + 5)));
  }
}

export interface Deferred<T = void> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

export function createDeferred<T = void>(): Deferred<T> {
  let settled = false;
  let resolveFn!: (value: T) => void;
  let rejectFn!: (err: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = (value: T) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    rejectFn = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
  });
  return { promise, resolve: resolveFn, reject: rejectFn };
}

export interface Barrier {
  arrive: () => Promise<void>;
  releaseAll: () => void;
}

/**
 * N-party synchronization barrier with a bounded timeout and unconditional
 * `releaseAll()` for `finally` cleanup.
 */
export function createBarrier(parties: number, timeoutMs = 5_000): Barrier {
  let count = 0;
  let released = false;
  const deferred = createDeferred<void>();
  const timer = setTimeout(() => {
    if (!released) {
      deferred.reject(new Error(`Barrier timed out after ${timeoutMs}ms (${count}/${parties} arrived)`));
    }
  }, timeoutMs);

  const releaseAll = () => {
    if (released) return;
    released = true;
    clearTimeout(timer);
    deferred.resolve();
  };

  return {
    async arrive() {
      count += 1;
      if (count >= parties) {
        releaseAll();
        return;
      }
      await deferred.promise;
    },
    releaseAll,
  };
}

export interface PrismaHooks {
  afterAvailabilitySlotFindMany?: (rows: unknown[]) => Promise<void> | void;
  afterJobFindFirst?: (row: unknown) => Promise<void> | void;
  afterTxJobUpdateMany?: (getBackendPid: () => Promise<number>, result: { count: number }) => Promise<void> | void;
  afterTxQueryRaw?: (getBackendPid: () => Promise<number>, rows: unknown[]) => Promise<void> | void;
}

/**
 * Wraps a real PrismaClient with targeted post-call hooks so concurrency tests can
 * pause requests at exact points (e.g. after pre-checks or after a locked write)
 * while still executing every real SQL query and transaction against PostgreSQL.
 */
function instrumentPrisma(rawPrisma: PrismaClient, hooks: PrismaHooks): PrismaClient {
  const wrapDelegate = <T extends object>(delegate: T, methodHooks: Record<string, (res: any) => Promise<void> | void>): T =>
    new Proxy(delegate, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, target);
        if (typeof prop === 'string' && prop in methodHooks && typeof value === 'function') {
          return async (...args: unknown[]) => {
            const result = await value.apply(target, args);
            await methodHooks[prop](result);
            return result;
          };
        }
        return typeof value === 'function' ? value.bind(target) : value ?? Reflect.get(target, prop, receiver);
      },
    });

  const wrapTx = (rawTx: any): any => {
    const getBackendPid = async (): Promise<number> => {
      const rows = await rawTx.$queryRaw`SELECT pg_backend_pid() AS pid`;
      return Number(rows[0].pid);
    };

    return new Proxy(rawTx, {
      get(target, prop, receiver) {
        if (prop === 'job' && hooks.afterTxJobUpdateMany) {
          return wrapDelegate(target.job, {
            updateMany: (res) => hooks.afterTxJobUpdateMany!(getBackendPid, res),
          });
        }
        if (prop === '$queryRaw' && hooks.afterTxQueryRaw) {
          const orig = target.$queryRaw.bind(target);
          return async (...args: unknown[]) => {
            const rows = await orig(...args);
            await hooks.afterTxQueryRaw!(getBackendPid, rows);
            return rows;
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value ?? Reflect.get(target, prop, receiver);
      },
    });
  };

  return new Proxy(rawPrisma, {
    get(target, prop, receiver) {
      if (prop === 'availabilitySlot' && hooks.afterAvailabilitySlotFindMany) {
        return wrapDelegate(target.availabilitySlot, {
          findMany: (rows) => hooks.afterAvailabilitySlotFindMany!(rows),
        });
      }
      if (prop === 'job' && hooks.afterJobFindFirst) {
        return wrapDelegate(target.job, {
          findFirst: (row) => hooks.afterJobFindFirst!(row),
        });
      }
      if (prop === '$transaction' && (hooks.afterTxJobUpdateMany || hooks.afterTxQueryRaw)) {
        const orig = target.$transaction.bind(target);
        return (arg: unknown, options?: unknown) => {
          if (typeof arg === 'function') {
            return orig((tx: unknown) => arg(wrapTx(tx)), options as any);
          }
          return orig(arg as any, options as any);
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value ?? Reflect.get(target, prop, receiver);
    },
  });
}

export interface LiveAppHandle extends TestServer {
  prisma: PrismaClient;
  pool: pg.Pool;
  close: () => Promise<void>;
}

/**
 * Builds the real Express app backed by its own dedicated PostgreSQL connection pool
 * and PrismaClient. Always close in `finally`.
 */
export function createLiveApp(connectionString: string, hooks?: PrismaHooks): LiveAppHandle {
  const pool = new pg.Pool({ connectionString, max: 4 });
  const adapter = new PrismaPg(pool);
  const rawPrisma = new PrismaClient({ adapter });
  const prisma = hooks ? instrumentPrisma(rawPrisma, hooks) : rawPrisma;
  const app = createApp({ prisma, jwtSecret: TEST_JWT_SECRET, jwtExpiresIn: '1h' });

  let closed = false;
  return {
    prisma,
    pool,
    async request(method, path, opts = {}): Promise<ApiResult> {
      const headers: Record<string, string> = { ...opts.headers };
      if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
      let payload: string | undefined;
      if (opts.rawBody !== undefined) {
        payload = opts.rawBody;
        headers['Content-Type'] = 'application/json';
      } else if (opts.body !== undefined) {
        payload = JSON.stringify(opts.body);
        headers['Content-Type'] = 'application/json';
      }
      const res = await inject(app, { method: method as 'GET', url: `/api${path}`, headers, payload });
      return { status: res.statusCode, body: res.payload ? JSON.parse(res.payload) : undefined };
    },
    async close() {
      if (closed) return;
      closed = true;
      try {
        await rawPrisma.$disconnect();
      } finally {
        await pool.end().catch(() => {});
      }
    },
  };
}

export async function seedEmployer(pool: pg.Pool, opts: { companyName?: string; displayName?: string } = {}) {
  const id = randomUUID();
  const email = `employer-${id}@live-pg.test`;
  const displayName = opts.displayName ?? 'Acme HR';
  const companyName = opts.companyName ?? 'Acme Corp';

  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, display_name)
     VALUES ($1::uuid, $2, $3, 'Employer', $4)`,
    [id, email, '$2b$12$testplaceholderhashthatisnotusedforlogin00000000000000', displayName],
  );
  await pool.query(
    `INSERT INTO company_profiles (user_id, company_name, description)
     VALUES ($1::uuid, $2, $3)`,
    [id, companyName, 'Live PG test company'],
  );
  return { id, email, displayName, companyName, token: tokenFor(id, 'Employer') };
}

export async function seedCandidate(pool: pg.Pool, opts: { displayName?: string; skills?: string[] } = {}) {
  const id = randomUUID();
  const email = `candidate-${id}@live-pg.test`;
  const displayName = opts.displayName ?? 'Alice Candidate';

  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, display_name)
     VALUES ($1::uuid, $2, $3, 'Candidate', $4)`,
    [id, email, '$2b$12$testplaceholderhashthatisnotusedforlogin00000000000000', displayName],
  );
  await pool.query(
    `INSERT INTO candidate_profiles (user_id, skills, resume_text)
     VALUES ($1::uuid, $2::jsonb, $3)`,
    [id, JSON.stringify(opts.skills ?? ['typescript', 'sql']), 'Test resume'],
  );
  return { id, email, displayName, token: tokenFor(id, 'Candidate') };
}

export async function seedJob(
  pool: pg.Pool,
  employerId: string,
  opts: { title?: string; description?: string; requiredSkills?: string[]; tags?: string[] } = {},
) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO jobs (id, employer_id, title, description, required_skills, tags, is_active)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, true)`,
    [
      id,
      employerId,
      opts.title ?? 'Backend Engineer',
      opts.description ?? 'Initial description',
      JSON.stringify(opts.requiredSkills ?? ['typescript']),
      JSON.stringify(opts.tags ?? ['Remote']),
    ],
  );
  return { id };
}

export async function seedSlot(pool: pg.Pool, employerId: string, startTime: Date, opts: { isBooked?: boolean } = {}) {
  const id = randomUUID();
  const endTime = new Date(startTime.getTime() + SLOT_DURATION_MS);
  await pool.query(
    `INSERT INTO availability_slots (id, employer_id, start_time, end_time, is_booked)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
    [id, employerId, startTime, endTime, opts.isBooked ?? false],
  );
  return { id, startTime, endTime };
}

export async function seedApplication(
  pool: pg.Pool,
  jobId: string,
  candidateId: string,
  opts: { status?: 'Pending' | 'Interviewing' | 'Rejected' | 'Accepted'; interviewSlotId?: string | null } = {},
) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO applications (id, job_id, candidate_id, status, interview_slot_id)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"ApplicationStatus", $5::uuid)`,
    [id, jobId, candidateId, opts.status ?? 'Interviewing', opts.interviewSlotId ?? null],
  );
  return { id };
}
