import type { ApplicationStatus } from '../types'

function isDecisionStatus(status: ApplicationStatus): boolean {
  return status === 'Accepted' || status === 'Rejected'
}

export function needsStatusChangeConfirm(
  current: ApplicationStatus,
  next: ApplicationStatus,
): boolean {
  if (current === next) {
    return false
  }
  if (isDecisionStatus(next) || isDecisionStatus(current)) {
    return true
  }
  return false
}

export function statusChangeConfirmMessage(
  candidateName: string,
  current: ApplicationStatus,
  next: ApplicationStatus,
): string {
  if (isDecisionStatus(current) && !isDecisionStatus(next)) {
    return `${candidateName} is currently ${current}. Move them back to ${next}?`
  }
  return `Set ${candidateName} to ${next}?`
}
