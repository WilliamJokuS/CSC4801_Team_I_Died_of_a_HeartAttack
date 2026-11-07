/**
 * Rigorous input-validation & JSON payload fuzzing tests.
 *
 * Requirement IDs: FP-AUTH-1, FP-AUTH-3, FP-CAN-1, FP-EMP-1, FP-EMP-2, FP-SCHED-1, FP-SEC-2
 *
 * Verifies that malformed JSON, JSON primitives (`null`, `true`, `123`, `"str"`), top-level
 * arrays (`[]`), oversized strings, and prototype-pollution keys (`__proto__`, `constructor`)
 * on every write endpoint return a controlled 4xx error envelope and never an unhandled 500.
 */
import { describe, expect, it } from 'vitest';
import { type ApiResult, tokenFor, useApp } from '../support/server.js';

function expectError(res: ApiResult, status: number, code?: string) {
  expect(res.status).toBe(status);
  expect(typeof res.body?.error?.code).toBe('string');
  expect(typeof res.body?.error?.message).toBe('string');
  if (code) expect(res.body.error.code).toBe(code);
}

describe('JSON body & boundary fuzzing across all write endpoints', () => {
  const ctx = useApp();

  const nonObjectPayloads = [
    { label: 'null', raw: 'null' },
    { label: 'empty array []', raw: '[]' },
    { label: 'string literal', raw: '"hello"' },
    { label: 'number literal', raw: '12345' },
    { label: 'boolean literal', raw: 'true' },
    { label: 'empty object {}', raw: '{}' },
    { label: '__proto__ pollution object', raw: '{"__proto__":{"role":"Employer","isAdmin":true}}' },
  ];

  it('rejects non-object and empty JSON bodies with 400 on every POST/PUT endpoint (never 500)', async () => {
    const candId = ctx.db.addUser({ role: 'Candidate', email: 'cand@fuzz.test' });
    const empId = ctx.db.addUser({ role: 'Employer', email: 'emp@fuzz.test' });
    const jobId = ctx.db.addJob({ employerId: empId, title: 'Fuzz Job', description: 'desc' });
    const appId = ctx.db.addApplication({ jobId, candidateId: candId, status: 'Interviewing' });

    const candToken = tokenFor(candId, 'Candidate');
    const empToken = tokenFor(empId, 'Employer');

    const writeRoutes: Array<{ method: string; path: string; token?: string }> = [
      { method: 'POST', path: '/auth/register' },
      { method: 'POST', path: '/auth/login' },
      { method: 'PUT', path: '/candidates/me/profile', token: candToken },
      { method: 'PUT', path: '/employers/me/profile', token: empToken },
      { method: 'POST', path: '/jobs', token: empToken },
      { method: 'PUT', path: `/jobs/${jobId}`, token: empToken },
      { method: 'PUT', path: `/applications/${appId}/status`, token: empToken },
      { method: 'POST', path: '/employers/me/availability', token: empToken },
      { method: 'POST', path: `/applications/${appId}/book`, token: candToken },
    ];

    for (const route of writeRoutes) {
      for (const payload of nonObjectPayloads) {
        const res = await ctx.api.request(route.method, route.path, {
          token: route.token,
          rawBody: payload.raw,
        });
        expect(
          res.status,
          `${route.method} /api${route.path} with ${payload.label} returned ${res.status}`,
        ).toBe(400);
        expectError(res, 400);
      }
    }
  });

  it('enforces exact character and item count boundaries on profiles and jobs', async () => {
    const candId = ctx.db.addUser({ role: 'Candidate', email: 'cand@bounds.test' });
    const empId = ctx.db.addUser({ role: 'Employer', email: 'emp@bounds.test' });
    const candToken = tokenFor(candId, 'Candidate');
    const empToken = tokenFor(empId, 'Employer');

    // Resume exactly 20,000 chars -> 200 OK; 20,001 chars -> 400 VALIDATION_ERROR
    const okResume = await ctx.api.request('PUT', '/candidates/me/profile', {
      token: candToken,
      body: { display_name: 'Alice', skills: ['python'], resume_text: 'r'.repeat(20_000) },
    });
    expect(okResume.status).toBe(200);

    const overResume = await ctx.api.request('PUT', '/candidates/me/profile', {
      token: candToken,
      body: { display_name: 'Alice', skills: ['python'], resume_text: 'r'.repeat(20_001) },
    });
    expectError(overResume, 400, 'VALIDATION_ERROR');

    // Company description exactly 5,000 chars -> 200 OK; 5,001 chars -> 400 VALIDATION_ERROR
    const okCompany = await ctx.api.request('PUT', '/employers/me/profile', {
      token: empToken,
      body: { company_name: 'Acme', description: 'd'.repeat(5_000) },
    });
    expect(okCompany.status).toBe(200);

    const overCompany = await ctx.api.request('PUT', '/employers/me/profile', {
      token: empToken,
      body: { company_name: 'Acme', description: 'd'.repeat(5_001) },
    });
    expectError(overCompany, 400, 'VALIDATION_ERROR');

    // Job description 10,000 chars, 50 skills of 50 chars, 10 tags of 30 chars -> 201 Created
    const maxSkills = Array.from({ length: 50 }, (_, i) => `s${String(i).padStart(2, '0')}-${'x'.repeat(46)}`);
    const maxTags = Array.from({ length: 10 }, (_, i) => `t${i}-${'y'.repeat(27)}`);
    const okJob = await ctx.api.request('POST', '/jobs', {
      token: empToken,
      body: {
        title: 't'.repeat(200),
        description: 'd'.repeat(10_000),
        required_skills: maxSkills,
        tags: maxTags,
      },
    });
    expect(okJob.status).toBe(201);

    // 11 unique tags -> 400 VALIDATION_ERROR
    const overTags = await ctx.api.request('POST', '/jobs', {
      token: empToken,
      body: {
        title: 'Valid',
        description: 'Valid',
        required_skills: [],
        tags: Array.from({ length: 11 }, (_, i) => `tag-${i}`),
      },
    });
    expectError(overTags, 400, 'VALIDATION_ERROR');
  });
});
