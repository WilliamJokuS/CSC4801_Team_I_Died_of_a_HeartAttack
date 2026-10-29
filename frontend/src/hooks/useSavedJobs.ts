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
      const nowSaved = toggleSavedJobId(userId, jobId)
      setSavedIds(loadSavedJobIds(userId))
      return nowSaved
    },
    [userId],
  )

  const isSaved = useCallback((jobId: string) => savedIds.includes(jobId), [savedIds])

  return { savedIds, savedCount: savedIds.length, toggleSave, isSaved }
}
