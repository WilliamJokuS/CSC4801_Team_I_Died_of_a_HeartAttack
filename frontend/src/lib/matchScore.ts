function normalizeSkills(skills: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const skill of skills) {
    const trimmed = skill.trim().toLowerCase()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }
    seen.add(trimmed)
    normalized.push(trimmed)
  }
  return normalized
}

/** FP-MATCH-1 formula. Used for dev preview only — real scores come from the API. */
export function calculateMatchScore(candidateSkills: string[], requiredSkills: string[]): number {
  const candidateSet = new Set(normalizeSkills(candidateSkills))
  const required = normalizeSkills(requiredSkills)
  if (required.length === 0) {
    return 100
  }
  const overlap = required.filter((skill) => candidateSet.has(skill)).length
  return Math.floor((100 * overlap) / required.length)
}

// Must match backend/src/matching/index.ts exactly: lowercase, then code-unit comparison
// (not localeCompare), so preview ordering equals the real API ordering on every machine.
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Score desc, then case-insensitive title, then job id (same as the backend). */
export function compareScoredJobs(
  a: { match_score: number; title: string; id: string },
  b: { match_score: number; title: string; id: string },
): number {
  return (
    b.match_score - a.match_score ||
    compareText(a.title.toLowerCase(), b.title.toLowerCase()) ||
    compareText(a.id, b.id)
  )
}
