import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { skillsFromJson } from '../lib/skills.js';
import { compareApplicants, compareScoredJobs, matchScore } from '../matching/index.js';
import { loadOwnedJob, toJob, jobInclude, type Job } from '../jobs/service.js';
import { toSlot, type AvailabilitySlot } from '../scheduling/service.js';

export interface ApplicationDeps {
  prisma: PrismaClient;
}

export type ApplicationStatus = 'Pending' | 'Interviewing' | 'Rejected' | 'Accepted';

export interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  created_at: string;
  interview_slot_id: string | null;
}

/** One row of GET /api/applications/mine and GET /api/jobs/{id}/applicants. Never carries resume text. */
export interface ScoredApplication extends Application {
  match_score: number;
  job: { id: string; title: string; company_name: string };
  candidate: { id: string; display_name: string; skills: string[] };
  interview_slot: AvailabilitySlot | null;
}

export interface ScoredJob extends Job {
  match_score: number;
  has_applied: boolean;
}

export const statusInputSchema = z.object({
  status: z.enum(['Pending', 'Interviewing', 'Rejected', 'Accepted']),
});

type ApplicationRow = {
  id: string;
  jobId: string;
  candidateId: string;
  status: ApplicationStatus;
  createdAt: Date;
  interviewSlotId: string | null;
};

export function toApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    job_id: row.jobId,
    candidate_id: row.candidateId,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    interview_slot_id: row.interviewSlotId,
  };
}

const scoredInclude = {
  job: { include: jobInclude },
  candidate: { select: { id: true, displayName: true, candidateProfile: { select: { skills: true } } } },
  interviewSlot: true,
} as const;

type ScoredRow = Prisma.ApplicationGetPayload<{ include: typeof scoredInclude }>;

function toScoredApplication(row: ScoredRow): ScoredApplication {
  const skills = skillsFromJson(row.candidate.candidateProfile?.skills);
  const job = toJob(row.job);
  return {
    ...toApplication(row),
    match_score: matchScore(skills, job.required_skills),
    job: { id: job.id, title: job.title, company_name: job.company_name },
    candidate: { id: row.candidate.id, display_name: row.candidate.displayName, skills },
    interview_slot: row.interviewSlot ? toSlot(row.interviewSlot) : null,
  };
}

/** GET /api/jobs (FP-CAN-2): every current job, scored for this candidate and sorted. */
export async function listScoredJobs(deps: ApplicationDeps, candidateId: string): Promise<ScoredJob[]> {
  const [profile, jobs, applied] = await Promise.all([
    deps.prisma.candidateProfile.findUnique({ where: { userId: candidateId }, select: { skills: true } }),
    deps.prisma.job.findMany({ where: { isActive: true }, include: jobInclude }),
    deps.prisma.application.findMany({ where: { candidateId }, select: { jobId: true } }),
  ]);
  const skills = skillsFromJson(profile?.skills);
  const appliedJobIds = new Set(applied.map((a) => a.jobId));
  return jobs
    .map(toJob)
    .map((job) => ({
      ...job,
      match_score: matchScore(skills, job.required_skills),
      has_applied: appliedJobIds.has(job.id),
    }))
    .sort(compareScoredJobs);
}

/**
 * FP-CAN-3: apply once, status Pending. The (job_id, candidate_id) UNIQUE constraint rejects
 * a duplicate (409 ALREADY_APPLIED) without creating a row, even for two concurrent requests.
 * The job row is share-locked so it can't be soft-deleted between the check and the insert
 * (deleteJob takes FOR UPDATE on the same row).
 */
export async function apply(deps: ApplicationDeps, candidateId: string, jobId: string): Promise<Application> {
  try {
    return await deps.prisma.$transaction(async (tx) => {
      const jobs = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM jobs WHERE id = ${jobId}::uuid AND is_active FOR SHARE`;
      if (jobs.length === 0) throw notFound('Job not found');
      const created = await tx.application.create({ data: { jobId, candidateId } });
      return toApplication(created);
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('You have already applied to this job', 'ALREADY_APPLIED');
    }
    throw err;
  }
}

/** The caller's own applications only, newest first. */
export async function listMyApplications(deps: ApplicationDeps, candidateId: string): Promise<ScoredApplication[]> {
  const rows = await deps.prisma.application.findMany({
    where: { candidateId },
    include: scoredInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  });
  return rows.map(toScoredApplication);
}

/** FP-EMP-3: applicants for a job the caller owns (404 missing, 403 not owner), sorted by score. */
export async function listApplicants(
  deps: ApplicationDeps,
  employerId: string,
  jobId: string,
): Promise<ScoredApplication[]> {
  await loadOwnedJob(deps, employerId, jobId);
  const rows = await deps.prisma.application.findMany({ where: { jobId }, include: scoredInclude });
  return rows.map(toScoredApplication).sort(compareApplicants);
}

/**
 * Only the employer who owns the application's job may change its status (404 missing, 403
 * otherwise). An existing booking is left in place whatever the new status is (FP-SCHED-2).
 */
export async function setStatus(
  deps: ApplicationDeps,
  employerId: string,
  applicationId: string,
  input: unknown,
): Promise<Application> {
  const app = await deps.prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: { select: { employerId: true } } },
  });
  if (!app) throw notFound('Application not found');
  if (app.job.employerId !== employerId) throw forbidden('You do not own this job');
  const { status } = statusInputSchema.parse(input);
  const updated = await deps.prisma.application.update({ where: { id: applicationId }, data: { status } });
  return toApplication(updated);
}
