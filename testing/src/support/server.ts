import { afterEach, beforeEach } from 'vitest';
import inject from 'light-my-request';
import { createApp } from '../../../backend/src/app.js';
import { signToken } from '../../../backend/src/auth/jwt.js';
import { FakePrisma } from './fakePrisma.js';

/** Test-only secret (>= 32 chars like the real one). Never read from .env (AGENTS.md). */
export const TEST_JWT_SECRET = 'unit-test-secret-unit-test-secret-0123456789';

export const tokenFor = (userId: string, role: 'Candidate' | 'Employer', secret = TEST_JWT_SECRET, expiresIn = '1h') =>
  signToken({ sub: userId, role }, secret, expiresIn);

export interface ApiResult {
  status: number;
  body: any;
}

export interface TestServer {
  request(
    method: string,
    path: string,
    opts?: { token?: string; headers?: Record<string, string>; body?: unknown; rawBody?: string },
  ): Promise<ApiResult>;
}

/**
 * Drives the real Express app (backend/src/app.ts: routing, auth middleware, validation, error
 * handler) in-process, backed by the fake DB. Requests are injected straight into the app
 * instead of over a TCP socket, so the tests need no open port and stay fast and deterministic.
 */
export function startServer(db: FakePrisma): TestServer {
  const app = createApp({ prisma: db.client, jwtSecret: TEST_JWT_SECRET, jwtExpiresIn: '1h' });
  return {
    async request(method, path, opts = {}) {
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
  };
}

/** A UUID that is valid but names nothing. */
export const MISSING_ID = '00000000-0000-4000-8000-000000000000';

/** Fresh fake database + app for every test. Use at the top of a describe block. */
export function useApp() {
  const ctx = {} as { db: FakePrisma; api: TestServer };
  beforeEach(() => {
    ctx.db = new FakePrisma();
    ctx.api = startServer(ctx.db);
  });
  afterEach(() => {
    // nothing to tear down: no sockets are opened
  });
  return ctx;
}
