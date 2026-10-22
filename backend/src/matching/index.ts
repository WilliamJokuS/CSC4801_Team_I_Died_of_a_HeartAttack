import { normalizeSkills } from '../lib/skills.js';

/**
 * FP-MATCH-1, the only implementation: both the candidate dashboard (GET /api/jobs) and the
 * employer applicant list (GET /api/jobs/{id}/applicants) call this.
 *
 *   score = 100                               when |R| = 0
 *   score = floor(100 * |C ∩ R| / |R|)        otherwise
 *
 * Inputs are normalized here even though stored skills already are, so the score is correct
 * for any input. Resume text is never an input.
 */
export function matchScore(candidateSkills: readonly string[], requiredSkills: readonly string[]): number {
  const required = normalizeSkills(requiredSkills);
  if (required.length === 0) return 100;
  const candidate = new Set(normalizeSkills(candidateSkills));
  const overlap = required.filter((skill) => candidate.has(skill)).length;
  return Math.floor((100 * overlap) / required.length);
}

// Tie-breaks compare lowercased strings by code unit (not locale), so ordering is identical
// on every machine. Ids are UUID strings, compared the same way.
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Candidate dashboard order: score desc, then case-insensitive title, then job id. */
export function compareScoredJobs(
  a: { match_score: number; title: string; id: string },
  b: { match_score: number; title: string; id: string },
): number {
  return (
    b.match_score - a.match_score ||
    compareText(a.title.toLowerCase(), b.title.toLowerCase()) ||
    compareText(a.id, b.id)
  );
}

/** Employer applicant order: score desc, then case-insensitive display name, then candidate id. */
export function compareApplicants(
  a: { match_score: number; candidate: { display_name: string; id: string } },
  b: { match_score: number; candidate: { display_name: string; id: string } },
): number {
  return (
    b.match_score - a.match_score ||
    compareText(a.candidate.display_name.toLowerCase(), b.candidate.display_name.toLowerCase()) ||
    compareText(a.candidate.id, b.candidate.id)
  );
}
