// Shared API shapes (Contract/API_Contract.md says they live here once the frontend exists).
//
// AuthUser: specs/001-authuser-shape.md. CandidateProfile, CompanyProfile, Job:
// specs/002-profile-and-job-shapes.md. ScoredJob, Application, ScoredApplication,
// AvailabilitySlot: specs/003-application-and-scheduling-shapes.md. Job tags and
// company_description, EmployerJob, EmployerSlot: specs/004-job-tags-and-ui-fields.md.
// All match the backend.

export type Role = 'Candidate' | 'Employer';

export type ApplicationStatus = 'Pending' | 'Interviewing' | 'Rejected' | 'Accepted';

export const APPLICATION_STATUSES: ApplicationStatus[] = ['Pending', 'Interviewing', 'Rejected', 'Accepted'];

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  display_name: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface RegisterInput {
  email: string;
  password: string;
  display_name: string;
  role: Role;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CandidateProfile {
  user_id: string;
  display_name: string;
  skills: string[];
  resume_text: string;
}

export interface CandidateProfileInput {
  display_name: string;
  skills: string[];
  resume_text: string;
}

export interface CompanyProfile {
  user_id: string;
  company_name: string;
  description: string;
}

export interface CompanyProfileInput {
  company_name: string;
  description: string;
}

export interface Job {
  id: string;
  employer_id: string;
  company_name: string;
  company_description: string;
  title: string;
  description: string;
  required_skills: string[];
  /** Display labels only; never affect the match score. Case kept as typed. */
  tags: string[];
  created_at: string;
}

/** GET /api/jobs/mine: applicant_count > 0 means DELETE will return 409 JOB_HAS_DEPENDENTS. */
export interface EmployerJob extends Job {
  applicant_count: number;
}

/**
 * PUT is a full replacement (Contract "Resolved decisions" #2). `tags` is optional, but a PUT
 * without it clears the job's tags, so edit forms must always send it.
 */
export interface JobInput {
  title: string;
  description: string;
  required_skills: string[];
  tags?: string[];
}

/** GET /api/jobs row. */
export interface ScoredJob extends Job {
  match_score: number;
  has_applied: boolean;
}

/** Times are ISO 8601 UTC; every slot is exactly 30 minutes. */
export interface AvailabilitySlot {
  id: string;
  employer_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
}

/** GET /api/employers/me/availability: who booked the slot, null when open. */
export interface EmployerSlot extends AvailabilitySlot {
  booking: {
    application_id: string;
    job_id: string;
    job_title: string;
    candidate_id: string;
    candidate_display_name: string;
  } | null;
}

export interface SlotInput {
  start_time: string;
  end_time: string;
}

export interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  created_at: string;
  interview_slot_id: string | null;
}

/**
 * Returned by both GET /api/applications/mine (candidate) and
 * GET /api/jobs/{id}/applicants (employer). Carries what FP-CAN-3 and FP-EMP-3 need to show.
 */
export interface ScoredApplication extends Application {
  match_score: number;
  job: { id: string; title: string; company_name: string };
  candidate: { id: string; display_name: string; skills: string[] };
  interview_slot: AvailabilitySlot | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
