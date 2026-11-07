import { beforeEach, describe, expect, it } from 'vitest';
import { bookSlot, deleteSlot } from '../../../backend/src/scheduling/service.js';
import { apply } from '../../../backend/src/applications/service.js';
import { deleteJob, getJob } from '../../../backend/src/jobs/service.js';
import { MISSING_ID, tokenFor, useApp } from '../support/server.js';
import { expectHttpError, expectValidationError } from '../support/assertions.js';
import { FakePrisma } from '../support/fakePrisma.js';

/**
 * FP-SEC-2. The backend only reaches the database through Prisma. Two things have to hold and
 * both are checked here against the real services:
 *   1. Hostile text is passed to Prisma as DATA (a bound value in `where` / `data`), never
 *      spliced into SQL text.
 *   2. The few hand-written $queryRaw statements are tagged templates (Prisma turns each
 *      `${...}` into a bound parameter), and they only ever receive validated UUIDs.
 */
const PAYLOADS = [
  "'; DROP TABLE users; --",
  "' OR '1'='1",
  "1; DELETE FROM jobs WHERE '1'='1",
  "Robert'); DROP TABLE applications;--",
  '" OR ""="',
  "' UNION SELECT password_hash FROM users --",
  '\\\'; SELECT pg_sleep(10); --',
  '%\' OR 1=1 --',
];

const allQueryText = (db: FakePrisma) => db.rawQueries.map((q) => q.text).join('\n');

