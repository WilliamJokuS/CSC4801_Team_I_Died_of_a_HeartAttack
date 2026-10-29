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

export function compareScoredJobs(
  a: { match_score: number; title: string; id: string },
  b: { match_score: number; title: string; id: string },
): number {
  if (b.match_score !== a.match_score) {
    return b.match_score - a.match_score
  }
  const titleCompare = a.title.localeCompare(b.title, undefined, { sensitivity: 'accent' })
  if (titleCompare !== 0) {
    return titleCompare
  }
  return a.id.localeCompare(b.id)
}
