import { candidateHasSkill } from './matchScoreStyles'

export function missingRequiredSkills(
  required: string[],
  candidateSkills: string[],
): string[] {
  return (required ?? []).filter((skill) => !candidateHasSkill(candidateSkills, skill))
}
