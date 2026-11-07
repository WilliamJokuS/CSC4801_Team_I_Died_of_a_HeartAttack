import { beforeEach, describe, expect, it } from 'vitest';
import { tokenFor, useApp } from '../support/server.js';

describe('FP-EMP-1 company profile', () => {
  const ctx = useApp();
  let me: string;
  let token: string;

  beforeEach(() => {
    me = ctx.db.addUser({ role: 'Employer', displayName: 'Acme HR', companyName: 'Acme Corp', description: 'We build things' });
    token = tokenFor(me, 'Employer');
  });

  const put = (body: unknown) => ctx.api.request('PUT', '/employers/me/profile', { token, body });

  it('views the company name and description', async () => {
    const res = await ctx.api.request('GET', '/employers/me/profile', { token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user_id: me, company_name: 'Acme Corp', description: 'We build things' });
  });

  it('edits the company profile and sees the change on the next read', async () => {
    const res = await put({ company_name: '  Acme Global  ', description: 'Now global' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ company_name: 'Acme Global', description: 'Now global' });
    expect((await ctx.api.request('GET', '/employers/me/profile', { token })).body.company_name).toBe('Acme Global');
  });

  it('a new company name appears on that employer\'s job postings', async () => {
    ctx.db.addJob({ employerId: me, title: 'Dev' });
    await put({ company_name: 'Renamed Inc', description: '' });
    const candidate = ctx.db.addUser({ role: 'Candidate' });
    const jobs = await ctx.api.request('GET', '/jobs', { token: tokenFor(candidate, 'Candidate') });
    expect(jobs.body[0].company_name).toBe('Renamed Inc');
  });

  it('accepts an empty description', async () => {
    expect((await put({ company_name: 'Acme', description: '' })).status).toBe(200);
  });

  it.each([
    ['empty company name', { company_name: '', description: 'd' }],
    ['whitespace-only company name', { company_name: '   ', description: 'd' }],
    ['company name over 200 chars', { company_name: 'c'.repeat(201), description: 'd' }],
    ['description over 5000 chars', { company_name: 'Acme', description: 'd'.repeat(5_001) }],
    ['missing description (PUT is a full replacement)', { company_name: 'Acme' }],
    ['missing company name', { description: 'd' }],
  ])('rejects %s with 400 and changes nothing', async (_n, body) => {
    const before = ctx.db.snapshot();
    const res = await put(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(ctx.db.snapshot()).toBe(before);
  });

  it('an update changes only the caller\'s profile, never another employer\'s', async () => {
    const other = ctx.db.addUser({ role: 'Employer', companyName: 'Globex' });
    await put({ company_name: 'Hijack', description: 'x', user_id: other });
    expect(ctx.db.companyProfiles.find((p) => p.userId === other)!.companyName).toBe('Globex');
  });
});

describe('FP-EMP-2 job postings', () => {
  const ctx = useApp();
  let me: string;
  let token: string;
  const body = { title: 'Backend Dev', description: 'Build APIs', required_skills: ['Python', ' SQL ', 'python'] };

  beforeEach(() => {
    me = ctx.db.addUser({ role: 'Employer', companyName: 'Acme Corp' });
    token = tokenFor(me, 'Employer');
  });

  const create = (b: unknown = body) => ctx.api.request('POST', '/jobs', { token, body: b });

  it('creates a job owned by the caller with normalized skills and company details', async () => {
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      employer_id: me,
      company_name: 'Acme Corp',
      title: 'Backend Dev',
      description: 'Build APIs',
      required_skills: ['python', 'sql'],
      tags: [],
    });
    expect(ctx.db.jobs).toHaveLength(1);
  });

  it('allows an empty required-skills list', async () => {
    const res = await create({ ...body, required_skills: [] });
    expect(res.status).toBe(201);
    expect(res.body.required_skills).toEqual([]);
  });

  it('ignores an employer_id supplied in the body: the job belongs to the caller', async () => {
    const other = ctx.db.addUser({ role: 'Employer' });
    const res = await create({ ...body, employer_id: other });
    expect(res.body.employer_id).toBe(me);
  });

  it.each([
    ['empty title', { ...body, title: '' }],
    ['whitespace-only title', { ...body, title: '   ' }],
    ['title over 200 chars', { ...body, title: 't'.repeat(201) }],
    ['empty description', { ...body, description: '' }],
    ['whitespace-only description', { ...body, description: '  \n ' }],
    ['description over 10000 chars', { ...body, description: 'd'.repeat(10_001) }],
    ['missing required_skills', { title: 't', description: 'd' }],
    ['required_skills not an array', { ...body, required_skills: 'python' }],
    ['a required skill over 50 chars', { ...body, required_skills: ['s'.repeat(51)] }],
    ['more than 10 tags', { ...body, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }],
    ['a tag over 30 chars', { ...body, tags: ['t'.repeat(31)] }],
  ])('rejects %s with 400 and creates nothing', async (_n, b) => {
    const res = await create(b);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(ctx.db.jobs).toHaveLength(0);
  });

  it('views a job (any authenticated user may), including the owner', async () => {
    const id = (await create()).body.id;
    const asCandidate = await ctx.api.request('GET', `/jobs/${id}`, { token: tokenFor(ctx.db.addUser({ role: 'Candidate' }), 'Candidate') });
    const asOwner = await ctx.api.request('GET', `/jobs/${id}`, { token });
    expect(asCandidate.status).toBe(200);
    expect(asOwner.body.title).toBe('Backend Dev');
  });

  it('edits a job: PUT replaces title, description, skills and tags', async () => {
    const id = (await create({ ...body, tags: ['Remote'] })).body.id;
    const res = await ctx.api.request('PUT', `/jobs/${id}`, {
      token,
      body: { title: 'Senior Dev', description: 'New text', required_skills: ['Go'], tags: ['Hybrid'] },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, title: 'Senior Dev', description: 'New text', required_skills: ['go'], tags: ['Hybrid'] });
    expect(ctx.db.jobs[0].title).toBe('Senior Dev');
  });

  it('PUT is a full replacement: omitting the optional tags clears them', async () => {
    const id = (await create({ ...body, tags: ['Remote', 'Full-time'] })).body.id;
    const res = await ctx.api.request('PUT', `/jobs/${id}`, { token, body });
    expect(res.body.tags).toEqual([]);
  });

  it('a failed edit (validation) leaves the job untouched', async () => {
    const id = (await create()).body.id;
    const before = ctx.db.snapshot();
    const res = await ctx.api.request('PUT', `/jobs/${id}`, { token, body: { ...body, title: '' } });
    expect(res.status).toBe(400);
    expect(ctx.db.snapshot()).toBe(before);
  });

  it('lists only the caller\'s own jobs on /jobs/mine, with applicant counts', async () => {
    const mine = (await create()).body.id;
    ctx.db.addJob({ employerId: ctx.db.addUser({ role: 'Employer' }), title: 'Not mine' });
    ctx.db.addApplication({ jobId: mine, candidateId: ctx.db.addUser({ role: 'Candidate' }) });
    ctx.db.addApplication({ jobId: mine, candidateId: ctx.db.addUser({ role: 'Candidate' }) });
    const res = await ctx.api.request('GET', '/jobs/mine', { token });
    expect(res.status).toBe(200);
    expect(res.body.map((j: any) => [j.id, j.applicant_count])).toEqual([[mine, 2]]);
  });

  describe('deleting a job', () => {
    it('a job with no applications is deleted: 204, then 404 and absent from every list', async () => {
      const id = (await create()).body.id;
      const del = await ctx.api.request('DELETE', `/jobs/${id}`, { token });
      expect(del.status).toBe(204);
      expect((await ctx.api.request('GET', `/jobs/${id}`, { token })).status).toBe(404);
      expect((await ctx.api.request('GET', '/jobs/mine', { token })).body).toEqual([]);
      const candidate = tokenFor(ctx.db.addUser({ role: 'Candidate' }), 'Candidate');
      expect((await ctx.api.request('GET', '/jobs', { token: candidate })).body).toEqual([]);
    });

    it('a job that has applications is 409 JOB_HAS_DEPENDENTS and nothing changes', async () => {
      const id = (await create()).body.id;
      const candidate = ctx.db.addUser({ role: 'Candidate' });
      ctx.db.addApplication({ jobId: id, candidateId: candidate, status: 'Interviewing' });
      const before = ctx.db.snapshot();
      const res = await ctx.api.request('DELETE', `/jobs/${id}`, { token });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('JOB_HAS_DEPENDENTS');
      expect(ctx.db.snapshot()).toBe(before);
      expect(ctx.db.jobs[0].isActive).toBe(true);
      expect(ctx.db.applications).toHaveLength(1);
    });

    it('applications in any status block deletion', async () => {
      for (const status of ['Pending', 'Interviewing', 'Rejected', 'Accepted'] as const) {
        const job = ctx.db.addJob({ employerId: me, title: status });
        ctx.db.addApplication({ jobId: job, candidateId: ctx.db.addUser({ role: 'Candidate' }), status });
        const res = await ctx.api.request('DELETE', `/jobs/${job}`, { token });
        expect(res.status, status).toBe(409);
      }
    });

    it('deleting twice: the second attempt is 404', async () => {
      const id = (await create()).body.id;
      await ctx.api.request('DELETE', `/jobs/${id}`, { token });
      expect((await ctx.api.request('DELETE', `/jobs/${id}`, { token })).status).toBe(404);
    });

    it('a deleted job cannot be edited or applied to', async () => {
      const id = (await create()).body.id;
      await ctx.api.request('DELETE', `/jobs/${id}`, { token });
      expect((await ctx.api.request('PUT', `/jobs/${id}`, { token, body })).status).toBe(404);
      const candidate = tokenFor(ctx.db.addUser({ role: 'Candidate' }), 'Candidate');
      expect((await ctx.api.request('POST', `/jobs/${id}/applications`, { token: candidate })).status).toBe(404);
    });
  });
});

