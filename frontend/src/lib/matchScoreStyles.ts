export function matchScoreBadgeClass(score: number): string {
  if (score >= 80) {
    return 'bg-green-700 text-white'
  }
  if (score >= 50) {
    return 'bg-amber-600 text-white'
  }
  return 'bg-gray-500 text-white'
}

export function candidateHasSkill(candidateSkills: string[], requiredSkill: string): boolean {
  const normalized = requiredSkill.trim().toLowerCase()
  return candidateSkills.some((skill) => skill.trim().toLowerCase() === normalized)
}
