import { ApiError } from '../api/client'
import type {
  ApplicationStatus,
  AvailabilitySlot,
  Job,
  ScoredApplication,
  ScoredJob,
} from '../types'
import { calculateMatchScore, compareScoredJobs } from './matchScore'

export const PREVIEW_PROFILE_KEY = 'csc4801_preview_candidate_profile'
export const PREVIEW_APPLIED_JOBS_KEY = 'csc4801_preview_applied_jobs'
export const PREVIEW_APPLICATIONS_KEY = 'csc4801_preview_applications'
export const PREVIEW_AVAILABILITY_KEY = 'csc4801_preview_availability'

interface PreviewApplicationRecord {
  id: string
  job_id: string
  candidate_id: string
  status: ApplicationStatus
  created_at: string
  interview_slot_id: string | null
  interview_start_time?: string
  interview_end_time?: string
}

export function isPreviewUser(userId: string | undefined): boolean {
  return import.meta.env.DEV && userId === 'preview-user'
}

export function loadPreviewSkills(): string[] {
  const stored = localStorage.getItem(PREVIEW_PROFILE_KEY)
  if (!stored) {
    return []
  }
  try {
    const parsed = JSON.parse(stored) as { skills?: string[] }
    return Array.isArray(parsed.skills) ? parsed.skills : []
  } catch {
    return []
  }
}

function loadPreviewDisplayName(): string {
  const stored = localStorage.getItem(PREVIEW_PROFILE_KEY)
  if (!stored) {
    return 'Preview Candidate'
  }
  try {
    const parsed = JSON.parse(stored) as { display_name?: string }
    return parsed.display_name?.trim() || 'Preview Candidate'
  } catch {
    return 'Preview Candidate'
  }
}

function getPreviewJobById(jobId: string): Job | undefined {
  return PREVIEW_JOBS.find((job) => job.id === jobId)
}

export function loadPreviewApplicationRecords(): PreviewApplicationRecord[] {
  const stored = localStorage.getItem(PREVIEW_APPLICATIONS_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as PreviewApplicationRecord[]
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      // fall through to migration
    }
  }

  const legacyApplied = localStorage.getItem(PREVIEW_APPLIED_JOBS_KEY)
  if (!legacyApplied) {
    return []
  }

  try {
    const jobIds = JSON.parse(legacyApplied) as string[]
    if (!Array.isArray(jobIds)) {
      return []
    }
    const migrated = jobIds.map((jobId) => createPreviewApplicationRecord(jobId))
    localStorage.setItem(PREVIEW_APPLICATIONS_KEY, JSON.stringify(migrated))
    localStorage.removeItem(PREVIEW_APPLIED_JOBS_KEY)
    return migrated
  } catch {
    return []
  }
}

function createPreviewApplicationRecord(jobId: string): PreviewApplicationRecord {
  return {
    id: `preview-app-${jobId}`,
    job_id: jobId,
    candidate_id: 'preview-user',
    status: 'Pending',
    created_at: new Date().toISOString(),
    interview_slot_id: null,
  }
}

export function savePreviewApplication(jobId: string): void {
  const records = loadPreviewApplicationRecords()
  if (records.some((record) => record.job_id === jobId)) {
    return
  }
  records.push(createPreviewApplicationRecord(jobId))
  localStorage.setItem(PREVIEW_APPLICATIONS_KEY, JSON.stringify(records))
}

export function loadPreviewAppliedJobIds(): Set<string> {
  return new Set(loadPreviewApplicationRecords().map((record) => record.job_id))
}

const PREVIEW_JOBS: Job[] = [
  {
    id: 'preview-job-1',
    employer_id: 'preview-employer-1',
    company_name: 'Acme Tech',
    company_description: 'Building reliable hiring tools for modern teams.',
    title: 'Backend Developer',
    description:
      'Build and maintain REST APIs with Node.js and PostgreSQL. You will work on authentication, job listings, and interview scheduling.',
    required_skills: ['python', 'sql'],
    tags: ['Full-time', 'Remote'],
    created_at: '2026-09-01T09:00:00Z',
  },
  {
    id: 'preview-job-2',
    employer_id: 'preview-employer-2',
    company_name: 'Northwind Labs',
    company_description: 'Product engineering for growing startups.',
    title: 'Full Stack Engineer',
    description:
      'Ship features across React and Node.js. Experience with TypeScript, testing, and collaborative API design is a plus.',
    required_skills: ['typescript', 'react', 'sql'],
    tags: ['Hybrid'],
    created_at: '2026-09-02T09:00:00Z',
  },
  {
    id: 'preview-job-3',
    employer_id: 'preview-employer-1',
    company_name: 'Acme Tech',
    company_description: 'Building reliable hiring tools for modern teams.',
    title: 'Open Skills Role',
    description:
      'Generalist engineering position with no required skills on file. Every candidate receives a 100% skill match for this posting.',
    required_skills: [],
    tags: [],
    created_at: '2026-09-03T09:00:00Z',
  },
]

export function loadPreviewJobs(): ScoredJob[] {
  const skills = loadPreviewSkills()
  const applied = loadPreviewAppliedJobIds()

  return PREVIEW_JOBS.map((job) => ({
    ...job,
    match_score: calculateMatchScore(skills, job.required_skills),
    has_applied: applied.has(job.id),
  })).sort(compareScoredJobs)
}

