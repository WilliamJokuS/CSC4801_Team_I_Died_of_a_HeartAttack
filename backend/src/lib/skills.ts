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
