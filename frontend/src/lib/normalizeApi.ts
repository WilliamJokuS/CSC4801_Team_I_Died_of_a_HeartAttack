import type { EmployerJob, Job, ScoredApplication, ScoredJob } from '../types'

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

export function normalizeJob<T extends Job>(job: T): T {
  return {
    ...job,
    required_skills: stringArray(job.required_skills),
    tags: stringArray(job.tags),
    company_name: job.company_name ?? '',
    company_description: job.company_description ?? '',
  }
}

export function normalizeScoredJob(job: ScoredJob): ScoredJob {
  return normalizeJob(job)
}

export function normalizeEmployerJob(job: EmployerJob): EmployerJob {
  return {
    ...normalizeJob(job),
    applicant_count: typeof job.applicant_count === 'number' ? job.applicant_count : 0,
  }
}

export function normalizeScoredApplication(application: ScoredApplication): ScoredApplication {
  const candidate = application.candidate ?? {
    id: application.candidate_id,
    display_name: 'Candidate',
    skills: [] as string[],
  }
  return {
    ...application,
    job: application.job
      ? {
          id: application.job.id,
          title: application.job.title ?? 'Unknown job',
          company_name: application.job.company_name ?? '',
        }
      : {
          id: application.job_id,
          title: 'Unknown job',
          company_name: '',
        },
    candidate: {
      ...candidate,
      skills: stringArray(candidate.skills),
    },
    interview_slot: application.interview_slot ?? null,
  }
}
