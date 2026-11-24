import inject from 'light-my-request';
import { expect, it, vi } from 'vitest';
import { createApp } from '../../../backend/src/app.js';
import { FakePrisma } from '../support/fakePrisma.js';
import { TEST_JWT_SECRET } from '../support/server.js';

function appWithLimits(db: FakePrisma, requestsPerMinute: number, concurrency: number) {
  return createApp({
    prisma: db.client,
    jwtSecret: TEST_JWT_SECRET,
    jwtExpiresIn: '1h',
    authLimits: { requestsPerMinute, concurrency },
  });
}

it('shares the live auth rate limit between login and registration without affecting health', async () => {
  const app = appWithLimits(new FakePrisma(), 1, 4);
  const first = await inject(app, { method: 'POST', url: '/api/auth/login', payload: {} });
  expect(first.statusCode).toBe(400);

  const next = await inject(app, { method: 'POST', url: '/api/auth/register', payload: {} });
  expect(next.statusCode).toBe(429);
  expect(next.headers['retry-after']).toBeDefined();
  expect(next.json()).toMatchObject({ error: { code: 'AUTH_RATE_LIMITED' } });
  expect((await inject(app, { method: 'GET', url: '/api/health' })).statusCode).toBe(200);
});

it('rejects excess concurrent auth work and releases capacity after the request finishes', async () => {
  const db = new FakePrisma();
  const app = appWithLimits(db, 20, 1);
  let notifyStarted!: () => void;
  const started = new Promise<void>((resolve) => { notifyStarted = resolve; });
  let complete!: () => void;
  const blocked = new Promise<void>((resolve) => { complete = resolve; });
  vi.spyOn(db.client.user, 'findUnique').mockImplementationOnce(async () => {
    notifyStarted();
    await blocked;
    return null;
  });
  const login = () => inject(app, {
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'unknown@demo.test', password: 'test-password' },
  });
  const pending = Promise.resolve(login());
  try {
    await started;
    const concurrent = await inject(app, { method: 'POST', url: '/api/auth/register', payload: {} });
    expect(concurrent.statusCode).toBe(503);
    expect(concurrent.headers['retry-after']).toBe('1');
    expect(concurrent.json()).toMatchObject({ error: { code: 'AUTH_BUSY' } });
  } finally {
    complete();
    const response = await pending;
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } });
  }
  expect((await login()).statusCode).toBe(401);
});
