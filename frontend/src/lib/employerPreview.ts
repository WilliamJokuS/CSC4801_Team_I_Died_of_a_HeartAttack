import { ApiError } from '../api/client'
import type {
  ApplicationStatus,
  AvailabilitySlot,
  CompanyProfile,
  EmployerJob,
  EmployerSlot,
  Job,
  ScoredApplication,
} from '../types'
import { calculateMatchScore } from './matchScore'
import {
  PREVIEW_AVAILABILITY_KEY,
  PREVIEW_PROFILE_KEY,
  loadPreviewApplicationRecords,
  loadPreviewSkills,
  setPreviewApplicationStatus,
} from './preview'

export const PREVIEW_EMPLOYER_ID = 'preview-employer-1'
export const PREVIEW_EMPLOYER_PROFILE_KEY = 'csc4801_preview_employer_profile'
export const PREVIEW_EMPLOYER_JOBS_KEY = 'csc4801_preview_employer_jobs'

const DEFAULT_COMPANY: CompanyProfile = {
  user_id: 'preview-user',
  company_name: 'Acme Tech',
  description: 'Building reliable hiring tools for modern teams.',
}

const SEED_JOBS: Job[] = [
  {
    id: 'preview-job-1',
    employer_id: PREVIEW_EMPLOYER_ID,
    company_name: 'Acme Tech',
    company_description: DEFAULT_COMPANY.description,
    title: 'Backend Developer',
    description:
      'Build and maintain REST APIs with Node.js and PostgreSQL. You will work on authentication, job listings, and interview scheduling.',
    required_skills: ['python', 'sql'],
    tags: ['Full-time', 'Remote'],
    created_at: '2026-09-01T09:00:00Z',
  },
  {
    id: 'preview-job-3',
    employer_id: PREVIEW_EMPLOYER_ID,
    company_name: 'Acme Tech',
    company_description: DEFAULT_COMPANY.description,
    title: 'Open Skills Role',
    description:
      'Generalist engineering position with no required skills on file. Every candidate receives a 100% skill match for this posting.',
    required_skills: [],
    tags: [],
    created_at: '2026-09-03T09:00:00Z',
  },
]

function loadPreviewEmployerJobsRaw(): Job[] {
  const stored = localStorage.getItem(PREVIEW_EMPLOYER_JOBS_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Job[]
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      // fall through
    }
  }
  localStorage.setItem(PREVIEW_EMPLOYER_JOBS_KEY, JSON.stringify(SEED_JOBS))
  return SEED_JOBS
}

function savePreviewEmployerJobs(jobs: Job[]): void {
  localStorage.setItem(PREVIEW_EMPLOYER_JOBS_KEY, JSON.stringify(jobs))
}

function applicantCount(jobId: string): number {
  return loadPreviewApplicationRecords().filter((record) => record.job_id === jobId).length
}

export function loadPreviewCompanyProfile(): CompanyProfile {
  const stored = localStorage.getItem(PREVIEW_EMPLOYER_PROFILE_KEY)
  if (!stored) {
    return DEFAULT_COMPANY
  }
  try {
    const parsed = JSON.parse(stored) as CompanyProfile
    return {
      user_id: parsed.user_id ?? DEFAULT_COMPANY.user_id,
      company_name: parsed.company_name ?? DEFAULT_COMPANY.company_name,
      description: parsed.description ?? DEFAULT_COMPANY.description,
    }
  } catch {
    return DEFAULT_COMPANY
  }
}

export function savePreviewCompanyProfile(input: {
  company_name: string
  description: string
}): CompanyProfile {
  const profile: CompanyProfile = {
    user_id: 'preview-user',
    company_name: input.company_name,
    description: input.description,
  }
  localStorage.setItem(PREVIEW_EMPLOYER_PROFILE_KEY, JSON.stringify(profile))
  return profile
}

