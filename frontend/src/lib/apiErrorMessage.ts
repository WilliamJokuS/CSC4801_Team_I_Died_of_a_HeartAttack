import { ApiError } from '../api/client'

const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: '', // use server message
  INVALID_JSON: 'Something went wrong. Please try again.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  INVALID_CREDENTIALS: 'Wrong email or password.',
  FORBIDDEN: "You don't have access to this.",
  NOT_FOUND: 'This item no longer exists.',
  EMAIL_TAKEN: 'An account with this email already exists.',
  ALREADY_APPLIED: "You've already applied to this job.",
  JOB_HAS_DEPENDENTS: "This job has applicants, so it can't be deleted.",
  SLOT_BOOKED: "This slot is booked, so it can't be deleted.",
  NOT_INTERVIEWING: 'You can book an interview once the employer moves you to Interviewing.',
  ALREADY_BOOKED: "You've already booked an interview for this application.",
  SLOT_TAKEN: 'Someone just booked that slot. Please pick another.',
  SLOT_IN_PAST: 'That time has passed. Please pick another slot.',
  PAYLOAD_TOO_LARGE: "That's too much text.",
  NETWORK_ERROR: "Can't reach the server.",
}

export function apiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(err instanceof ApiError)) {
    return fallback
  }
  if (err.code === 'VALIDATION_ERROR') {
    return err.message
  }
  return MESSAGES[err.code] ?? err.message ?? fallback
}
