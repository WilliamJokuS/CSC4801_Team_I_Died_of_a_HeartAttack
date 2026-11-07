import { beforeEach, describe, expect, it } from 'vitest';
import { MISSING_ID, tokenFor, useApp } from '../support/server.js';

const future = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

/** Every protected endpoint in Contract/API_Contract.md, with the role it requires. */
const PROTECTED: { method: string; path: (id: string) => string; role: 'any' | 'Candidate' | 'Employer'; body?: unknown }[] = [
  { method: 'GET', path: () => '/me', role: 'any' },
  { method: 'POST', path: () => '/auth/logout', role: 'any' },
  { method: 'GET', path: (id) => `/jobs/${id}`, role: 'any' },
  { method: 'GET', path: () => '/candidates/me/profile', role: 'Candidate' },
  { method: 'PUT', path: () => '/candidates/me/profile', role: 'Candidate', body: { display_name: 'x', skills: [], resume_text: '' } },
  { method: 'GET', path: () => '/jobs', role: 'Candidate' },
  { method: 'POST', path: (id) => `/jobs/${id}/applications`, role: 'Candidate' },
  { method: 'GET', path: () => '/applications/mine', role: 'Candidate' },
  { method: 'GET', path: (id) => `/applications/${id}/available-slots`, role: 'Candidate' },
  { method: 'POST', path: (id) => `/applications/${id}/book`, role: 'Candidate', body: { slot_id: MISSING_ID } },
  { method: 'GET', path: () => '/employers/me/profile', role: 'Employer' },
  { method: 'PUT', path: () => '/employers/me/profile', role: 'Employer', body: { company_name: 'x', description: '' } },
  { method: 'POST', path: () => '/jobs', role: 'Employer', body: { title: 't', description: 'd', required_skills: [] } },
  { method: 'GET', path: () => '/jobs/mine', role: 'Employer' },
  { method: 'PUT', path: (id) => `/jobs/${id}`, role: 'Employer', body: { title: 't', description: 'd', required_skills: [] } },
  { method: 'DELETE', path: (id) => `/jobs/${id}`, role: 'Employer' },
  { method: 'GET', path: (id) => `/jobs/${id}/applicants`, role: 'Employer' },
  { method: 'PUT', path: (id) => `/applications/${id}/status`, role: 'Employer', body: { status: 'Pending' } },
  { method: 'GET', path: () => '/employers/me/availability', role: 'Employer' },
  { method: 'POST', path: () => '/employers/me/availability', role: 'Employer', body: { start_time: future(60), end_time: future(90) } },
  { method: 'DELETE', path: (id) => `/employers/me/availability/${id}`, role: 'Employer' },
];

const label = (r: (typeof PROTECTED)[number]) => `${r.method} ${r.path(':id')}`;

