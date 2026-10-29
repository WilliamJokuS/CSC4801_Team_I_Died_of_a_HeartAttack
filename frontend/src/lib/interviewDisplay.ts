import type { ScoredApplication } from '../types'
import { formatDateTime } from './formatDateTime'

export function interviewSummary(application: ScoredApplication): string {
  const slot = application.interview_slot
  if (slot) {
    return `${formatDateTime(slot.start_time)} – ${formatDateTime(slot.end_time)}`
  }
  if (application.interview_slot_id) {
    return `Booked (slot ${application.interview_slot_id})`
  }
  if (application.status === 'Interviewing') {
    return 'No interview booked yet'
  }
  return '—'
}
