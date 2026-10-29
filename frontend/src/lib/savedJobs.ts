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

export function saveSavedJobIds(userId: string, ids: string[]): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(ids))
}

export function toggleSavedJobId(userId: string, jobId: string): boolean {
  const current = loadSavedJobIds(userId)
  if (current.includes(jobId)) {
    saveSavedJobIds(
      userId,
      current.filter((id) => id !== jobId),
    )
    return false
  }
  saveSavedJobIds(userId, [...current, jobId])
  return true
}
