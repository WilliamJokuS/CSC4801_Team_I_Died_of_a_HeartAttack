import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { skillsFromJson, skillsSchema } from '../lib/skills.js';

export interface JobDeps {
  prisma: PrismaClient;
}

export interface Job {
  id: string;
  employer_id: string;
  company_name: string;
  title: string;
  description: string;
  required_skills: string[];
  created_at: string;
}

// POST and PUT both take the full object (Contract "Resolved decisions" #2).
export const jobInputSchema = z.object({
  title: z.string().trim().min(1, 'must not be empty').max(200),
  description: z.string().trim().min(1, 'must not be empty').max(10_000),
  required_skills: skillsSchema, // may be empty (FP-EMP-2)
});

const jobInclude = { employer: { select: { companyProfile: { select: { companyName: true } } } } } as const;

type JobRow = {
  id: string;
  employerId: string;
  title: string;
  description: string;
  requiredSkills: unknown;
  createdAt: Date;
  employer: { companyProfile: { companyName: string } | null };
};

export function toJob(row: JobRow): Job {
  return {
    id: row.id,
    employer_id: row.employerId,
    company_name: row.employer.companyProfile?.companyName ?? '',
    title: row.title,
    description: row.description,
    required_skills: skillsFromJson(row.requiredSkills),
    created_at: row.createdAt.toISOString(),
  };
}

/**
 * Loads an active job the caller owns. Order matters for FP-AUTH-3:
 * missing or deleted → 404, exists but owned by another employer → 403.
 */
async function loadOwnedJob(deps: JobDeps, employerId: string, jobId: string) {
  const job = await deps.prisma.job.findFirst({ where: { id: jobId, isActive: true }, include: jobInclude });
  if (!job) throw notFound('Job not found');
  if (job.employerId !== employerId) throw forbidden('You do not own this job');
  return job;
}

export async function createJob(deps: JobDeps, employerId: string, input: unknown): Promise<Job> {
  const data = jobInputSchema.parse(input);
  const job = await deps.prisma.job.create({
    data: {
      employerId,
      title: data.title,
      description: data.description,
      requiredSkills: data.required_skills,
    },
    include: jobInclude,
  });
  return toJob(job);
}

/** The employer's own current postings, newest first. */
export async function listMyJobs(deps: JobDeps, employerId: string): Promise<Job[]> {
  const jobs = await deps.prisma.job.findMany({
    where: { employerId, isActive: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    include: jobInclude,
  });
  return jobs.map(toJob);
}

/** Any authenticated user may view a current job; deleted jobs are 404. */
export async function getJob(deps: JobDeps, jobId: string): Promise<Job> {
  const job = await deps.prisma.job.findFirst({ where: { id: jobId, isActive: true }, include: jobInclude });
  if (!job) throw notFound('Job not found');
  return toJob(job);
}

export async function updateJob(deps: JobDeps, employerId: string, jobId: string, input: unknown): Promise<Job> {
  await loadOwnedJob(deps, employerId, jobId);
  const data = jobInputSchema.parse(input);
  const job = await deps.prisma.job.update({
    where: { id: jobId },
    data: { title: data.title, description: data.description, requiredSkills: data.required_skills },
    include: jobInclude,
  });
  return toJob(job);
}

/**
 * FP-EMP-2: deletable only with no dependents, otherwise 409 and nothing changes.
 * Interview slots are owned by the employer, not the job, so the only way a slot depends
 * on a job is through an application's booking; "has applications" therefore covers both.
 *
 * The job row is locked (FOR UPDATE) for the check-then-delete, so an application can't
 * be created between the count and the delete. Deletion is a soft delete (is_active = false,
 * per Database_schema.md); deleted jobs are treated as missing everywhere.
 */
export async function deleteJob(deps: JobDeps, employerId: string, jobId: string): Promise<void> {
  await loadOwnedJob(deps, employerId, jobId);
  await deps.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM jobs WHERE id = ${jobId}::uuid FOR UPDATE`;
    const applications = await tx.application.count({ where: { jobId } });
    if (applications > 0) {
      throw conflict('Job has applications and cannot be deleted', 'JOB_HAS_DEPENDENTS');
    }
    await tx.job.update({ where: { id: jobId }, data: { isActive: false } });
  });
}
