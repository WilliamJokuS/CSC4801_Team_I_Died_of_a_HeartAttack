export function safeReturnPath(from: unknown): string | null {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) {
    return null
  }
  if (from.startsWith('/login') || from.startsWith('/register')) {
    return null
  }
  return from
}