function buildInterviewSlot(record: PreviewApplicationRecord): AvailabilitySlot | null {
  if (!record.interview_slot_id || !record.interview_start_time || !record.interview_end_time) {
    return null
  }
  const job = getPreviewJobById(record.job_id)
  return {
    id: record.interview_slot_id,
    employer_id: job?.employer_id ?? 'preview-employer-1',
    start_time: record.interview_start_time,
    end_time: record.interview_end_time,
    is_booked: true,
  }
}

function toScoredApplication(record: PreviewApplicationRecord): ScoredApplication {
  const job = getPreviewJobById(record.job_id)
  const skills = loadPreviewSkills()

  return {
    id: record.id,
    job_id: record.job_id,
    candidate_id: record.candidate_id,
    status: record.status,
    created_at: record.created_at,
    interview_slot_id: record.interview_slot_id,
    match_score: job ? calculateMatchScore(skills, job.required_skills) : 0,
    job: {
      id: job?.id ?? record.job_id,
      title: job?.title ?? 'Unknown job',
      company_name: job?.company_name ?? 'Unknown company',
    },
    candidate: {
      id: record.candidate_id,
      display_name: loadPreviewDisplayName(),
      skills,
    },
    interview_slot: buildInterviewSlot(record),
  }
}

export function loadPreviewApplications(): ScoredApplication[] {
  return loadPreviewApplicationRecords()
    .map(toScoredApplication)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getPreviewApplicationById(applicationId: string): ScoredApplication | undefined {
  return loadPreviewApplications().find((application) => application.id === applicationId)
}

export function setPreviewApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
): ScoredApplication | undefined {
  const records = loadPreviewApplicationRecords()
  const index = records.findIndex((record) => record.id === applicationId)
  if (index === -1) {
    return undefined
  }
  records[index] = { ...records[index], status }
  localStorage.setItem(PREVIEW_APPLICATIONS_KEY, JSON.stringify(records))
  return toScoredApplication(records[index])
}

function addDays(base: Date, days: number): Date {
  const copy = new Date(base)
  copy.setDate(copy.getDate() + days)
  return copy
}

function toIso(date: Date): string {
  return date.toISOString()
}

function createDefaultPreviewSlots(): AvailabilitySlot[] {
  const now = new Date()
  const day1Morning = addDays(now, 2)
  day1Morning.setHours(10, 0, 0, 0)
  const day1Late = addDays(now, 2)
  day1Late.setHours(14, 0, 0, 0)
  const day2Morning = addDays(now, 3)
  day2Morning.setHours(11, 0, 0, 0)

  const slots: Array<{ id: string; employer_id: string; start: Date }> = [
    { id: 'preview-slot-1', employer_id: 'preview-employer-1', start: day1Morning },
    { id: 'preview-slot-2', employer_id: 'preview-employer-1', start: day1Late },
    { id: 'preview-slot-3', employer_id: 'preview-employer-2', start: day2Morning },
  ]

  return slots.map(({ id, employer_id, start }) => {
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + 30)
    return {
      id,
      employer_id,
      start_time: toIso(start),
      end_time: toIso(end),
      is_booked: false,
    }
  })
}

function loadPreviewAvailabilitySlots(): AvailabilitySlot[] {
  const stored = localStorage.getItem(PREVIEW_AVAILABILITY_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as AvailabilitySlot[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    } catch {
      // fall through
    }
  }
  const defaults = createDefaultPreviewSlots()
  localStorage.setItem(PREVIEW_AVAILABILITY_KEY, JSON.stringify(defaults))
  return defaults
}

function savePreviewAvailabilitySlots(slots: AvailabilitySlot[]): void {
  localStorage.setItem(PREVIEW_AVAILABILITY_KEY, JSON.stringify(slots))
}

export function loadPreviewAvailableSlots(applicationId: string): AvailabilitySlot[] {
  const application = getPreviewApplicationById(applicationId)
  if (!application) {
    return []
  }
  const job = getPreviewJobById(application.job_id)
  if (!job) {
    return []
  }

  const now = Date.now()
  return loadPreviewAvailabilitySlots().filter(
    (slot) =>
      slot.employer_id === job.employer_id &&
      !slot.is_booked &&
      new Date(slot.start_time).getTime() > now,
  )
}

export function bookPreviewInterviewSlot(
  applicationId: string,
  slotId: string,
): ScoredApplication {
  const records = loadPreviewApplicationRecords()
  const index = records.findIndex((record) => record.id === applicationId)
  if (index === -1) {
    throw new ApiError(404, 'NOT_FOUND', 'Application not found')
  }

  const record = records[index]
  if (record.status !== 'Interviewing') {
    throw new ApiError(409, 'NOT_INTERVIEWING', 'Application is not eligible for booking')
  }
  if (record.interview_slot_id) {
    throw new ApiError(409, 'ALREADY_BOOKED', 'Application already has an interview booked')
  }

  const slots = loadPreviewAvailabilitySlots()
  const slotIndex = slots.findIndex((slot) => slot.id === slotId)
  if (slotIndex === -1) {
    throw new ApiError(404, 'NOT_FOUND', 'Slot not found')
  }

  const slot = slots[slotIndex]
  if (slot.is_booked) {
    throw new ApiError(409, 'SLOT_TAKEN', 'Slot already booked')
  }

  slots[slotIndex] = { ...slot, is_booked: true }
  savePreviewAvailabilitySlots(slots)

  records[index] = {
    ...record,
    interview_slot_id: slot.id,
    interview_start_time: slot.start_time,
    interview_end_time: slot.end_time,
  }
  localStorage.setItem(PREVIEW_APPLICATIONS_KEY, JSON.stringify(records))
  return toScoredApplication(records[index])
}
