import { describe, expect, it } from 'vitest';
import { MISSING_ID, TEST_JWT_SECRET, tokenFor, useApp } from '../support/server.js';
import { signToken } from '../../../backend/src/auth/jwt.js';

const valid = {
  email: 'alice@example.test',
  password: 'correct-horse-battery',
  display_name: 'Alice',
  role: 'Candidate',
};

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('FP-AUTH-1 registration', () => {
  const ctx = useApp();

  it('registers a Candidate: 201 with a token and the AuthUser shape', async () => {
    const res = await ctx.api.request('POST', '/auth/register', { body: valid });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(Object.keys(res.body.user).sort()).toEqual(['created_at', 'display_name', 'email', 'id', 'role']);
    expect(res.body.user).toMatchObject({ email: 'alice@example.test', display_name: 'Alice', role: 'Candidate' });
  });

  it('creates the matching candidate profile row for a Candidate', async () => {
    const res = await ctx.api.request('POST', '/auth/register', { body: valid });
    expect(ctx.db.candidateProfiles.map((p) => p.userId)).toEqual([res.body.user.id]);
    expect(ctx.db.companyProfiles).toHaveLength(0);
  });

  it('registers an Employer and starts company_name as the display name', async () => {
    const res = await ctx.api.request('POST', '/auth/register', {
      body: { ...valid, email: 'hr@acme.test', display_name: 'Acme Corp', role: 'Employer' },
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('Employer');
    expect(ctx.db.companyProfiles).toMatchObject([{ userId: res.body.user.id, companyName: 'Acme Corp' }]);
    expect(ctx.db.candidateProfiles).toHaveLength(0);
  });

  it('trims and lowercases the email before storing it', async () => {
    const res = await ctx.api.request('POST', '/auth/register', { body: { ...valid, email: '  Alice@Example.TEST ' } });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.test');
    expect(ctx.db.users[0].email).toBe('alice@example.test');
  });

  it('keeps emails unique: a duplicate is 409 EMAIL_TAKEN and creates no second user', async () => {
    await ctx.api.request('POST', '/auth/register', { body: valid });
    const dup = await ctx.api.request('POST', '/auth/register', { body: { ...valid, display_name: 'Impostor' } });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
    expect(ctx.db.users).toHaveLength(1);
    expect(ctx.db.users[0].displayName).toBe('Alice');
  });

  it('treats emails that differ only by case as the same account', async () => {
    await ctx.api.request('POST', '/auth/register', { body: valid });
    const dup = await ctx.api.request('POST', '/auth/register', { body: { ...valid, email: 'ALICE@EXAMPLE.TEST' } });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('allows the same email to be used by only one role (no second account as Employer)', async () => {
    await ctx.api.request('POST', '/auth/register', { body: valid });
    const dup = await ctx.api.request('POST', '/auth/register', { body: { ...valid, role: 'Employer' } });
    expect(dup.status).toBe(409);
  });

  it.each([
    ['missing email', { ...valid, email: undefined }],
    ['malformed email', { ...valid, email: 'not-an-email' }],
    ['password under 8 characters', { ...valid, password: 'short' }],
    ['password over 72 bytes (bcrypt would silently truncate it)', { ...valid, password: 'x'.repeat(73) }],
    ['multi-byte password over 72 bytes', { ...valid, password: 'é'.repeat(40) }],
    ['empty display name', { ...valid, display_name: '' }],
    ['whitespace-only display name', { ...valid, display_name: '    ' }],
    ['display name over 100 characters', { ...valid, display_name: 'n'.repeat(101) }],
    ['a third role', { ...valid, role: 'Admin' }],
    ['lowercase role', { ...valid, role: 'candidate' }],
    ['missing role', { ...valid, role: undefined }],
  ])('rejects %s with 400 VALIDATION_ERROR and creates nothing', async (_name, body) => {
    const res = await ctx.api.request('POST', '/auth/register', { body });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(ctx.db.users).toHaveLength(0);
  });

  it('registers and authenticates an 8-byte Unicode password', async () => {
    const password = 'éééé';
    const registered = await ctx.api.request('POST', '/auth/register', { body: { ...valid, password } });
    expect(registered.status).toBe(201);
    const loggedIn = await ctx.api.request('POST', '/auth/login', { body: { email: valid.email, password } });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.user.id).toBe(registered.body.user.id);
  });

  it('accepts a password of exactly 72 bytes', async () => {
    const res = await ctx.api.request('POST', '/auth/register', { body: { ...valid, password: 'p'.repeat(72) } });
    expect(res.status).toBe(201);
  });

  it('rejects malformed JSON with 400 INVALID_JSON', async () => {
    const res = await ctx.api.request('POST', '/auth/register', { rawBody: '{"email": ' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('FP-AUTH-2 credential storage', () => {
  const ctx = useApp();

  it('stores a bcrypt hash (cost 12), never the plaintext password', async () => {
    await ctx.api.request('POST', '/auth/register', { body: valid });
    const stored = ctx.db.users[0].passwordHash;
    expect(stored).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
    expect(stored).not.toBe(valid.password);
    expect(stored).not.toContain(valid.password);
  });

  it('uses a random salt: the same password hashes differently for two users', async () => {
    await ctx.api.request('POST', '/auth/register', { body: valid });
    await ctx.api.request('POST', '/auth/register', { body: { ...valid, email: 'bob@example.test' } });
    const [a, b] = ctx.db.users.map((u) => u.passwordHash);
    expect(a).not.toBe(b);
  });

  it('never returns the password, its hash, or any credential from register, login or /me', async () => {
    const reg = await ctx.api.request('POST', '/auth/register', { body: valid });
    const login = await ctx.api.request('POST', '/auth/login', { body: { email: valid.email, password: valid.password } });
    const me = await ctx.api.request('GET', '/me', { token: login.body.token });
    const hash = ctx.db.users[0].passwordHash;
    for (const res of [reg, login, me]) {
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(hash);
      expect(text).not.toContain(valid.password);
      expect(text.toLowerCase()).not.toContain('password');
    }
  });
});

describe('FP-AUTH-1 login and logout', () => {
  const ctx = useApp();

  async function registered() {
    await ctx.api.request('POST', '/auth/register', { body: valid });
  }

  it('logs in with the right credentials: 200 with a token and the user', async () => {
    await registered();
    const res = await ctx.api.request('POST', '/auth/login', { body: { email: valid.email, password: valid.password } });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: valid.email, role: 'Candidate' });
    expect(typeof res.body.token).toBe('string');
  });

  it('login is case-insensitive on email and tolerates surrounding whitespace', async () => {
    await registered();
    const res = await ctx.api.request('POST', '/auth/login', {
      body: { email: '  ALICE@Example.Test ', password: valid.password },
    });
    expect(res.status).toBe(200);
  });

  it('the issued token authenticates GET /me', async () => {
    await registered();
    const login = await ctx.api.request('POST', '/auth/login', { body: { email: valid.email, password: valid.password } });
    const me = await ctx.api.request('GET', '/me', { token: login.body.token });
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(login.body.user.id);
  });

  it('a wrong password is 401 INVALID_CREDENTIALS', async () => {
    await registered();
    const res = await ctx.api.request('POST', '/auth/login', { body: { email: valid.email, password: 'wrong-password' } });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.token).toBeUndefined();
  });

  it('an unknown email gives exactly the same response as a wrong password (no account enumeration)', async () => {
    await registered();
    const wrongPassword = await ctx.api.request('POST', '/auth/login', { body: { email: valid.email, password: 'wrong-password' } });
    const unknownEmail = await ctx.api.request('POST', '/auth/login', { body: { email: 'nobody@example.test', password: 'wrong-password' } });
    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it.each([
    ['missing password', { email: valid.email }],
    ['empty password', { email: valid.email, password: '' }],
    ['malformed email', { email: 'nope', password: 'whatever1' }],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_n, body) => {
    const res = await ctx.api.request('POST', '/auth/login', { body });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logout returns 204 for a valid token', async () => {
    await registered();
    const login = await ctx.api.request('POST', '/auth/login', { body: { email: valid.email, password: valid.password } });
    const res = await ctx.api.request('POST', '/auth/logout', { token: login.body.token });
    expect(res.status).toBe(204);
  });

  it('logout without a token is 401', async () => {
    const res = await ctx.api.request('POST', '/auth/logout');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('FP-AUTH-3 token verification (401 cases)', () => {
  const ctx = useApp();

  it('no Authorization header is 401 UNAUTHORIZED', async () => {
    const res = await ctx.api.request('GET', '/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  });

  it.each(['', 'Bearer', 'Bearer ', 'Basic dXNlcjpwYXNz', 'Token abc', 'abc.def.ghi', 'Bearer not-a-jwt'])(
    'Authorization %j is 401',
    async (header) => {
      const res = await ctx.api.request('GET', '/me', { headers: header ? { Authorization: header } : {} });
      expect(res.status).toBe(401);
    },
  );

  it('a token signed with a different secret is 401', async () => {
    const user = ctx.db.addUser({ role: 'Candidate' });
    const forged = tokenFor(user, 'Candidate', 'a-completely-different-secret-value-1234567890');
    expect((await ctx.api.request('GET', '/me', { token: forged })).status).toBe(401);
  });

  it('an expired token is 401', async () => {
    const user = ctx.db.addUser({ role: 'Candidate' });
    const expired = signToken({ sub: user, role: 'Candidate' }, TEST_JWT_SECRET, '-1h');
    expect((await ctx.api.request('GET', '/me', { token: expired })).status).toBe(401);
  });

  it('a token whose payload was edited (role escalation) fails signature verification', async () => {
    const user = ctx.db.addUser({ role: 'Candidate' });
    const [header, , signature] = tokenFor(user, 'Candidate').split('.');
    const payload = b64url({ sub: user, role: 'Employer', iat: Math.floor(Date.now() / 1000), exp: 4_102_444_800 });
    const tampered = `${header}.${payload}.${signature}`;
    expect((await ctx.api.request('GET', '/me', { token: tampered })).status).toBe(401);
  });

  it('an unsigned token (alg "none") is 401', async () => {
    const user = ctx.db.addUser({ role: 'Employer' });
    const unsigned = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: user, role: 'Employer' })}.`;
    expect((await ctx.api.request('GET', '/me', { token: unsigned })).status).toBe(401);
  });

  it('a correctly signed token carrying an unknown role is 401', async () => {
    const user = ctx.db.addUser({ role: 'Candidate' });
    const odd = signToken({ sub: user, role: 'Admin' as never }, TEST_JWT_SECRET, '1h');
    expect((await ctx.api.request('GET', '/me', { token: odd })).status).toBe(401);
  });

  it('a valid token for a user that no longer exists is 401 on /me', async () => {
    const res = await ctx.api.request('GET', '/me', { token: tokenFor(MISSING_ID, 'Candidate') });
    expect(res.status).toBe(401);
  });
});
