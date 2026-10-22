// One function per route in Contract/API_Contract.md, grouped by contract section.
// Pages call these instead of fetch() so the final UI can be swapped in without touching
// how requests are made.
import type {
  Application,
  ApplicationStatus,
  AuthResponse,
  AuthUser,
  AvailabilitySlot,
  CandidateProfile,
  CandidateProfileInput,
  CompanyProfile,
  CompanyProfileInput,
  EmployerJob,
  EmployerSlot,
  Job,
  JobInput,
  LoginInput,
  RegisterInput,
  ScoredApplication,
  ScoredJob,
  SlotInput,
} from '../types';
import { request, setToken } from './client';

const id = (value: string) => encodeURIComponent(value);

export const authApi = {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const res = await request<AuthResponse>('POST', '/auth/register', input);
    setToken(res.token);
    return res;
  },
  async login(input: LoginInput): Promise<AuthResponse> {
    const res = await request<AuthResponse>('POST', '/auth/login', input);
    setToken(res.token);
    return res;
  },
  /** Stateless on the server; the token is discarded here even if the call fails. */
  async logout(): Promise<void> {
    try {
      await request<void>('POST', '/auth/logout');
    } finally {
      setToken(null);
    }
  },
  me: () => request<AuthUser>('GET', '/me'),
};

export const profileApi = {
  getCandidate: () => request<CandidateProfile>('GET', '/candidates/me/profile'),
  updateCandidate: (input: CandidateProfileInput) =>
    request<CandidateProfile>('PUT', '/candidates/me/profile', input),
  getCompany: () => request<CompanyProfile>('GET', '/employers/me/profile'),
  updateCompany: (input: CompanyProfileInput) => request<CompanyProfile>('PUT', '/employers/me/profile', input),
};

export const jobsApi = {
  /** Candidate dashboard: scored and sorted by the server. */
  listScored: () => request<ScoredJob[]>('GET', '/jobs'),
  listMine: () => request<EmployerJob[]>('GET', '/jobs/mine'),
  get: (jobId: string) => request<Job>('GET', `/jobs/${id(jobId)}`),
  create: (input: JobInput) => request<Job>('POST', '/jobs', input),
  update: (jobId: string, input: JobInput) => request<Job>('PUT', `/jobs/${id(jobId)}`, input),
  remove: (jobId: string) => request<void>('DELETE', `/jobs/${id(jobId)}`),
};

export const applicationsApi = {
  apply: (jobId: string) => request<Application>('POST', `/jobs/${id(jobId)}/applications`),
  listMine: () => request<ScoredApplication[]>('GET', '/applications/mine'),
  listApplicants: (jobId: string) => request<ScoredApplication[]>('GET', `/jobs/${id(jobId)}/applicants`),
  setStatus: (applicationId: string, status: ApplicationStatus) =>
    request<Application>('PUT', `/applications/${id(applicationId)}/status`, { status }),
};

export const schedulingApi = {
  listMySlots: () => request<EmployerSlot[]>('GET', '/employers/me/availability'),
  createSlot: (input: SlotInput) => request<AvailabilitySlot>('POST', '/employers/me/availability', input),
  deleteSlot: (slotId: string) => request<void>('DELETE', `/employers/me/availability/${id(slotId)}`),
  availableSlots: (applicationId: string) =>
    request<AvailabilitySlot[]>('GET', `/applications/${id(applicationId)}/available-slots`),
  /** 409 SLOT_TAKEN "Slot already booked" when another candidate wins the race (FP-SCHED-3). */
  book: (applicationId: string, slotId: string) =>
    request<Application>('POST', `/applications/${id(applicationId)}/book`, { slot_id: slotId }),
};

export const systemApi = {
  health: () => request<{ status: string }>('GET', '/health'),
};
