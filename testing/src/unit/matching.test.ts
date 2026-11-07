import { describe, expect, it } from 'vitest';
import { compareApplicants, compareScoredJobs, matchScore } from '../../../backend/src/matching/index.js';
import { normalizeSkills } from '../../../backend/src/lib/skills.js';

describe('FP-MATCH-1 matchScore: the four required examples', () => {
  it('example 1: Python, SQL vs Python, SQL scores 100', () => {
    expect(matchScore(['Python', 'SQL'], ['Python', 'SQL'])).toBe(100);
  });

  it('example 2: Python vs Python, SQL scores 50', () => {
    expect(matchScore(['Python'], ['Python', 'SQL'])).toBe(50);
  });

  it('example 3: Rust vs Python, SQL scores 0', () => {
    expect(matchScore(['Rust'], ['Python', 'SQL'])).toBe(0);
  });

  it('example 4: any skills vs an empty required list scores 100', () => {
    expect(matchScore([], [])).toBe(100);
    expect(matchScore(['Rust', 'Go'], [])).toBe(100);
  });
});

describe('FP-MATCH-1 matchScore: formula details', () => {
  it('floors rather than rounds (1 of 3 is 33, 2 of 3 is 66)', () => {
    expect(matchScore(['a'], ['a', 'b', 'c'])).toBe(33);
    expect(matchScore(['a', 'b'], ['a', 'b', 'c'])).toBe(66);
  });

  it('is case-insensitive and ignores surrounding whitespace on both sides', () => {
    expect(matchScore(['  PYTHON ', 'sql'], ['python', ' SQL  '])).toBe(100);
  });

  it('drops empty and whitespace-only skills before counting', () => {
    // required normalizes to [python]; the blank entries must not dilute the denominator
    expect(matchScore(['python'], ['python', '', '   '])).toBe(100);
    // all-blank required list is an empty set, so 100
    expect(matchScore([], ['', '  '])).toBe(100);
  });

  it('removes duplicates so repeated required skills count once', () => {
    expect(matchScore(['python'], ['python', 'Python', ' PYTHON '])).toBe(100);
    expect(matchScore(['python'], ['python', 'PYTHON', 'sql'])).toBe(50);
  });

  it('does not double count duplicated candidate skills', () => {
    expect(matchScore(['sql', 'SQL', 'sql '], ['sql', 'python'])).toBe(50);
  });

  it('ignores candidate skills the job does not require', () => {
    expect(matchScore(['python', 'rust', 'go', 'java'], ['python'])).toBe(100);
  });

  it('is always an integer from 0 through 100', () => {
    const skills = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (let n = 0; n <= skills.length; n++) {
      for (let m = 0; m <= skills.length; m++) {
        const score = matchScore(skills.slice(0, n), skills.slice(skills.length - m));
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('does not mutate its inputs', () => {
    const candidate = [' B ', 'a'];
    const required = ['A', ' b'];
    matchScore(candidate, required);
    expect(candidate).toEqual([' B ', 'a']);
    expect(required).toEqual(['A', ' b']);
  });
});

describe('FP-MATCH-1 normalizeSkills', () => {
  it('trims, lowercases, drops empties and dedupes, keeping first-seen order', () => {
    expect(normalizeSkills(['  Python', 'SQL ', 'python', '', '   ', 'sql', 'Go'])).toEqual(['python', 'sql', 'go']);
  });
});

describe('FP-MATCH-1 candidate dashboard tie-break (compareScoredJobs)', () => {
  const job = (id: string, title: string, match_score: number) => ({ id, title, match_score });

  it('sorts by score descending first', () => {
    const jobs = [job('1', 'Zed', 10), job('2', 'Alpha', 90), job('3', 'Mid', 50)];
    expect(jobs.sort(compareScoredJobs).map((j) => j.match_score)).toEqual([90, 50, 10]);
  });

  it('breaks equal scores by case-insensitive title, so "apple" sorts before "Banana"', () => {
    const jobs = [job('1', 'Banana', 50), job('2', 'apple', 50), job('3', 'Cherry', 50)];
    expect(jobs.sort(compareScoredJobs).map((j) => j.title)).toEqual(['apple', 'Banana', 'Cherry']);
  });

  it('breaks equal score and equal title (any case) by job id', () => {
    const jobs = [job('b-id', 'Dev', 50), job('a-id', 'dev', 50), job('c-id', 'DEV', 50)];
    expect(jobs.sort(compareScoredJobs).map((j) => j.id)).toEqual(['a-id', 'b-id', 'c-id']);
  });

  it('is deterministic regardless of input order', () => {
    const base = [job('3', 'b', 50), job('1', 'B', 50), job('2', 'a', 80), job('4', 'a', 20)];
    const forwards = [...base].sort(compareScoredJobs).map((j) => j.id);
    const backwards = [...base].reverse().sort(compareScoredJobs).map((j) => j.id);
    expect(forwards).toEqual(backwards);
    expect(forwards).toEqual(['2', '1', '3', '4']);
  });

  it('a higher score always wins over a better title', () => {
    expect(compareScoredJobs(job('1', 'Zzz', 60), job('2', 'Aaa', 59))).toBeLessThan(0);
  });
});

describe('FP-MATCH-1 employer applicant tie-break (compareApplicants)', () => {
  const applicant = (id: string, display_name: string, match_score: number) => ({
    match_score,
    candidate: { id, display_name },
  });

  it('sorts by score descending first', () => {
    const rows = [applicant('1', 'Ann', 20), applicant('2', 'Bob', 100), applicant('3', 'Cy', 60)];
    expect(rows.sort(compareApplicants).map((r) => r.match_score)).toEqual([100, 60, 20]);
  });

  it('breaks equal scores by case-insensitive candidate display name', () => {
    const rows = [applicant('1', 'bob', 50), applicant('2', 'Alice', 50), applicant('3', 'CHARLIE', 50)];
    expect(rows.sort(compareApplicants).map((r) => r.candidate.display_name)).toEqual(['Alice', 'bob', 'CHARLIE']);
  });

  it('breaks equal score and equal name (any case) by candidate id', () => {
    const rows = [applicant('z', 'Sam', 50), applicant('m', 'sam', 50), applicant('a', 'SAM', 50)];
    expect(rows.sort(compareApplicants).map((r) => r.candidate.id)).toEqual(['a', 'm', 'z']);
  });
});
