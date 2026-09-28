import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { notFound } from '../lib/errors.js';
import { skillsFromJson, skillsSchema } from '../lib/skills.js';

export interface ProfileDeps {
  prisma: PrismaClient;
}

export interface CandidateProfile {
  user_id: string;
  display_name: string;
  skills: string[];
  resume_text: string;
}

export interface CompanyProfile {
  user_id: string;
  company_name: string;
  description: string;
}

// PUT replaces the whole profile, so every field is required.
export const candidateProfileSchema = z.object({
  display_name: z.string().trim().min(1, 'must not be empty').max(100),
  skills: skillsSchema,
  resume_text: z.string().max(20_000, 'must be at most 20000 characters'),
});

export const companyProfileSchema = z.object({
  company_name: z.string().trim().min(1, 'must not be empty').max(200),
  description: z.string().max(5_000, 'must be at most 5000 characters'),
});

/*
 * Every profile route is scoped to the caller's own id from the JWT (`/me`), so there is no
 * path through which one user can name another user's profile or resume (FP-CAN-1, FP-SEC-1).
 */

export async function getCandidateProfile(deps: ProfileDeps, userId: string): Promise<CandidateProfile> {
  const user = await deps.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, candidateProfile: true },
  });
  if (!user?.candidateProfile) throw notFound('Candidate profile not found');
  return {
    user_id: user.id,
    display_name: user.displayName,
    skills: skillsFromJson(user.candidateProfile.skills),
    resume_text: user.candidateProfile.resumeText,
  };
}

export async function updateCandidateProfile(
  deps: ProfileDeps,
  userId: string,
  input: unknown,
): Promise<CandidateProfile> {
  const data = candidateProfileSchema.parse(input);
  // display_name lives on users, skills/resume on candidate_profiles: update both together.
  const user = await deps.prisma.user.update({
    where: { id: userId },
    data: {
      displayName: data.display_name,
      candidateProfile: {
        upsert: {
          create: { skills: data.skills, resumeText: data.resume_text },
          update: { skills: data.skills, resumeText: data.resume_text },
        },
      },
    },
    select: { id: true, displayName: true, candidateProfile: true },
  });
  return {
    user_id: user.id,
    display_name: user.displayName,
    skills: skillsFromJson(user.candidateProfile?.skills),
    resume_text: user.candidateProfile?.resumeText ?? '',
  };
}

export async function getCompanyProfile(deps: ProfileDeps, userId: string): Promise<CompanyProfile> {
  const profile = await deps.prisma.companyProfile.findUnique({ where: { userId } });
  if (!profile) throw notFound('Company profile not found');
  return toCompanyProfile(profile);
}

export async function updateCompanyProfile(
  deps: ProfileDeps,
  userId: string,
  input: unknown,
): Promise<CompanyProfile> {
  const data = companyProfileSchema.parse(input);
  const profile = await deps.prisma.companyProfile.upsert({
    where: { userId },
    create: { userId, companyName: data.company_name, description: data.description },
    update: { companyName: data.company_name, description: data.description },
  });
  return toCompanyProfile(profile);
}

function toCompanyProfile(p: { userId: string; companyName: string; description: string }): CompanyProfile {
  return { user_id: p.userId, company_name: p.companyName, description: p.description };
}