describe('FP-AUTH-3 unauthenticated requests are 401 on every protected endpoint', () => {
  const ctx = useApp();

  it.each(PROTECTED.map((r) => [label(r), r] as const))('%s', async (_l, route) => {
    const res = await ctx.api.request(route.method, route.path(MISSING_ID), { body: route.body });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('FP-AUTH-3 wrong role is 403 on every role-restricted endpoint', () => {
  const ctx = useApp();
  let candidate: string;
  let employer: string;

  beforeEach(() => {
    candidate = ctx.db.addUser({ role: 'Candidate' });
    employer = ctx.db.addUser({ role: 'Employer' });
  });

  const restricted = PROTECTED.filter((r) => r.role !== 'any');

  it.each(restricted.map((r) => [label(r) + ` (needs ${r.role})`, r] as const))('%s', async (_l, route) => {
    const wrong = route.role === 'Candidate' ? tokenFor(employer, 'Employer') : tokenFor(candidate, 'Candidate');
    const res = await ctx.api.request(route.method, route.path(MISSING_ID), { token: wrong, body: route.body });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('role is checked before the object is looked up: a wrong-role caller learns nothing about whether an id exists', async () => {
    const job = ctx.db.addJob({ employerId: employer });
    const real = await ctx.api.request('DELETE', `/jobs/${job}`, { token: tokenFor(candidate, 'Candidate') });
    const fake = await ctx.api.request('DELETE', `/jobs/${MISSING_ID}`, { token: tokenFor(candidate, 'Candidate') });
    expect(real.status).toBe(403);
    expect(fake.status).toBe(403);
    expect(ctx.db.jobs[0].isActive).toBe(true);
  });
});

describe('FP-AUTH-3 missing objects are 404', () => {
  const ctx = useApp();
  let candidate: string;
  let employer: string;

  beforeEach(() => {
    candidate = ctx.db.addUser({ role: 'Candidate' });
    employer = ctx.db.addUser({ role: 'Employer' });
  });

  const cases: [string, string, string, 'Candidate' | 'Employer', unknown?][] = [
    ['GET a job', 'GET', `/jobs/${MISSING_ID}`, 'Candidate'],
    ['PUT a job', 'PUT', `/jobs/${MISSING_ID}`, 'Employer', { title: 't', description: 'd', required_skills: [] }],
    ['DELETE a job', 'DELETE', `/jobs/${MISSING_ID}`, 'Employer'],
    ['list applicants of a job', 'GET', `/jobs/${MISSING_ID}/applicants`, 'Employer'],
    ['apply to a job', 'POST', `/jobs/${MISSING_ID}/applications`, 'Candidate'],
    ['set an application status', 'PUT', `/applications/${MISSING_ID}/status`, 'Employer', { status: 'Rejected' }],
    ['list available slots of an application', 'GET', `/applications/${MISSING_ID}/available-slots`, 'Candidate'],
    ['book with an application', 'POST', `/applications/${MISSING_ID}/book`, 'Candidate', { slot_id: MISSING_ID }],
    ['DELETE a slot', 'DELETE', `/employers/me/availability/${MISSING_ID}`, 'Employer'],
  ];

  it.each(cases)('%s that does not exist is 404 NOT_FOUND', async (_n, method, path, role, body) => {
    const token = role === 'Candidate' ? tokenFor(candidate, 'Candidate') : tokenFor(employer, 'Employer');
    const res = await ctx.api.request(method, path, { token, body });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each(['not-a-uuid', '123', '..%2F..%2Fetc', "1'%20OR%20'1'='1"])(
    'a path id that is not a UUID (%s) is 404, not a 400 or 500',
    async (id) => {
      const res = await ctx.api.request('GET', `/jobs/${id}`, { token: tokenFor(candidate, 'Candidate') });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  );

  it('an unknown route is 404 with the error envelope', async () => {
    const res = await ctx.api.request('GET', '/no/such/route', { token: tokenFor(candidate, 'Candidate') });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('a soft-deleted job is 404 for everyone', async () => {
    const job = ctx.db.addJob({ employerId: employer, isActive: false });
    expect((await ctx.api.request('GET', `/jobs/${job}`, { token: tokenFor(candidate, 'Candidate') })).status).toBe(404);
    expect((await ctx.api.request('PUT', `/jobs/${job}`, { token: tokenFor(employer, 'Employer'), body: { title: 't', description: 'd', required_skills: [] } })).status).toBe(404);
    expect((await ctx.api.request('GET', `/jobs/${job}/applicants`, { token: tokenFor(employer, 'Employer') })).status).toBe(404);
  });

  it('errors always use the { error: { code, message } } envelope', async () => {
    for (const res of [
      await ctx.api.request('GET', '/me'),
      await ctx.api.request('GET', `/jobs/${MISSING_ID}`, { token: tokenFor(candidate, 'Candidate') }),
      await ctx.api.request('GET', '/jobs/mine', { token: tokenFor(candidate, 'Candidate') }),
    ]) {
      expect(Object.keys(res.body)).toEqual(['error']);
      expect(Object.keys(res.body.error).sort()).toEqual(['code', 'message']);
    }
  });
});

describe('FP-SEC-1 object access: changing an id never bypasses authorization', () => {
  const ctx = useApp();
  let alice: string; // candidates
  let bob: string;
  let acme: string; // employers
  let globex: string;
  let acmeJob: string;
  let aliceApp: string;
  let bobApp: string;
  let acmeSlot: string;

  const as = (id: string, role: 'Candidate' | 'Employer') => tokenFor(id, role);

  beforeEach(() => {
    alice = ctx.db.addUser({ role: 'Candidate', displayName: 'Alice', skills: ['python'], resumeText: 'ALICE-SECRET-RESUME-7731' });
    bob = ctx.db.addUser({ role: 'Candidate', displayName: 'Bob', skills: ['sql'], resumeText: 'BOB-SECRET-RESUME-9042' });
    acme = ctx.db.addUser({ role: 'Employer', displayName: 'Acme' });
    globex = ctx.db.addUser({ role: 'Employer', displayName: 'Globex' });
    acmeJob = ctx.db.addJob({ employerId: acme, title: 'Acme Dev', requiredSkills: ['python'] });
    aliceApp = ctx.db.addApplication({ jobId: acmeJob, candidateId: alice, status: 'Interviewing' });
    bobApp = ctx.db.addApplication({ jobId: acmeJob, candidateId: bob, status: 'Interviewing' });
    acmeSlot = ctx.db.addSlot({ employerId: acme, start: new Date(Date.now() + 3_600_000) });
  });

  describe('1. a candidate cannot read or modify another candidate\'s resume or application', () => {
    it('each candidate\'s profile endpoint returns only their own resume', async () => {
      const a = await ctx.api.request('GET', '/candidates/me/profile', { token: as(alice, 'Candidate') });
      const b = await ctx.api.request('GET', '/candidates/me/profile', { token: as(bob, 'Candidate') });
      expect(a.body.resume_text).toBe('ALICE-SECRET-RESUME-7731');
      expect(b.body.resume_text).toBe('BOB-SECRET-RESUME-9042');
      expect(a.body.user_id).toBe(alice);
      expect(b.body.user_id).toBe(bob);
    });

    it('a profile update by Bob changes only Bob\'s row, whatever ids the body carries', async () => {
      const res = await ctx.api.request('PUT', '/candidates/me/profile', {
        token: as(bob, 'Candidate'),
        body: { user_id: alice, id: alice, display_name: 'Bob2', skills: ['x'], resume_text: 'overwritten' },
      });
      expect(res.status).toBe(200);
      expect(res.body.user_id).toBe(bob);
      const aliceRow = ctx.db.candidateProfiles.find((p) => p.userId === alice)!;
      expect(aliceRow.resumeText).toBe('ALICE-SECRET-RESUME-7731');
      expect(ctx.db.users.find((u) => u.id === alice)!.displayName).toBe('Alice');
    });

    it('there is no URL that serves another candidate\'s profile or resume by id', async () => {
      for (const path of [`/candidates/${alice}/profile`, `/candidates/${alice}`, `/candidates/${alice}/resume`, `/users/${alice}`]) {
        for (const [id, role] of [[bob, 'Candidate'], [acme, 'Employer']] as const) {
          const res = await ctx.api.request('GET', path, { token: as(id, role) });
          expect(res.status, `${role} GET ${path}`).not.toBe(200);
          expect(JSON.stringify(res.body)).not.toContain('ALICE-SECRET-RESUME-7731');
        }
      }
    });

    it('an employer cannot reach the candidate profile endpoint at all (403)', async () => {
      const res = await ctx.api.request('GET', '/candidates/me/profile', { token: as(acme, 'Employer') });
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain('SECRET-RESUME');
    });

    it('resume text never appears in any employer-facing response (applicants, jobs, slots)', async () => {
      const responses = [
        await ctx.api.request('GET', `/jobs/${acmeJob}/applicants`, { token: as(acme, 'Employer') }),
        await ctx.api.request('GET', '/jobs/mine', { token: as(acme, 'Employer') }),
        await ctx.api.request('GET', '/employers/me/availability', { token: as(acme, 'Employer') }),
      ];
      for (const r of responses) {
        expect(r.status).toBe(200);
        expect(JSON.stringify(r.body)).not.toContain('SECRET-RESUME');
        expect(JSON.stringify(r.body)).not.toContain('resume');
      }
    });

    it('GET /applications/mine returns only the caller\'s own applications', async () => {
      const a = await ctx.api.request('GET', '/applications/mine', { token: as(alice, 'Candidate') });
      const b = await ctx.api.request('GET', '/applications/mine', { token: as(bob, 'Candidate') });
      expect(a.body.map((x: any) => x.id)).toEqual([aliceApp]);
      expect(b.body.map((x: any) => x.id)).toEqual([bobApp]);
    });

    it('Bob cannot read Alice\'s application by id (403 on available-slots)', async () => {
      const res = await ctx.api.request('GET', `/applications/${aliceApp}/available-slots`, { token: as(bob, 'Candidate') });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('a candidate cannot change any application status, including their own (403)', async () => {
      for (const app of [aliceApp, bobApp]) {
        const res = await ctx.api.request('PUT', `/applications/${app}/status`, { token: as(alice, 'Candidate'), body: { status: 'Accepted' } });
        expect(res.status).toBe(403);
      }
      expect(ctx.db.applications.every((a) => a.status === 'Interviewing')).toBe(true);
    });
  });

  describe('2. an employer cannot modify another employer\'s job or read its applicant list', () => {
    const body = { title: 'Hijacked', description: 'pwned', required_skills: [] };

    it('PUT another employer\'s job is 403 and the job is unchanged', async () => {
      const res = await ctx.api.request('PUT', `/jobs/${acmeJob}`, { token: as(globex, 'Employer'), body });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(ctx.db.jobs[0].title).toBe('Acme Dev');
    });

    it('DELETE another employer\'s job is 403 and the job stays active', async () => {
      const res = await ctx.api.request('DELETE', `/jobs/${acmeJob}`, { token: as(globex, 'Employer') });
      expect(res.status).toBe(403);
      expect(ctx.db.jobs[0].isActive).toBe(true);
    });

    it('GET another employer\'s applicant list is 403 and discloses no applicant', async () => {
      const res = await ctx.api.request('GET', `/jobs/${acmeJob}/applicants`, { token: as(globex, 'Employer') });
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain('Alice');
      expect(JSON.stringify(res.body)).not.toContain('Bob');
    });

    it('setting the status of an application to another employer\'s job is 403 and unchanged', async () => {
      const res = await ctx.api.request('PUT', `/applications/${aliceApp}/status`, { token: as(globex, 'Employer'), body: { status: 'Rejected' } });
      expect(res.status).toBe(403);
      expect(ctx.db.applications.find((a) => a.id === aliceApp)!.status).toBe('Interviewing');
    });

    it('deleting another employer\'s availability slot is 403 and the slot remains', async () => {
      const res = await ctx.api.request('DELETE', `/employers/me/availability/${acmeSlot}`, { token: as(globex, 'Employer') });
      expect(res.status).toBe(403);
      expect(ctx.db.slots).toHaveLength(1);
    });

    it('an employer\'s availability list shows only their own slots', async () => {
      const res = await ctx.api.request('GET', '/employers/me/availability', { token: as(globex, 'Employer') });
      expect(res.body).toEqual([]);
    });

    it('a missing job is 404 for a non-owner while an existing one is 403 (404 is checked first)', async () => {
      const missing = await ctx.api.request('PUT', `/jobs/${MISSING_ID}`, { token: as(globex, 'Employer'), body });
      const foreign = await ctx.api.request('PUT', `/jobs/${acmeJob}`, { token: as(globex, 'Employer'), body });
      expect(missing.status).toBe(404);
      expect(foreign.status).toBe(403);
    });

    it('the rightful owner can still do all of it (the checks are not simply denying everyone)', async () => {
      const put = await ctx.api.request('PUT', `/jobs/${acmeJob}`, { token: as(acme, 'Employer'), body: { ...body, title: 'Acme Dev v2' } });
      const list = await ctx.api.request('GET', `/jobs/${acmeJob}/applicants`, { token: as(acme, 'Employer') });
      expect(put.status).toBe(200);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(2);
    });
  });

  describe('3. a candidate cannot book a slot using another candidate\'s application', () => {
    it('Bob booking with Alice\'s application id is 403 and nothing is linked', async () => {
      const before = ctx.db.snapshot();
      const res = await ctx.api.request('POST', `/applications/${aliceApp}/book`, { token: as(bob, 'Candidate'), body: { slot_id: acmeSlot } });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(ctx.db.snapshot()).toBe(before);
    });

    it('the owner can book with the same slot afterwards (the failed attempt did not consume it)', async () => {
      await ctx.api.request('POST', `/applications/${aliceApp}/book`, { token: as(bob, 'Candidate'), body: { slot_id: acmeSlot } });
      const ok = await ctx.api.request('POST', `/applications/${aliceApp}/book`, { token: as(alice, 'Candidate'), body: { slot_id: acmeSlot } });
      expect(ok.status).toBe(200);
      expect(ok.body.interview_slot_id).toBe(acmeSlot);
    });

    it('an employer cannot book on a candidate\'s behalf (403)', async () => {
      const res = await ctx.api.request('POST', `/applications/${aliceApp}/book`, { token: as(acme, 'Employer'), body: { slot_id: acmeSlot } });
      expect(res.status).toBe(403);
    });

    it('a slot belonging to a different employer than the job\'s is reported as 404', async () => {
      const foreignSlot = ctx.db.addSlot({ employerId: globex, start: new Date(Date.now() + 3_600_000) });
      const res = await ctx.api.request('POST', `/applications/${aliceApp}/book`, { token: as(alice, 'Candidate'), body: { slot_id: foreignSlot } });
      expect(res.status).toBe(404);
    });
  });
});
