export function safeReturnPath(from: unknown, home?: '/candidate' | '/employer'): string | null {
  if (typeof from !== 'string' || !from.startsWith('/')) return null

  const origin = 'https://local.invalid'
  try {
    const url = new URL(from, origin)
    const path = url.pathname.toLowerCase()
    if (url.origin !== origin || path.startsWith('/login') || path.startsWith('/register')) return null
    if (home && path !== home && !path.startsWith(home + '/')) return null
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}