export function loadPreviewEmployerJobs(): EmployerJob[] {
  return loadPreviewEmployerJobsRaw()
    .map((job) => ({ ...job, applicant_count: applicantCount(job.id) }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getPreviewEmployerJob(jobId: string): EmployerJob | undefined {
  const job = loadPreviewEmployerJobsRaw().find((item) => item.id === jobId)
  if (!job) {
    return undefined
  }
  return { ...job, applicant_count: applicantCount(job.id) }
}

export function createPreviewEmployerJob(input: {
  title: string
  description: string
  required_skills: string[]
  tags: string[]
}): EmployerJob {
  const jobs = loadPreviewEmployerJobsRaw()
  const company = loadPreviewCompanyProfile()
  const job: Job = {
    id: `preview-job-${crypto.randomUUID()}`,
    employer_id: PREVIEW_EMPLOYER_ID,
    company_name: company.company_name,
    company_description: company.description,
    title: input.title,
    description: input.description,
    required_skills: input.required_skills,
    tags: input.tags,
    created_at: new Date().toISOString(),
  }
  jobs.push(job)
  savePreviewEmployerJobs(jobs)
  return { ...job, applicant_count: 0 }
}

export function updatePreviewEmployerJob(
  jobId: string,
  input: { title: string; description: string; required_skills: string[]; tags: string[] },
): EmployerJob {
  const jobs = loadPreviewEmployerJobsRaw()
  const index = jobs.findIndex((job) => job.id === jobId)
  if (index === -1) {
    throw new ApiError(404, 'NOT_FOUND', 'Job not found')
  }
  jobs[index] = {
    ...jobs[index],
    title: input.title,
    description: input.description,
    required_skills: input.required_skills,
    tags: input.tags,
  }
  savePreviewEmployerJobs(jobs)
  return { ...jobs[index], applicant_count: applicantCount(jobId) }
}

export function deletePreviewEmployerJob(jobId: string): void {
  if (applicantCount(jobId) > 0) {
    throw new ApiError(
      409,
      'JOB_HAS_DEPENDENTS',
      'Cannot delete job while applications exist',
    )
  }
  const jobs = loadPreviewEmployerJobsRaw().filter((job) => job.id !== jobId)
  if (jobs.length === loadPreviewEmployerJobsRaw().length) {
    throw new ApiError(404, 'NOT_FOUND', 'Job not found')
  }
  savePreviewEmployerJobs(jobs)
}

function loadPreviewCandidateDisplayName(): string {
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

export function loadPreviewJobApplicants(jobId: string): ScoredApplication[] {
  const job = getPreviewEmployerJob(jobId)
  if (!job) {
    return []
  }
  const skills = loadPreviewSkills()
  const candidateName = loadPreviewCandidateDisplayName()

  return loadPreviewApplicationRecords()
    .filter((record) => record.job_id === jobId)
    .map((record) => ({
      id: record.id,
      job_id: record.job_id,
      candidate_id: record.candidate_id,
      status: record.status,
      created_at: record.created_at,
      interview_slot_id: record.interview_slot_id,
      match_score: calculateMatchScore(skills, job.required_skills),
      job: { id: job.id, title: job.title, company_name: job.company_name },
      candidate: { id: record.candidate_id, display_name: candidateName, skills },
      interview_slot:
        record.interview_slot_id && record.interview_start_time && record.interview_end_time
          ? {
              id: record.interview_slot_id,
              employer_id: job.employer_id,
              start_time: record.interview_start_time,
              end_time: record.interview_end_time,
              is_booked: true,
            }
          : null,
    }))
    .sort((a, b) => {
      if (b.match_score !== a.match_score) {
        return b.match_score - a.match_score
      }
      const nameCompare = a.candidate.display_name.localeCompare(b.candidate.display_name, undefined, {
        sensitivity: 'accent',
      })
      if (nameCompare !== 0) {
        return nameCompare
      }
      return a.candidate_id.localeCompare(b.candidate_id)
    })
}

export function updatePreviewApplicantStatus(
  applicationId: string,
  status: ApplicationStatus,
): ScoredApplication | undefined {
  const updated = setPreviewApplicationStatus(applicationId, status)
  if (!updated) {
    return undefined
  }
  const applicants = loadPreviewJobApplicants(updated.job_id)
  return applicants.find((applicant) => applicant.id === applicationId)
}

function loadPreviewAvailabilityRaw(): AvailabilitySlot[] {
  const stored = localStorage.getItem(PREVIEW_AVAILABILITY_KEY)
  if (!stored) {
    return []
  }
  try {
    const parsed = JSON.parse(stored) as AvailabilitySlot[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function savePreviewAvailabilityRaw(slots: AvailabilitySlot[]): void {
  localStorage.setItem(PREVIEW_AVAILABILITY_KEY, JSON.stringify(slots))
}

function findBookingForSlot(slotId: string): EmployerSlot['booking'] {
  for (const record of loadPreviewApplicationRecords()) {
    if (record.interview_slot_id !== slotId) {
      continue
    }
    const job = getPreviewEmployerJob(record.job_id)
    return {
      application_id: record.id,
      job_id: record.job_id,
      job_title: job?.title ?? 'Unknown job',
      candidate_id: record.candidate_id,
      candidate_display_name: loadPreviewCandidateDisplayName(),
    }
  }
  return null
}

export function loadPreviewEmployerAvailability(): EmployerSlot[] {
  return loadPreviewAvailabilityRaw()
    .filter((slot) => slot.employer_id === PREVIEW_EMPLOYER_ID)
    .map((slot) => ({
      ...slot,
      booking: slot.is_booked ? findBookingForSlot(slot.id) : null,
    }))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
}

export function createPreviewAvailabilitySlot(input: {
  start_time: string
  end_time: string
}): EmployerSlot {
  const start = new Date(input.start_time)
  const end = new Date(input.end_time)
  const now = Date.now()

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid date/time')
  }
  if (end <= start) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'End time must be after start time')
  }
  if (end.getTime() - start.getTime() !== 30 * 60 * 1000) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Slots must be exactly 30 minutes')
  }
  if (start.getTime() <= now) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Slot must be in the future')
  }

  const slot: AvailabilitySlot = {
    id: `preview-slot-${crypto.randomUUID()}`,
    employer_id: PREVIEW_EMPLOYER_ID,
    start_time: input.start_time,
    end_time: input.end_time,
    is_booked: false,
  }
  const slots = loadPreviewAvailabilityRaw()
  slots.push(slot)
  savePreviewAvailabilityRaw(slots)
  return { ...slot, booking: null }
}

export function deletePreviewAvailabilitySlot(slotId: string): void {
  const slots = loadPreviewAvailabilityRaw()
  const slot = slots.find((item) => item.id === slotId)
  if (!slot) {
    throw new ApiError(404, 'NOT_FOUND', 'Slot not found')
  }
  if (slot.is_booked) {
    throw new ApiError(409, 'SLOT_BOOKED', 'Cannot delete a booked slot')
  }
  savePreviewAvailabilityRaw(slots.filter((item) => item.id !== slotId))
}