describe('FP-EMP-3 applicant management', () => {
  const ctx = useApp();
  let employer: string;
  let token: string;
  let job: string;

  beforeEach(() => {
    employer = ctx.db.addUser({ role: 'Employer', companyName: 'Acme Corp' });
    token = tokenFor(employer, 'Employer');
    job = ctx.db.addJob({ employerId: employer, title: 'Backend Dev', requiredSkills: ['python', 'sql'] });
  });

  const applicant = (name: string, skills: string[], status: 'Pending' | 'Interviewing' | 'Rejected' | 'Accepted' = 'Pending') => {
    const id = ctx.db.addUser({ role: 'Candidate', displayName: name, skills, resumeText: `RESUME-OF-${name}` });
    const app = ctx.db.addApplication({ jobId: job, candidateId: id, status });
    return { id, app };
  };
  const applicants = async () => (await ctx.api.request('GET', `/jobs/${job}/applicants`, { token })).body as any[];

  it('lists applicants sorted by match score, highest first', async () => {
    applicant('Low', ['rust']);
    applicant('High', ['python', 'sql']);
    applicant('Mid', ['python']);
    expect((await applicants()).map((r) => [r.candidate.display_name, r.match_score])).toEqual([
      ['High', 100],
      ['Mid', 50],
      ['Low', 0],
    ]);
  });

  it('breaks score ties by case-insensitive display name, then candidate id', async () => {
    applicant('charlie', ['python']);
    applicant('Alice', ['python']);
    applicant('bob', ['python']);
    expect((await applicants()).map((r) => r.candidate.display_name)).toEqual(['Alice', 'bob', 'charlie']);
  });

  it('each row shows identity, skills, score, status and interview booking', async () => {
    const a = applicant('Dana', ['python'], 'Interviewing'); // stored skills are already normalized on write
    const slot = ctx.db.addSlot({ employerId: employer, start: new Date('2030-03-03T09:00:00Z'), isBooked: true });
    ctx.db.applications.find((x) => x.id === a.app)!.interviewSlotId = slot;
    const [row] = await applicants();
    expect(row).toMatchObject({
      id: a.app,
      status: 'Interviewing',
      match_score: 50,
      candidate: { id: a.id, display_name: 'Dana', skills: ['python'] },
      interview_slot: { id: slot, start_time: '2030-03-03T09:00:00.000Z', is_booked: true },
    });
  });

  it('shows interview_slot null when there is no booking', async () => {
    applicant('Eve', []);
    expect((await applicants())[0].interview_slot).toBeNull();
  });

  it('an empty applicant list is an empty array', async () => {
    expect(await applicants()).toEqual([]);
  });

  it('does not expose candidate resumes or emails', async () => {
    applicant('Fay', ['python']);
    const text = JSON.stringify(await applicants());
    expect(text).not.toContain('RESUME-OF-Fay');
    expect(text).not.toContain('@');
  });

  it('only lists applicants of the requested job', async () => {
    applicant('OnJob', ['python']);
    const other = ctx.db.addJob({ employerId: employer, title: 'Other' });
    ctx.db.addApplication({ jobId: other, candidateId: ctx.db.addUser({ role: 'Candidate', displayName: 'Elsewhere' }) });
    expect((await applicants()).map((r) => r.candidate.display_name)).toEqual(['OnJob']);
  });

  it('candidate and employer views use the same score for the same candidate and job', async () => {
    const cases: [string[], string[]][] = [
      [['Python', 'SQL'], ['python', 'sql']],
      [['Python'], ['python', 'sql']],
      [['rust'], ['python', 'sql']],
      [['x'], []],
      [['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e', 'f', 'g']],
    ];
    for (const [skills, required] of cases) {
      const e = ctx.db.addUser({ role: 'Employer' });
      const j = ctx.db.addJob({ employerId: e, title: 'J', requiredSkills: required });
      const c = ctx.db.addUser({ role: 'Candidate', skills });
      ctx.db.addApplication({ jobId: j, candidateId: c });
      const candidateView = (await ctx.api.request('GET', '/jobs', { token: tokenFor(c, 'Candidate') })).body.find((x: any) => x.id === j);
      const employerView = (await ctx.api.request('GET', `/jobs/${j}/applicants`, { token: tokenFor(e, 'Employer') })).body[0];
      expect(employerView.match_score, JSON.stringify([skills, required])).toBe(candidateView.match_score);
    }
  });

  describe('setting the application status', () => {
    it.each(['Pending', 'Interviewing', 'Rejected', 'Accepted'] as const)('the owner can set %s', async (status) => {
      const a = applicant('Gus', ['python'], status === 'Pending' ? 'Rejected' : 'Pending');
      const res = await ctx.api.request('PUT', `/applications/${a.app}/status`, { token, body: { status } });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
      expect(ctx.db.applications.find((x) => x.id === a.app)!.status).toBe(status);
    });

    it.each([
      ['an unknown status', { status: 'Hired' }],
      ['a lowercase status', { status: 'pending' }],
      ['an empty status', { status: '' }],
      ['a missing status', {}],
      ['a non-string status', { status: 1 }],
    ])('rejects %s with 400 and leaves the application unchanged', async (_n, body) => {
      const a = applicant('Hal', [], 'Pending');
      const res = await ctx.api.request('PUT', `/applications/${a.app}/status`, { token, body });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(ctx.db.applications.find((x) => x.id === a.app)!.status).toBe('Pending');
    });

    it('changing status never touches the candidate or job, only the status', async () => {
      const a = applicant('Ivy', ['python']);
      const res = await ctx.api.request('PUT', `/applications/${a.app}/status`, {
        token,
        body: { status: 'Accepted', candidate_id: employer, job_id: job },
      });
      expect(res.body).toMatchObject({ id: a.app, candidate_id: a.id, job_id: job, status: 'Accepted' });
    });

    it('another employer cannot change the status (403)', async () => {
      const a = applicant('Jon', []);
      const stranger = tokenFor(ctx.db.addUser({ role: 'Employer' }), 'Employer');
      const res = await ctx.api.request('PUT', `/applications/${a.app}/status`, { token: stranger, body: { status: 'Accepted' } });
      expect(res.status).toBe(403);
      expect(ctx.db.applications.find((x) => x.id === a.app)!.status).toBe('Pending');
    });
  });
});