describe('FP-SEC-2 hostile text is stored and queried as data', () => {
  const ctx = useApp();

  it.each(PAYLOADS)('round-trips %j through profile, company and job text unchanged', async (payload) => {
    const candidate = ctx.db.addUser({ role: 'Candidate' });
    const employer = ctx.db.addUser({ role: 'Employer' });
    const c = tokenFor(candidate, 'Candidate');
    const e = tokenFor(employer, 'Employer');

    const profile = await ctx.api.request('PUT', '/candidates/me/profile', {
      token: c,
      body: { display_name: payload, skills: [], resume_text: payload },
    });
    const company = await ctx.api.request('PUT', '/employers/me/profile', { token: e, body: { company_name: payload, description: payload } });
    const job = await ctx.api.request('POST', '/jobs', { token: e, body: { title: payload, description: payload, required_skills: [], tags: [] } });

    expect(profile.status).toBe(200);
    expect(company.status).toBe(200);
    expect(job.status).toBe(201);
    expect(profile.body.display_name).toBe(payload.trim());
    expect(profile.body.resume_text).toBe(payload);
    expect(company.body.description).toBe(payload);
    expect(job.body.title).toBe(payload.trim());

    // the tables the payloads try to drop or empty are intact
    expect(ctx.db.users).toHaveLength(2);
    expect(ctx.db.jobs).toHaveLength(1);
    // and none of it reached SQL text
    expect(allQueryText(ctx.db)).not.toContain('DROP');
    expect(allQueryText(ctx.db)).not.toContain(payload);
  });

  it.each(PAYLOADS)('login with %j as the password never matches anyone and is just a bound string', async (payload) => {
    ctx.db.addUser({ role: 'Candidate', email: 'victim@example.test' });
    const res = await ctx.api.request('POST', '/auth/login', { body: { email: 'victim@example.test', password: payload } });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('an email containing SQL metacharacters reaches the lookup as one exact bound value', async () => {
    const hostile = "o'brien--@example.test";
    ctx.db.addUser({ role: 'Candidate', email: hostile });
    await ctx.api.request('POST', '/auth/login', { body: { email: hostile, password: 'whatever1' } });
    const lookup = ctx.db.calls.find((c) => c.model === 'user' && c.method === 'findUnique');
    expect(lookup?.args.where).toEqual({ email: hostile });
  });

  it("emails that are not valid emails (the classic ' OR '1'='1) are refused before any query runs", async () => {
    const res = await ctx.api.request('POST', '/auth/login', { body: { email: "' OR '1'='1", password: 'x' } });
    expect(res.status).toBe(400);
    expect(ctx.db.calls.filter((c) => c.model === 'user')).toHaveLength(0);
  });

  it('registration with a payload for every text field stores it verbatim and does not break uniqueness', async () => {
    const res = await ctx.api.request('POST', '/auth/register', {
      body: { email: 'a@example.test', password: 'a-long-enough-pw', display_name: "x'); DROP TABLE users;--", role: 'Candidate' },
    });
    expect(res.status).toBe(201);
    expect(ctx.db.users[0].displayName).toBe("x'); DROP TABLE users;--");
    expect(ctx.db.users).toHaveLength(1);
  });
});

describe('FP-SEC-2 ids are validated before they can reach SQL', () => {
  const ctx = useApp();
  let employer: string;
  let candidate: string;

  beforeEach(() => {
    employer = ctx.db.addUser({ role: 'Employer' });
    candidate = ctx.db.addUser({ role: 'Candidate' });
    ctx.db.addJob({ employerId: employer });
  });

  it.each(PAYLOADS)('a path id of %j is a 404 and no raw SQL runs for any id-taking route', async (payload) => {
    const enc = encodeURIComponent(payload);
    const e = tokenFor(employer, 'Employer');
    const c = tokenFor(candidate, 'Candidate');
    const attempts = [
      ctx.api.request('GET', `/jobs/${enc}`, { token: c }),
      ctx.api.request('PUT', `/jobs/${enc}`, { token: e, body: { title: 't', description: 'd', required_skills: [] } }),
      ctx.api.request('DELETE', `/jobs/${enc}`, { token: e }),
      ctx.api.request('GET', `/jobs/${enc}/applicants`, { token: e }),
      ctx.api.request('POST', `/jobs/${enc}/applications`, { token: c }),
      ctx.api.request('PUT', `/applications/${enc}/status`, { token: e, body: { status: 'Pending' } }),
      ctx.api.request('GET', `/applications/${enc}/available-slots`, { token: c }),
      ctx.api.request('POST', `/applications/${enc}/book`, { token: c, body: { slot_id: MISSING_ID } }),
      ctx.api.request('DELETE', `/employers/me/availability/${enc}`, { token: e }),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(404);
    }
    expect(ctx.db.rawQueries).toHaveLength(0);
    expect(ctx.db.jobs).toHaveLength(1);
  });

  it.each(PAYLOADS)('a slot_id body of %j is rejected by validation, so it never reaches the booking SQL', async (payload) => {
    const job = ctx.db.jobs[0].id;
    const app = ctx.db.addApplication({ jobId: job, candidateId: candidate, status: 'Interviewing' });
    await expectValidationError(bookSlot({ prisma: ctx.db.client }, candidate, app, { slot_id: payload }));
    expect(ctx.db.rawQueries).toHaveLength(0);
  });

  it('even a service called directly with a hostile id (bypassing the router) never concatenates it into SQL', async () => {
    const payload = "'; DROP TABLE jobs; --";
    const deps = { prisma: ctx.db.client };
    await expectHttpError(getJob(deps, payload), 404);
    await expectHttpError(deleteJob(deps, employer, payload), 404);
    await expectHttpError(deleteSlot(deps, employer, payload), 404);
    // apply() locks the job with a tagged template, so the value must travel as a bound parameter
    await expectHttpError(apply(deps, candidate, payload), 404);
    for (const q of ctx.db.rawQueries) {
      expect(q.text).not.toContain('DROP');
      expect(q.text).not.toContain(payload);
      expect(q.values).toContain(payload); // present only as a bound value
    }
    expect(ctx.db.rawQueries.length).toBeGreaterThan(0);
    expect(ctx.db.jobs).toHaveLength(1);
  });

  it('every raw statement the booking flow issues carries its ids as bound values, not in the SQL text', async () => {
    const app = ctx.db.addApplication({ jobId: ctx.db.jobs[0].id, candidateId: candidate, status: 'Interviewing' });
    const slot = ctx.db.addSlot({ employerId: employer, start: new Date(Date.now() + 3_600_000) });
    await bookSlot({ prisma: ctx.db.client }, candidate, app, { slot_id: slot });
    expect(ctx.db.rawQueries.length).toBeGreaterThan(0);
    for (const q of ctx.db.rawQueries) {
      expect(q.text).not.toContain(app);
      expect(q.text).not.toContain(slot);
      expect(q.text).toContain('?');
      expect(q.values.every((v) => typeof v === 'string')).toBe(true);
    }
    expect(ctx.db.rawQueries.flatMap((q) => q.values)).toEqual(expect.arrayContaining([app, slot]));
  });
});
