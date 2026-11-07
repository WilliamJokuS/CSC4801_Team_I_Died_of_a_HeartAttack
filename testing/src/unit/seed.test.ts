import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyPassword } from '../../../backend/src/auth/password.js';
import { matchScore } from '../../../backend/src/matching/index.js';
import { useApp } from '../support/server.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const seedSql = readFileSync(join(ROOT, 'backend/prisma/sql/seed.sql'), 'utf8');
const resetSql = readFileSync(join(ROOT, 'backend/prisma/sql/reset.sql'), 'utf8');

/** Parses tuple rows from a multi-row INSERT block in seed.sql for deterministic verification. */
function parseInsertBlock(sql: string, table: string): string[][] {
  const regex = new RegExp(`INSERT INTO ${table}\\s*\\([^)]+\\)\\s*VALUES([\\s\\S]*?\\));`, 'm');
  const match = sql.match(regex);
  if (!match) return [];
  const block = match[1];
  const rows: string[][] = [];
  for (const line of block.split('\n')) {
    const trimmed = line.replace(/--.*$/, '').trim();
    if (!trimmed.startsWith('(')) continue;
    const inner = trimmed.replace(/^\(/, '').replace(/\)[,;]?$/, '');
    const cols: string[] = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (ch === "'" && inner[i - 1] !== '\\') {
        inQuote = !inQuote;
        current += ch;
      } else if (ch === ',' && !inQuote) {
        cols.push(current.trim().replace(/^'|'$/g, ''));
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim().replace(/^'|'$/g, ''));
    rows.push(cols);
  }
  return rows;
}

describe('FP-DOC-3 deterministic seed and reset SQL', () => {
  const users = parseInsertBlock(seedSql, 'users');
  const candidateProfiles = parseInsertBlock(seedSql, 'candidate_profiles');
  const jobs = parseInsertBlock(seedSql, 'jobs');
  const slots = parseInsertBlock(seedSql, 'availability_slots');
  const applications = parseInsertBlock(seedSql, 'applications');

  it('reset.sql truncates all six application tables with CASCADE', () => {
    for (const table of ['applications', 'availability_slots', 'jobs', 'company_profiles', 'candidate_profiles', 'users']) {
      expect(resetSql).toContain(table);
    }
    expect(resetSql).toMatch(/TRUNCATE TABLE[\s\S]*CASCADE/i);
  });

  it('clearly marks seed credentials as local/demo credentials only', () => {
    expect(seedSql).toMatch(/LOCAL\s*\/\s*DEMO CREDENTIALS ONLY/i);
  });

  it('includes at least two candidates and two employers with valid bcrypt hashes for password123', async () => {
    const candidates = users.filter((u) => u[3] === 'Candidate');
    const employers = users.filter((u) => u[3] === 'Employer');
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(employers.length).toBeGreaterThanOrEqual(2);

    const hashes = new Set(users.map((u) => u[2]));
    for (const hash of hashes) {
      expect(await verifyPassword('password123', hash)).toBe(true);
    }
  });

  it('includes at least two jobs with non-empty required skills', () => {
    const withSkills = jobs.filter((j) => {
      const parsed = JSON.parse(j[4]) as string[];
      return parsed.length > 0;
    });
    expect(withSkills.length).toBeGreaterThanOrEqual(2);
  });

  it('includes the four required FP-MATCH-1 examples against seeded candidates and jobs', () => {
    const skillsByUser = new Map(candidateProfiles.map((p) => [p[0], JSON.parse(p[1]) as string[]]));
    const jobById = new Map(jobs.map((j) => [j[0], { title: j[2], required: JSON.parse(j[4]) as string[] }]));

    const dataAnalyst = jobById.get('33333333-0000-4000-8000-000000000001')!;
    const generalist = jobById.get('33333333-0000-4000-8000-000000000002')!;
    expect(dataAnalyst.required).toEqual(['python', 'sql']);
    expect(generalist.required).toEqual([]);

    const alice = skillsByUser.get('11111111-0000-4000-8000-000000000001')!;
    const bob = skillsByUser.get('11111111-0000-4000-8000-000000000002')!;
    const chen = skillsByUser.get('11111111-0000-4000-8000-000000000003')!;

    expect(alice).toEqual(['python', 'sql']);
    expect(bob).toEqual(['python']);
    expect(chen).toEqual(['rust']);

    expect(matchScore(alice, dataAnalyst.required)).toBe(100);
    expect(matchScore(bob, dataAnalyst.required)).toBe(50);
    expect(matchScore(chen, dataAnalyst.required)).toBe(0);
    expect(matchScore(chen, generalist.required)).toBe(100);
  });

  it('includes applications covering all four statuses (Pending, Interviewing, Rejected, Accepted)', () => {
    const statuses = new Set(applications.map((a) => a[3]));
    expect(statuses).toEqual(new Set(['Pending', 'Interviewing', 'Rejected', 'Accepted']));
  });

  it('includes two Interviewing candidates without bookings eligible to race for the same available slot', () => {
    const jobEmployer = new Map(jobs.map((j) => [j[0], j[1]]));
    const openSlotsByEmployer = new Map<string, string[]>();
    for (const s of slots) {
      if (s[4] === 'false') {
        const list = openSlotsByEmployer.get(s[1]) ?? [];
        list.push(s[0]);
        openSlotsByEmployer.set(s[1], list);
      }
    }

    const interviewingUnbooked = applications.filter((a) => a[3] === 'Interviewing' && a[5] === 'NULL');
    const byEmployer = new Map<string, string[]>();
    for (const app of interviewingUnbooked) {
      const emp = jobEmployer.get(app[1])!;
      if ((openSlotsByEmployer.get(emp) ?? []).length > 0) {
        const list = byEmployer.get(emp) ?? [];
        list.push(app[2]);
        byEmployer.set(emp, list);
      }
    }
    const racingPair = [...byEmployer.values()].find((candidates) => new Set(candidates).size >= 2);
    expect(racingPair, 'expected at least two distinct Interviewing candidates sharing an employer with open slots').toBeDefined();
  });
});

describe('FP-ARCH-1 health check endpoint (/api/health)', () => {
  const ctx = useApp();

  it('returns 200 { status: "ok" } when the database responds', async () => {
    const res = await ctx.api.request('GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns 503 DB_UNAVAILABLE when the database query fails', async () => {
    ctx.db.$queryRaw = async () => {
      throw new Error('connection refused');
    };
    const res = await ctx.api.request('GET', '/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { code: 'DB_UNAVAILABLE', message: 'Database unreachable' } });
  });
});
