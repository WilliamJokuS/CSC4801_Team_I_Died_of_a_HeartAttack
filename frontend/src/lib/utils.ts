export function formatScore(score: number): string {
  return String(score);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function normalizeSkills(skills: string[]): string[] {
  return Array.from(new Set(skills.map((s) => s.trim().toLowerCase()).filter(Boolean)));
}
