import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Code-review style checks that back up the behavioural tests: they read (never edit) the
 * team's source to confirm project-wide rules from AGENTS.md / SPEC.md / REQUIREMENTS.md.
 */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const rel = (p: string) => relative(ROOT, p).replaceAll('\\', '/');

function walk(dir: string, accept: (file: string) => boolean, skip: (dir: string) => boolean = () => false): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || skip(full)) continue;
      out.push(...walk(full, accept, skip));
    } else if (accept(full)) out.push(full);
  }
  return out;
}

const backendFiles = walk(join(ROOT, 'backend/src'), (f) => f.endsWith('.ts'), (d) => d.includes('generated'));
const frontendFiles = walk(join(ROOT, 'frontend/src'), (f) => /\.(ts|tsx)$/.test(f));
const read = (f: string) => readFileSync(f, 'utf8');

/** Source with // and block comments removed, so prose mentioning an API doesn't trip a check. */
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('FP-SEC-2 backend database access is parameterized', () => {
  it('found the backend sources to inspect', () => {
    expect(backendFiles.length).toBeGreaterThan(10);
  });

  it('never uses Prisma\'s unsafe raw APIs or string-built SQL', () => {
    const offenders = backendFiles.filter((f) => /\$(queryRaw|executeRaw)Unsafe|Prisma\.raw\(|Prisma\.sql\b|Prisma\.join\(/.test(code(f)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('every $queryRaw / $executeRaw call is a tagged template (so ${...} becomes a bound parameter)', () => {
    let total = 0;
    for (const f of backendFiles) {
      const src = code(f);
      const all = src.match(/\$(queryRaw|executeRaw)/g)?.length ?? 0;
      const tagged = src.match(/\$(queryRaw|executeRaw)(<[^`(]*>)?`/g)?.length ?? 0;
      expect(tagged, `${rel(f)}: ${all} raw calls but ${tagged} tagged templates`).toBe(all);
      total += all;
    }
    expect(total).toBeGreaterThan(0); // the check really looked at something
  });

  it('no SQL is built by concatenating or interpolating into a plain string', () => {
    const sqlWord = /\b(SELECT|INSERT|UPDATE|DELETE)\b[^`'"\n]*\b(FROM|INTO|SET|WHERE)\b/i;
    const offenders: string[] = [];
    for (const f of backendFiles) {
      for (const line of code(f).split('\n')) {
        if (!sqlWord.test(line)) continue;
        const inTaggedTemplate = /`/.test(line) || !/['"]\s*\+|\+\s*['"]|\$\{/.test(line);
        if (!inTaggedTemplate) offenders.push(`${rel(f)}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('FP-SEC-3 / AGENTS.md rule 6: escaping happens once, at render time, in frontend/', () => {
  it('the frontend never injects user text as raw HTML', () => {
    const offenders = frontendFiles.filter((f) => /dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML|document\.write\(|\beval\(|new Function\(/.test(code(f)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('the backend does not HTML-escape on write (that would double-escape at render, SPEC §8)', () => {
    const offenders = backendFiles.filter((f) => /escapeHtml|escape-html|\bhe\.encode|sanitize-html|DOMPurify|xss\(/i.test(code(f)));
    expect(offenders.map(rel)).toEqual([]);
  });
});

describe('FP-MATCH-1 there is exactly one scoring implementation', () => {
  it('matchScore is defined once, in backend/src/matching/index.ts', () => {
    const definers = backendFiles.filter((f) => /function\s+matchScore\b|const\s+matchScore\s*=/.test(code(f)));
    expect(definers.map(rel)).toEqual(['backend/src/matching/index.ts']);
  });

  it('both the candidate dashboard and the employer applicant list import it from there', () => {
    const service = code(join(ROOT, 'backend/src/applications/service.ts'));
    expect(service).toMatch(/import\s*{[^}]*\bmatchScore\b[^}]*}\s*from\s*'\.\.\/matching\/index\.js'/);
    // listScoredJobs (candidate) and toScoredApplication (employer applicants) both call it
    expect(service.match(/\bmatchScore\(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('no other backend file computes the percentage itself', () => {
    const offenders = backendFiles.filter((f) => !rel(f).endsWith('matching/index.ts') && /Math\.floor\(\s*\(?\s*100\s*\*/.test(code(f)));
    expect(offenders.map(rel)).toEqual([]);
  });
});

describe('FP-AUTH-2 / FP-SEC-4 secrets', () => {
  it('only .env.example files are tracked by git (no real .env is committed)', () => {
    let tracked: string[];
    try {
      tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
    } catch {
      return; // not a git checkout (e.g. a source archive): nothing to verify
    }
    const envFiles = tracked.filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.env.example'));
    expect(envFiles).toEqual([]);
    expect(tracked.filter((f) => /\.(pem|key)$|credentials\.json$/.test(f))).toEqual([]);
  });

  it.each(['.env.example', 'backend/.env.example'])('%s contains placeholders only', (file) => {
    const path = join(ROOT, file);
    expect(existsSync(path)).toBe(true);
    const env = Object.fromEntries(
      read(path).split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()]),
    );
    expect(env.JWT_SECRET).toBe('change-me'); // a known placeholder, never a usable secret
    expect(env.DATABASE_URL).toMatch(/^postgres:\/\/app:app@localhost:/);
    expect(env.TEST_DATABASE_URL).toMatch(/^postgres:\/\/app:app@localhost:/);
    expect(env.TEST_DATABASE_URL).not.toBe(env.DATABASE_URL); // tests never share the main database
  });

  it('no private key or obvious credential is committed in source or docs', () => {
    const files = [
      ...backendFiles,
      ...frontendFiles,
      ...walk(join(ROOT, 'Contract'), (f) => f.endsWith('.md')),
      ...['README.md', 'INSTALL.md', 'SPEC.md', 'AGENTS.md'].map((f) => join(ROOT, f)),
    ];
    const bad = files.filter((f) => /-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{30,}/.test(read(f)));
    expect(bad.map(rel)).toEqual([]);
  });

  it('this test project uses its own secret and never reads .env', () => {
    const own = walk(join(ROOT, 'testing/src'), (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('static-checks.test.ts'));
    const offenders = own.filter((f) => /dotenv|readFileSync\([^)]*\.env['"`)]/.test(read(f)));
    expect(offenders.map(rel)).toEqual([]);
  });
});

describe('FP-AUTH-2 the server refuses to start with a weak JWT secret (backend/src/config.ts)', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.resetModules();
  });

  const load = async (env: Record<string, string | undefined>) => {
    vi.resetModules();
    process.env = { ...saved, DATABASE_URL: 'postgres://app:app@localhost:5432/unit', ...env };
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
    return import('../../../backend/src/config.js');
  };

  it.each(['change-me', 'short', 'x'.repeat(31)])('rejects JWT_SECRET %j (under 32 characters)', async (secret) => {
    await expect(load({ JWT_SECRET: secret })).rejects.toThrow(/at least 32 characters/);
  });

  it('rejects a missing JWT_SECRET', async () => {
    await expect(load({ JWT_SECRET: undefined })).rejects.toThrow(/Missing required environment variable JWT_SECRET/);
  });

  it('rejects a missing DATABASE_URL', async () => {
    await expect(load({ JWT_SECRET: 'z'.repeat(40), DATABASE_URL: undefined })).rejects.toThrow(/DATABASE_URL/);
  });

  it('accepts a 32+ character secret and defaults the token lifetime to 24h', async () => {
    const { config } = await load({ JWT_SECRET: 'z'.repeat(32), JWT_EXPIRES_IN: undefined, PORT: undefined });
    expect(config.jwtSecret).toBe('z'.repeat(32));
    expect(config.jwtExpiresIn).toBe('24h');
    expect(config.port).toBe(8080);
  });
});
