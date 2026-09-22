export type Role = 'Candidate' | 'Employer';

export type ApplicationStatus = 'Pending' | 'Interviewing' | 'Rejected' | 'Accepted';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: Role;
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

export interface Job {
  id: string;
  employer_id: string;
  company_name: string;
  title: string;
  description: string;
  required_skills: string[];
  is_active: boolean;
  created_at: string;
}

export interface ScoredJob extends Job {
  match_score: number;
  has_applied: boolean;
}

export interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  created_at: string;
  interview_slot_id: string | null;
}

export interface ScoredApplication extends Application {
  candidate_display_name: string;
  candidate_skills: string[];
  match_score: number;
  job_title: string;
  company_name: string;
  interview_slot: {
    start_time: string;
    end_time: string;
  } | null;
}

export interface AvailabilitySlot {
  id: string;
  employer_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
}
