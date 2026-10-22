import { z } from 'zod';

/**
 * FP-MATCH-1 normalization: trim, lowercase, drop empty values, dedupe (first occurrence
 * keeps its position). Applied when skills are written, so stored skills are already
 * normalized; the match-score function normalizes again so it is correct on any input.
 */
export function normalizeSkills(skills: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const raw of skills) {
    const skill = raw.trim().toLowerCase();
    if (skill) seen.add(skill);
  }
  return [...seen];
}

/** Request-body schema for a skills list; output is normalized. */
export const skillsSchema = z
  .array(z.string().max(50, 'each skill must be at most 50 characters'))
  .max(50, 'at most 50 skills')
  .transform(normalizeSkills);

/** Reads a jsonb skills column back as string[]. */
export function skillsFromJson(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((s): s is string => typeof s === 'string') : [];
}

/**
 * specs/004 job tags: trim, drop empties, dedupe case-insensitively keeping the first
 * spelling. Unlike skills, case is preserved because tags are shown as typed.
 */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of tags) {
    const tag = raw.trim();
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) seen.set(key, tag);
  }
  return [...seen.values()];
}

/** Request-body schema for job tags: optional (defaults to []), at most 10, each at most 30 chars. */
export const tagsSchema = z
  .array(z.string())
  .default([])
  .transform(normalizeTags)
  .pipe(
    z
      .array(z.string().max(30, 'each tag must be at most 30 characters'))
      .max(10, 'at most 10 tags'),
  );
