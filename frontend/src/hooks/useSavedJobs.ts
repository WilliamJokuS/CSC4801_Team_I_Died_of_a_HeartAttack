import { useCallback, useEffect, useState } from 'react'
import { loadSavedJobIds, toggleSavedJobId } from '../lib/savedJobs'

export function useSavedJobs(userId: string | undefined) {
  const [savedIds, setSavedIds] = useState<string[]>([])

  useEffect(() => {
    if (!userId) {
      setSavedIds([])
      return
    }
    setSavedIds(loadSavedJobIds(userId))
  }, [userId])

  const toggleSave = useCallback(
    (jobId: string) => {
      if (!userId) {
        return false
      }
      const next = toggleSavedJobId(userId, jobId, savedIds)
      setSavedIds(next)
      return next.includes(jobId)
    },
    [userId, savedIds],
  )

  const isSaved = useCallback((jobId: string) => savedIds.includes(jobId), [savedIds])

  return { savedIds, savedCount: savedIds.length, toggleSave, isSaved }
}
