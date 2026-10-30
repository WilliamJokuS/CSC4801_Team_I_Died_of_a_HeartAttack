export function stringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  const norm = (items: string[]) =>
    [...items].map((s) => s.trim()).sort((x, y) => x.localeCompare(y))
  const aa = norm(a)
  const bb = norm(b)
  return aa.every((value, index) => value === bb[index])
}
