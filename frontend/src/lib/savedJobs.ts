const KEY_PREFIX = 'csc4801.savedJobs.'

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

export function loadSavedJobIds(userId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

/** Returns false when storage is unavailable or full; the caller keeps the change in memory. */
export function saveSavedJobIds(userId: string, ids: string[]): boolean {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(ids))
    return true
  } catch {
    return false
  }
}

/** Toggles one job and returns the resulting saved list (also kept when storage fails). */
export function toggleSavedJobId(userId: string, jobId: string, current = loadSavedJobIds(userId)): string[] {
  const next = current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId]
  saveSavedJobIds(userId, next)
  return next
}
