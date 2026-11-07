import { beforeEach, describe, expect, it } from 'vitest';
import { tokenFor, useApp } from '../support/server.js';

const XSS = '<script>alert(1)</script>';

describe('FP-CAN-1 candidate profile and private resume', () => {
  const ctx = useApp();
  let me: string;
  let token: string;

  beforeEach(() => {
    me = ctx.db.addUser({ role: 'Candidate', displayName: 'Cara', skills: ['python'], resumeText: 'first resume' });
    token = tokenFor(me, 'Candidate');
  });

  const put = (body: unknown) => ctx.api.request('PUT', '/candidates/me/profile', { token, body });
  const full = { display_name: 'Cara', skills: ['python'], resume_text: 'resume' };

  it('views their own profile: name, skills and resume', async () => {
    const res = await ctx.api.request('GET', '/candidates/me/profile', { token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user_id: me, display_name: 'Cara', skills: ['python'], resume_text: 'first resume' });
  });

  it('edits the display name; it shows on /me and the profile', async () => {
    const res = await put({ ...full, display_name: '  Cara Prime  ' });
    expect(res.status).toBe(200);
    expect(res.body.display_name).toBe('Cara Prime');
    expect((await ctx.api.request('GET', '/me', { token })).body.display_name).toBe('Cara Prime');
  });

  it('saves skills normalized (trimmed, lowercased, no blanks, no duplicates)', async () => {
    const res = await put({ ...full, skills: ['  Python ', 'SQL', 'python', '', '   ', 'Sql'] });
    expect(res.body.skills).toEqual(['python', 'sql']);
    expect((await ctx.api.request('GET', '/candidates/me/profile', { token })).body.skills).toEqual(['python', 'sql']);
  });

  it('persists the raw-text resume and lets the owner view it again', async () => {
    const text = 'Line one\nLine two\n\tindented, with unicode é中文 and "quotes"';
    await put({ ...full, resume_text: text });
    expect((await ctx.api.request('GET', '/candidates/me/profile', { token })).body.resume_text).toBe(text);
  });

  it('lets the owner replace the resume; the old text is gone', async () => {
    await put({ ...full, resume_text: 'version two' });
    await put({ ...full, resume_text: 'version three' });
    const res = await ctx.api.request('GET', '/candidates/me/profile', { token });
    expect(res.body.resume_text).toBe('version three');
    expect(ctx.db.candidateProfiles[0].resumeText).toBe('version three');
  });

  it('accepts an empty resume (clearing it)', async () => {
    const res = await put({ ...full, resume_text: '' });
    expect(res.status).toBe(200);
    expect(res.body.resume_text).toBe('');
  });

  it('stores user text exactly as submitted: no HTML-escaping on write (SPEC §8, escaping happens at render time)', async () => {
    await put({ ...full, display_name: XSS, resume_text: XSS, skills: [XSS] });
    const stored = ctx.db.candidateProfiles[0];
    expect(stored.resumeText).toBe(XSS);
    expect(ctx.db.users[0].displayName).toBe(XSS);
    expect(stored.skills).toEqual([XSS.toLowerCase()]);
  });

  it.each([
    ['empty display name', { ...full, display_name: '' }],
    ['whitespace-only display name', { ...full, display_name: '   ' }],
    ['display name over 100 chars', { ...full, display_name: 'n'.repeat(101) }],
    ['resume over 20000 chars', { ...full, resume_text: 'r'.repeat(20_001) }],
    ['a skill over 50 chars', { ...full, skills: ['s'.repeat(51)] }],
    ['more than 50 skills', { ...full, skills: Array.from({ length: 51 }, (_, i) => `skill${i}`) }],
    ['skills that is not an array', { ...full, skills: 'python' }],
    ['non-string skill', { ...full, skills: [42] }],
    ['missing resume_text (PUT is a full replacement)', { display_name: 'Cara', skills: [] }],
    ['missing skills', { display_name: 'Cara', resume_text: '' }],
  ])('rejects %s with 400 and leaves the profile unchanged', async (_n, body) => {
    const before = ctx.db.snapshot();
    const res = await put(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(ctx.db.snapshot()).toBe(before);
  });

  it('accepts the maximum sizes: 20000-char resume, 50 skills of 50 chars', async () => {
    const res = await put({
      display_name: 'n'.repeat(100),
      skills: Array.from({ length: 50 }, (_, i) => `${i}`.padEnd(50, 'x')),
      resume_text: 'r'.repeat(20_000),
    });
    expect(res.status).toBe(200);
    expect(res.body.skills).toHaveLength(50);
  });

  it('saved skills are used by the matching function on the dashboard', async () => {
    const employer = ctx.db.addUser({ role: 'Employer' });
    ctx.db.addJob({ employerId: employer, title: 'Needs SQL', requiredSkills: ['sql'] });
    expect((await ctx.api.request('GET', '/jobs', { token })).body[0].match_score).toBe(0);
    await put({ ...full, skills: ['SQL'] });
    expect((await ctx.api.request('GET', '/jobs', { token })).body[0].match_score).toBe(100);
  });
});

describe('FP-CAN-2 recommendations dashboard', () => {
  const ctx = useApp();
  let me: string;
  let token: string;
  let employer: string;

  beforeEach(() => {
    me = ctx.db.addUser({ role: 'Candidate', skills: ['Python', 'SQL'] });
    token = tokenFor(me, 'Candidate');
    employer = ctx.db.addUser({ role: 'Employer', displayName: 'Acme', companyName: 'Acme Corp' });
  });

  const list = async () => (await ctx.api.request('GET', '/jobs', { token })).body as any[];

  it('lists every current job with title, company, required skills, description and a match score', async () => {
    ctx.db.addJob({ employerId: employer, title: 'Data Dev', description: 'Build pipelines', requiredSkills: ['python'], tags: ['Remote'] });
    const [job] = await list();
    expect(job).toMatchObject({
      title: 'Data Dev',
      description: 'Build pipelines',
      company_name: 'Acme Corp',
      required_skills: ['python'],
      tags: ['Remote'],
      match_score: 100,
      has_applied: false,
    });
  });

  it('shows the four required scoring examples through the API', async () => {
    // candidate "Python, SQL" is the profile above; vary the job instead of the candidate
    const a = ctx.db.addJob({ employerId: employer, title: 'A both', requiredSkills: ['Python', 'SQL'] });
    const b = ctx.db.addJob({ employerId: employer, title: 'B half', requiredSkills: ['Python', 'Rust'] });
    const c = ctx.db.addJob({ employerId: employer, title: 'C none', requiredSkills: ['Rust', 'Go'] });
    const d = ctx.db.addJob({ employerId: employer, title: 'D open', requiredSkills: [] });
    const scores = Object.fromEntries((await list()).map((j) => [j.id, j.match_score]));
    expect(scores).toEqual({ [a]: 100, [b]: 50, [c]: 0, [d]: 100 });
  });

  it('sorts from highest to lowest score', async () => {
    ctx.db.addJob({ employerId: employer, title: 'low', requiredSkills: ['rust'] });
    ctx.db.addJob({ employerId: employer, title: 'high', requiredSkills: ['python'] });
    ctx.db.addJob({ employerId: employer, title: 'mid', requiredSkills: ['python', 'rust'] });
    expect((await list()).map((j) => j.match_score)).toEqual([100, 50, 0]);
  });

  it('breaks ties by case-insensitive title, then by id', async () => {
    ctx.db.addJob({ employerId: employer, title: 'banana', requiredSkills: ['python'] });
    ctx.db.addJob({ employerId: employer, title: 'Apple', requiredSkills: ['python'] });
    ctx.db.addJob({ employerId: employer, title: 'cherry', requiredSkills: ['python'] });
    expect((await list()).map((j) => j.title)).toEqual(['Apple', 'banana', 'cherry']);
  });

  it('lists only current jobs: deleted jobs are absent', async () => {
    ctx.db.addJob({ employerId: employer, title: 'live' });
    ctx.db.addJob({ employerId: employer, title: 'gone', isActive: false });
    expect((await list()).map((j) => j.title)).toEqual(['live']);
  });

  it('resume text is never an input to the score', async () => {
    ctx.db.addJob({ employerId: employer, title: 'Rust job', requiredSkills: ['rust'] });
    const before = (await list())[0].match_score;
    await ctx.api.request('PUT', '/candidates/me/profile', {
      token,
      body: { display_name: 'X', skills: ['python', 'sql'], resume_text: 'rust rust rust expert in rust' },
    });
    expect((await list())[0].match_score).toBe(before);
    expect(before).toBe(0);
  });

  it('a candidate with no skills still sees every job, scored 0 (or 100 for open jobs)', async () => {
    const empty = ctx.db.addUser({ role: 'Candidate', skills: [] });
    ctx.db.addJob({ employerId: employer, title: 'needs', requiredSkills: ['a'] });
    ctx.db.addJob({ employerId: employer, title: 'open', requiredSkills: [] });
    const res = await ctx.api.request('GET', '/jobs', { token: tokenFor(empty, 'Candidate') });
    expect(res.body.map((j: any) => [j.title, j.match_score])).toEqual([['open', 100], ['needs', 0]]);
  });

  it('an empty marketplace is an empty array, not an error', async () => {
    const res = await ctx.api.request('GET', '/jobs', { token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('FP-CAN-3 applications', () => {
  const ctx = useApp();
  let me: string;
  let token: string;
  let employer: string;
  let job: string;

  beforeEach(() => {
    me = ctx.db.addUser({ role: 'Candidate', displayName: 'Cara', skills: ['python'] });
    token = tokenFor(me, 'Candidate');
    employer = ctx.db.addUser({ role: 'Employer', companyName: 'Acme Corp' });
    job = ctx.db.addJob({ employerId: employer, title: 'Backend Dev', requiredSkills: ['python', 'sql'] });
  });

  const apply = (jobId = job, t = token, body?: unknown) =>
    ctx.api.request('POST', `/jobs/${jobId}/applications`, { token: t, body });

  it('applying creates an application with status Pending owned by the caller', async () => {
    const res = await apply();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ job_id: job, candidate_id: me, status: 'Pending', interview_slot_id: null });
    expect(ctx.db.applications).toHaveLength(1);
  });

  it('a duplicate application is 409 ALREADY_APPLIED and creates no second row', async () => {
    await apply();
    const dup = await apply();
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ALREADY_APPLIED');
    expect(ctx.db.applications).toHaveLength(1);
  });

  it('different candidates can each apply to the same job, and one candidate to different jobs', async () => {
    const other = ctx.db.addUser({ role: 'Candidate' });
    const job2 = ctx.db.addJob({ employerId: employer, title: 'Second' });
    expect((await apply()).status).toBe(201);
    expect((await apply(job, tokenFor(other, 'Candidate'))).status).toBe(201);
    expect((await apply(job2)).status).toBe(201);
    expect(ctx.db.applications).toHaveLength(3);
  });

  it('applying to a missing or deleted job is 404 and creates nothing', async () => {
    const gone = ctx.db.addJob({ employerId: employer, isActive: false });
    expect((await apply(gone)).status).toBe(404);
    expect((await apply('00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect(ctx.db.applications).toHaveLength(0);
  });

  it('ignores any status or candidate_id in the body: always Pending and always the caller', async () => {
    const victim = ctx.db.addUser({ role: 'Candidate' });
    const res = await apply(job, token, { status: 'Accepted', candidate_id: victim });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Pending');
    expect(res.body.candidate_id).toBe(me);
  });

  it('marks the job has_applied on the dashboard afterwards', async () => {
    expect((await ctx.api.request('GET', '/jobs', { token })).body[0].has_applied).toBe(false);
    await apply();
    expect((await ctx.api.request('GET', '/jobs', { token })).body[0].has_applied).toBe(true);
  });

  it('shows the job, employer, status, match score and booking for each of the caller\'s applications', async () => {
    const app = ctx.db.addApplication({ jobId: job, candidateId: me, status: 'Interviewing' });
    const slot = ctx.db.addSlot({ employerId: employer, start: new Date('2030-01-01T10:00:00Z'), isBooked: true });
    ctx.db.applications.find((a) => a.id === app)!.interviewSlotId = slot;
    const res = await ctx.api.request('GET', '/applications/mine', { token });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: app,
      status: 'Interviewing',
      match_score: 50,
      job: { id: job, title: 'Backend Dev', company_name: 'Acme Corp' },
      interview_slot_id: slot,
      interview_slot: { id: slot, employer_id: employer, is_booked: true, start_time: '2030-01-01T10:00:00.000Z' },
    });
  });

  it('shows interview_slot null for an application with no booking', async () => {
    ctx.db.addApplication({ jobId: job, candidateId: me });
    expect((await ctx.api.request('GET', '/applications/mine', { token })).body[0].interview_slot).toBeNull();
  });

  it('lists the caller\'s applications newest first and never anyone else\'s', async () => {
    const job2 = ctx.db.addJob({ employerId: employer, title: 'Second' });
    const older = ctx.db.addApplication({ jobId: job, candidateId: me });
    const newer = ctx.db.addApplication({ jobId: job2, candidateId: me });
    ctx.db.applications.find((a) => a.id === older)!.createdAt = new Date('2026-01-01T00:00:00Z');
    ctx.db.applications.find((a) => a.id === newer)!.createdAt = new Date('2026-02-01T00:00:00Z');
    const other = ctx.db.addUser({ role: 'Candidate' });
    ctx.db.addApplication({ jobId: job, candidateId: other });
    const res = await ctx.api.request('GET', '/applications/mine', { token });
    expect(res.body.map((a: any) => a.id)).toEqual([newer, older]);
    expect(res.body.every((a: any) => a.candidate_id === me)).toBe(true);
  });

  it('an application row never carries resume text', async () => {
    ctx.db.candidateProfiles[0].resumeText = 'PRIVATE-RESUME-TEXT';
    ctx.db.addApplication({ jobId: job, candidateId: me });
    const res = await ctx.api.request('GET', '/applications/mine', { token });
    expect(JSON.stringify(res.body)).not.toContain('PRIVATE-RESUME-TEXT');
  });

  it('a candidate cannot change an application status (403) and the status stays', async () => {
    const app = ctx.db.addApplication({ jobId: job, candidateId: me, status: 'Pending' });
    const res = await ctx.api.request('PUT', `/applications/${app}/status`, { token, body: { status: 'Accepted' } });
    expect(res.status).toBe(403);
    expect(ctx.db.applications[0].status).toBe('Pending');
  });
});
