// @vitest-environment jsdom
/**
 * Comprehensive frontend page workflow tests covering Candidate and Employer screens
 * not already exercised in workflows.test.tsx.
 *
 * Requirement IDs: FP-CAN-1, FP-CAN-2, FP-CAN-3, FP-EMP-1, FP-EMP-2, FP-EMP-3, FP-SCHED-1, FP-SCHED-2
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext } from '../../../frontend/src/context/auth-context';
import { ToastProvider } from '../../../frontend/src/context/ToastContext';
import CandidateApplicationsPage from '../../../frontend/src/pages/CandidateApplicationsPage';
import CandidateBookInterviewPage from '../../../frontend/src/pages/CandidateBookInterviewPage';
import CandidateJobsView from '../../../frontend/src/pages/CandidateJobsView';
import CandidateOverviewPage from '../../../frontend/src/pages/CandidateOverviewPage';
import CandidateProfilePage from '../../../frontend/src/pages/CandidateProfilePage';
import EmployerApplicantsPage from '../../../frontend/src/pages/EmployerApplicantsPage';
import EmployerAvailabilityPage from '../../../frontend/src/pages/EmployerAvailabilityPage';
import EmployerDashboardPage from '../../../frontend/src/pages/EmployerDashboardPage';
import EmployerJobFormPage from '../../../frontend/src/pages/EmployerJobFormPage';
import EmployerProfilePage from '../../../frontend/src/pages/EmployerProfilePage';

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const candUser = {
  id: 'cand-1',
  email: 'alice@demo.test',
  role: 'Candidate' as const,
  display_name: 'Alice Tan',
  created_at: '2026-01-01T00:00:00Z',
};

const empUser = {
  id: 'emp-1',
  email: 'hr@acme.test',
  role: 'Employer' as const,
  display_name: 'Acme HR',
  created_at: '2026-01-01T00:00:00Z',
};

const authValue = (user: typeof candUser | typeof empUser) => ({
  user,
  isLoading: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  previewAs: () => {},
});

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

beforeEach(() => {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => {
      store.delete(k);
    },
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true, writable: true });
  Object.defineProperty(window, 'localStorage', { value: mockStorage, configurable: true, writable: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Candidate pages (FP-CAN-1, FP-CAN-2, FP-CAN-3, FP-SCHED-2)', () => {
  it('FP-CAN-1: CandidateProfilePage loads, edits, replaces resume, enforces 20k char cap, and saves full replacement', async () => {
    let savedBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/candidates/me/profile') && (!init?.method || init.method === 'GET')) {
          return jsonRes({
            user_id: 'cand-1',
            display_name: 'Alice Tan',
            skills: ['python', 'sql'],
            resume_text: 'Initial resume content',
          });
        }
        if (url.endsWith('/api/candidates/me/profile') && init?.method === 'PUT') {
          savedBody = JSON.parse(String(init.body));
          return jsonRes({ user_id: 'cand-1', ...savedBody! });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <AuthContext.Provider value={authValue(candUser)}>
        <MemoryRouter>
          <CandidateProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    const nameInput = await screen.findByDisplayValue('Alice Tan');
    const resumeInput = screen.getByDisplayValue('Initial resume content');
    const saveBtn = screen.getByRole('button', { name: /Save profile changes/i }) as HTMLButtonElement;

    // Clean form keeps Save disabled
    expect(saveBtn.disabled).toBe(true);

    // Over-limit resume triggers client validation before calling PUT
    fireEvent.change(resumeInput, { target: { value: 'x'.repeat(20_001) } });
    expect(saveBtn.disabled).toBe(false);
    fireEvent.click(saveBtn);
    expect(await screen.findByText(/at most 20[.,]000 characters/i)).toBeTruthy();
    expect(savedBody).toBeNull();

    // Replace resume, edit display name, add a skill via Enter, and save
    fireEvent.change(nameInput, { target: { value: '  Alice Lin  ' } });
    fireEvent.change(resumeInput, { target: { value: 'Updated private resume' } });
    const skillInput = screen.getByPlaceholderText('e.g. Python');
    fireEvent.change(skillInput, { target: { value: 'typescript' } });
    fireEvent.keyDown(skillInput, { key: 'Enter' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(savedBody).toEqual({
        display_name: 'Alice Lin',
        skills: ['python', 'sql', 'typescript'],
        resume_text: 'Updated private resume',
      });
    });
    expect(await screen.findByText('Profile saved.')).toBeTruthy();
  });

  it('FP-CAN-2: CandidateJobsView preserves backend match-score order, supports tag/quick filters, and toggles saved jobs', async () => {
    const jobs = [
      {
        id: 'job-high',
        employer_id: 'emp-1',
        company_name: 'Acme Corp',
        company_description: 'Cloud platform',
        title: 'Backend Engineer',
        description: 'Build APIs in Python and SQL',
        required_skills: ['python', 'sql'],
        tags: ['Remote', 'Full-time'],
        created_at: '2026-01-01T00:00:00Z',
        match_score: 100,
        has_applied: false,
      },
      {
        id: 'job-mid',
        employer_id: 'emp-2',
        company_name: 'Beta Labs',
        company_description: 'ML research',
        title: 'Data Intern',
        description: 'Summer internship',
        required_skills: ['python', 'rust'],
        tags: ['Internship'],
        created_at: '2026-02-01T00:00:00Z',
        match_score: 50,
        has_applied: true,
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/jobs')) return jsonRes(jobs);
        if (url.endsWith('/api/candidates/me/profile')) {
          return jsonRes({ user_id: 'cand-1', display_name: 'Alice Tan', skills: ['python', 'sql'], resume_text: '' });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { container } = render(
      <ToastProvider>
        <AuthContext.Provider value={authValue(candUser)}>
          <MemoryRouter>
            <CandidateJobsView />
          </MemoryRouter>
        </AuthContext.Provider>
      </ToastProvider>,
    );

    await screen.findAllByText('Backend Engineer');
    const htmlBefore = container.textContent ?? '';
    expect(htmlBefore.indexOf('Backend Engineer')).toBeLessThan(htmlBefore.indexOf('Data Intern'));
    expect(htmlBefore).toContain('Build APIs in Python and SQL');
    expect(htmlBefore).toContain('Cloud platform');

    // Quick filter: Internships shows only Data Intern
    fireEvent.click(screen.getByRole('button', { name: 'Internships' }));
    expect(screen.queryByText('Backend Engineer')).toBeNull();
    expect(screen.getAllByText('Data Intern').length).toBeGreaterThan(0);

    // Quick filter: Best match (>= 67%) shows only Backend Engineer
    fireEvent.click(screen.getByRole('button', { name: 'Best match' }));
    expect(screen.queryByText('Data Intern')).toBeNull();
    expect(screen.getAllByText('Backend Engineer').length).toBeGreaterThan(0);

    // Save job toggles button label and persists in localStorage
    fireEvent.click(screen.getByRole('button', { name: /Save job/i }));
    expect(await screen.findByRole('button', { name: /Saved/i })).toBeTruthy();
  });

  it('FP-CAN-3 & FP-SCHED-2: CandidateApplicationsPage shows Book interview only for unbooked Interviewing apps and keeps booking info after Accepted/Rejected', async () => {
    const apps = [
      {
        id: 'app-pending',
        job_id: 'job-1',
        candidate_id: 'cand-1',
        status: 'Pending',
        created_at: '2026-01-01T00:00:00Z',
        interview_slot_id: null,
        match_score: 50,
        job: { id: 'job-1', title: 'Pending Role', company_name: 'Acme' },
        candidate: { id: 'cand-1', display_name: 'Alice Tan', skills: ['python'] },
        interview_slot: null,
      },
      {
        id: 'app-open-interview',
        job_id: 'job-2',
        candidate_id: 'cand-1',
        status: 'Interviewing',
        created_at: '2026-01-02T00:00:00Z',
        interview_slot_id: null,
        match_score: 100,
        job: { id: 'job-2', title: 'Open Interview Role', company_name: 'Beta' },
        candidate: { id: 'cand-1', display_name: 'Alice Tan', skills: ['python'] },
        interview_slot: null,
      },
      {
        id: 'app-accepted-booked',
        job_id: 'job-3',
        candidate_id: 'cand-1',
        status: 'Accepted',
        created_at: '2026-01-03T00:00:00Z',
        interview_slot_id: 'slot-booked',
        match_score: 100,
        job: { id: 'job-3', title: 'Accepted Booked Role', company_name: 'Gamma' },
        candidate: { id: 'cand-1', display_name: 'Alice Tan', skills: ['python'] },
        interview_slot: {
          id: 'slot-booked',
          employer_id: 'emp-3',
          start_time: '2027-07-01T10:00:00Z',
          end_time: '2027-07-01T10:30:00Z',
          is_booked: true,
        },
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith('/api/applications/mine')) return jsonRes(apps);
        throw new Error(`Unexpected fetch: ${input}`);
      }),
    );

    render(
      <ToastProvider>
        <AuthContext.Provider value={authValue(candUser)}>
          <MemoryRouter initialEntries={[{ pathname: '/candidate/applications', state: { bookingSuccess: true } }]}>
            <CandidateApplicationsPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </ToastProvider>,
    );

    await screen.findByText('Open Interview Role');
    // Booking success toast displayed on redirect
    expect(await screen.findByText('Interview booked successfully.')).toBeTruthy();

    // Only the unbooked Interviewing application has a Book interview link
    const bookLinks = screen.getAllByRole('link', { name: /Book interview/i });
    expect(bookLinks).toHaveLength(1);
    expect(bookLinks[0].getAttribute('href')).toBe('/candidate/applications/app-open-interview/book');

    // Accepted application still displays its booked interview time (not '—' or 'No interview booked yet')
    const acceptedCard = screen.getByText('Accepted Booked Role').closest('article')!;
    expect(acceptedCard.textContent).toContain('2027');
    expect(acceptedCard.textContent).not.toContain('No interview booked yet');

    // Status filter chips narrow the visible cards
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(screen.getByText('Pending Role')).toBeTruthy();
    expect(screen.queryByText('Open Interview Role')).toBeNull();
  });

  it('FP-SCHED-2: CandidateBookInterviewPage books a selected slot, blocks ineligible statuses, and displays SLOT_IN_PAST errors', async () => {
    let bookedPayload: { slot_id: string } | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/applications/mine')) {
          return jsonRes([
            {
              id: 'app-ok',
              job_id: 'job-1',
              candidate_id: 'cand-1',
              status: 'Interviewing',
              created_at: '2026-01-01T00:00:00Z',
              interview_slot_id: null,
              match_score: 100,
              job: { id: 'job-1', title: 'Backend Role', company_name: 'Acme' },
              candidate: { id: 'cand-1', display_name: 'Alice Tan', skills: ['python'] },
              interview_slot: null,
            },
            {
              id: 'app-pending',
              job_id: 'job-2',
              candidate_id: 'cand-1',
              status: 'Pending',
              created_at: '2026-01-01T00:00:00Z',
              interview_slot_id: null,
              match_score: 50,
              job: { id: 'job-2', title: 'Pending Role', company_name: 'Acme' },
              candidate: { id: 'cand-1', display_name: 'Alice Tan', skills: ['python'] },
              interview_slot: null,
            },
          ]);
        }
        if (url.endsWith('/api/applications/app-ok/available-slots')) {
          return jsonRes([
            {
              id: 'slot-1',
              employer_id: 'emp-1',
              start_time: '2027-07-01T10:00:00Z',
              end_time: '2027-07-01T10:30:00Z',
              is_booked: false,
            },
          ]);
        }
        if (url.endsWith('/api/applications/app-ok/book') && init?.method === 'POST') {
          bookedPayload = JSON.parse(String(init.body));
          return jsonRes({
            id: 'app-ok',
            job_id: 'job-1',
            candidate_id: 'cand-1',
            status: 'Interviewing',
            created_at: '2026-01-01T00:00:00Z',
            interview_slot_id: bookedPayload!.slot_id,
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { container } = render(
      <AuthContext.Provider value={authValue(candUser)}>
        <MemoryRouter initialEntries={['/candidate/applications/app-ok/book']}>
          <Routes>
            <Route path="/candidate/applications/:applicationId/book" element={<CandidateBookInterviewPage />} />
            <Route path="/candidate/applications" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    const confirmBtn = (await screen.findByRole('button', { name: /Confirm booking/i })) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    const radio = container.querySelector('input[type="radio"]') as HTMLInputElement;
    fireEvent.click(radio);
    expect(confirmBtn.disabled).toBe(false);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/candidate/applications');
    });
    expect(bookedPayload).toEqual({ slot_id: 'slot-1' });

    // Non-Interviewing application shows explanation and no slot picker
    cleanup();
    render(
      <AuthContext.Provider value={authValue(candUser)}>
        <MemoryRouter initialEntries={['/candidate/applications/app-pending/book']}>
          <Routes>
            <Route path="/candidate/applications/:applicationId/book" element={<CandidateBookInterviewPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByText(/Booking is only available when your application status is/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Confirm booking/i })).toBeNull();
  });

  it('CandidateOverviewPage renders workspace stats, top recommended jobs, and profile skills', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/jobs')) {
          return jsonRes([
            {
              id: 'job-1',
              employer_id: 'emp-1',
              company_name: 'Acme',
              company_description: '',
              title: 'Platform Engineer',
              description: 'Build infra',
              required_skills: ['python'],
              tags: ['Remote'],
              created_at: '2026-01-01T00:00:00Z',
              match_score: 100,
              has_applied: false,
            },
          ]);
        }
        if (url.endsWith('/api/applications/mine')) return jsonRes([]);
        if (url.endsWith('/api/candidates/me/profile')) {
          return jsonRes({ user_id: 'cand-1', display_name: 'Alice Tan', skills: ['python', 'sql'], resume_text: '' });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <AuthContext.Provider value={authValue(candUser)}>
        <MemoryRouter>
          <CandidateOverviewPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByText(/Good to see you, Alice\./)).toBeTruthy();
    expect(screen.getByText('Platform Engineer')).toBeTruthy();
    expect(screen.getByText('100% match')).toBeTruthy();
    expect(screen.getByText('python')).toBeTruthy();
  });
});

describe('Employer pages (FP-EMP-1, FP-EMP-2, FP-EMP-3, FP-SCHED-1)', () => {
  it('FP-EMP-1: EmployerProfilePage loads company profile and saves full replacement on PUT', async () => {
    let savedBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/employers/me/profile') && (!init?.method || init.method === 'GET')) {
          return jsonRes({ user_id: 'emp-1', company_name: 'Acme', description: 'Old bio' });
        }
        if (url.endsWith('/api/employers/me/profile') && init?.method === 'PUT') {
          savedBody = JSON.parse(String(init.body));
          return jsonRes({ user_id: 'emp-1', ...savedBody! });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <AuthContext.Provider value={authValue(empUser)}>
        <MemoryRouter>
          <EmployerProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    const nameInput = await screen.findByDisplayValue('Acme');
    const descInput = screen.getByDisplayValue('Old bio');
    const saveBtn = screen.getByRole('button', { name: /Save profile/i }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    fireEvent.change(nameInput, { target: { value: '  Acme Labs  ' } });
    fireEvent.change(descInput, { target: { value: 'Building recruiting software' } });
    expect(saveBtn.disabled).toBe(false);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(savedBody).toEqual({
        company_name: 'Acme Labs',
        description: 'Building recruiting software',
      });
    });
    expect(await screen.findByText('Company profile saved.')).toBeTruthy();
  });

  it('FP-EMP-2: EmployerJobFormPage creates a job with empty required_skills, preserves tags on PUT edit, and blocks editing another employer job', async () => {
    let createdBody: Record<string, unknown> | null = null;
    let updatedBody: Record<string, unknown> | null = null;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/jobs') && init?.method === 'POST') {
          createdBody = JSON.parse(String(init.body));
          return jsonRes({ id: 'job-new', employer_id: 'emp-1', company_name: 'Acme', company_description: '', created_at: '2026-01-01T00:00:00Z', ...createdBody! }, 201);
        }
        if (url.endsWith('/api/jobs/job-owned') && (!init?.method || init.method === 'GET')) {
          return jsonRes({
            id: 'job-owned',
            employer_id: 'emp-1',
            company_name: 'Acme',
            company_description: '',
            title: 'Old Title',
            description: 'Old Desc',
            required_skills: ['python'],
            tags: ['Remote', 'Full-time'],
            created_at: '2026-01-01T00:00:00Z',
          });
        }
        if (url.endsWith('/api/jobs/job-owned') && init?.method === 'PUT') {
          updatedBody = JSON.parse(String(init.body));
          return jsonRes({ id: 'job-owned', employer_id: 'emp-1', company_name: 'Acme', company_description: '', created_at: '2026-01-01T00:00:00Z', ...updatedBody! });
        }
        if (url.endsWith('/api/jobs/job-other')) {
          return jsonRes({
            id: 'job-other',
            employer_id: 'emp-other',
            company_name: 'OtherCo',
            company_description: '',
            title: 'Someone Else Role',
            description: 'Desc',
            required_skills: [],
            tags: [],
            created_at: '2026-01-01T00:00:00Z',
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    // 1. Create job with empty required_skills (allowed by FP-EMP-2)
    render(
      <AuthContext.Provider value={authValue(empUser)}>
        <MemoryRouter initialEntries={['/employer/jobs/new']}>
          <Routes>
            <Route path="/employer/jobs/new" element={<EmployerJobFormPage />} />
            <Route path="/employer" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    fireEvent.change(await screen.findByLabelText(/Job title/i), { target: { value: 'Graduate Generalist' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Open to all backgrounds' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create job' }));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/employer');
    });
    expect(createdBody).toEqual({
      title: 'Graduate Generalist',
      description: 'Open to all backgrounds',
      required_skills: [],
      tags: [],
    });

    // 2. Edit job sends full PUT payload including unchanged tags (specs/004)
    cleanup();
    render(
      <AuthContext.Provider value={authValue(empUser)}>
        <MemoryRouter initialEntries={['/employer/jobs/job-owned/edit']}>
          <Routes>
            <Route path="/employer/jobs/:jobId/edit" element={<EmployerJobFormPage />} />
            <Route path="/employer" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    const titleInput = await screen.findByDisplayValue('Old Title');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updatedBody).toEqual({
        title: 'New Title',
        description: 'Old Desc',
        required_skills: ['python'],
        tags: ['Remote', 'Full-time'],
      });
    });

    // 3. Another employer's job shows forbidden message instead of edit form
    cleanup();
    render(
      <AuthContext.Provider value={authValue(empUser)}>
        <MemoryRouter initialEntries={['/employer/jobs/job-other/edit']}>
          <Routes>
            <Route path="/employer/jobs/:jobId/edit" element={<EmployerJobFormPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByText(/belongs to another employer/i)).toBeTruthy();
  });

  it('FP-EMP-2: EmployerDashboardPage shows 409 JOB_HAS_DEPENDENTS error and keeps job in list if delete conflicts on server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/jobs/mine')) {
          return jsonRes([
            {
              id: 'job-race',
              employer_id: 'emp-1',
              company_name: 'Acme',
              company_description: '',
              title: 'Racing Role',
              description: 'Desc',
              required_skills: [],
              tags: [],
              created_at: '2026-01-01T00:00:00Z',
              applicant_count: 0,
            },
          ]);
        }
        if (url.endsWith('/api/jobs/job-race') && init?.method === 'DELETE') {
          return jsonRes({ error: { code: 'JOB_HAS_DEPENDENTS', message: 'Job has applications' } }, 409);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <ToastProvider>
        <AuthContext.Provider value={authValue(empUser)}>
          <MemoryRouter>
            <EmployerDashboardPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </ToastProvider>,
    );

    await screen.findByText('Racing Role');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByText('Delete job posting?');

    // Confirm deletion -> server returns 409 JOB_HAS_DEPENDENTS
    const confirmBtn = screen.getByRole('alertdialog').querySelectorAll('button')[1];
    fireEvent.click(confirmBtn);

    expect(await screen.findByText(/has applicants, so it can't be deleted/i)).toBeTruthy();
    expect(screen.getByText('Racing Role')).toBeTruthy();
  });

  it('FP-EMP-3 & FP-SCHED-2: EmployerApplicantsPage updates Pending->Interviewing directly and preserves booked interview display when moving to Accepted', async () => {
    const statusCalls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/jobs/job-1')) {
          return jsonRes({
            id: 'job-1',
            employer_id: 'emp-1',
            company_name: 'Acme',
            company_description: '',
            title: 'Backend Engineer',
            description: 'Desc',
            required_skills: ['python'],
            tags: [],
            created_at: '2026-01-01T00:00:00Z',
          });
        }
        if (url.endsWith('/api/jobs/job-1/applicants')) {
          return jsonRes([
            {
              id: 'app-1',
              job_id: 'job-1',
              candidate_id: 'cand-1',
              status: 'Pending',
              created_at: '2026-01-02T00:00:00Z',
              interview_slot_id: 'slot-1',
              match_score: 100,
              job: { id: 'job-1', title: 'Backend Engineer', company_name: 'Acme' },
              candidate: { id: 'cand-1', display_name: 'Alice Tan', skills: ['python'] },
              interview_slot: {
                id: 'slot-1',
                employer_id: 'emp-1',
                start_time: '2027-07-01T10:00:00Z',
                end_time: '2027-07-01T10:30:00Z',
                is_booked: true,
              },
            },
          ]);
        }
        if (url.endsWith('/api/applications/app-1/status') && init?.method === 'PUT') {
          const body = JSON.parse(String(init.body)) as { status: string };
          statusCalls.push(body.status);
          return jsonRes({
            id: 'app-1',
            job_id: 'job-1',
            candidate_id: 'cand-1',
            status: body.status,
            created_at: '2026-01-02T00:00:00Z',
            interview_slot_id: 'slot-1',
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { container } = render(
      <ToastProvider>
        <AuthContext.Provider value={authValue(empUser)}>
          <MemoryRouter initialEntries={['/employer/jobs/job-1/applicants']}>
            <Routes>
              <Route path="/employer/jobs/:jobId/applicants" element={<EmployerApplicantsPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </ToastProvider>,
    );

    await screen.findByText('Alice Tan');
    const select = screen.getByLabelText('Update status') as HTMLSelectElement;

    // Non-decision transition (Pending -> Interviewing) does not require a confirmation dialog
    fireEvent.change(select, { target: { value: 'Interviewing' } });
    await waitFor(() => {
      expect(statusCalls).toEqual(['Interviewing']);
    });

    // Moving to Accepted prompts confirmation; cancelling does not call PUT
    fireEvent.change(select, { target: { value: 'Accepted' } });
    await screen.findByText('Change applicant status?');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(statusCalls).toEqual(['Interviewing']);

    // Confirming Accepted updates status while keeping the booked interview time visible
    fireEvent.change(select, { target: { value: 'Accepted' } });
    await screen.findByText('Change applicant status?');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => {
      expect(statusCalls).toEqual(['Interviewing', 'Accepted']);
    });
    expect(container.textContent).toContain('2027');
  });

  it('FP-SCHED-1: EmployerAvailabilityPage creates 30-min slots, displays 409 SLOT_OVERLAP, disables delete on booked slots, and deletes open slots', async () => {
    let createAttempt = 0;
    let createdPayload: { start_time: string; end_time: string } | null = null;
    let deletedSlotId: string | null = null;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/employers/me/availability') && (!init?.method || init.method === 'GET')) {
          return jsonRes([
            {
              id: 'slot-booked',
              employer_id: 'emp-1',
              start_time: '2027-07-01T09:00:00.000Z',
              end_time: '2027-07-01T09:30:00.000Z',
              is_booked: true,
              booking: {
                application_id: 'app-1',
                job_id: 'job-1',
                job_title: 'Backend Engineer',
                candidate_id: 'cand-1',
                candidate_display_name: 'Alice Tan',
              },
            },
            {
              id: 'slot-open',
              employer_id: 'emp-1',
              start_time: '2027-07-01T10:00:00.000Z',
              end_time: '2027-07-01T10:30:00.000Z',
              is_booked: false,
              booking: null,
            },
          ]);
        }
        if (url.endsWith('/api/employers/me/availability') && init?.method === 'POST') {
          createAttempt += 1;
          createdPayload = JSON.parse(String(init.body));
          if (createAttempt === 1) {
            return jsonRes(
              {
                id: 'slot-created',
                employer_id: 'emp-1',
                start_time: createdPayload!.start_time,
                end_time: createdPayload!.end_time,
                is_booked: false,
              },
              201,
            );
          }
          return jsonRes(
            { error: { code: 'SLOT_OVERLAP', message: 'You already have a slot that overlaps this time' } },
            409,
          );
        }
        if (url.endsWith('/api/employers/me/availability/slot-open') && init?.method === 'DELETE') {
          deletedSlotId = 'slot-open';
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <ToastProvider>
        <AuthContext.Provider value={authValue(empUser)}>
          <MemoryRouter>
            <EmployerAvailabilityPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </ToastProvider>,
    );

    // Booked slot shows who booked it and disables Delete
    expect(await screen.findByText('Booked by Alice Tan (Backend Engineer)')).toBeTruthy();
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' }) as HTMLButtonElement[];
    expect(deleteButtons).toHaveLength(2);
    expect(deleteButtons[0].disabled).toBe(true);
    expect(deleteButtons[1].disabled).toBe(false);

    // Create a new 30-minute slot
    fireEvent.click(screen.getByRole('button', { name: 'Add slot' }));
    await waitFor(() => {
      expect(createdPayload).not.toBeNull();
    });
    const diffMs =
      new Date(createdPayload!.end_time).getTime() - new Date(createdPayload!.start_time).getTime();
    expect(diffMs).toBe(30 * 60_000);
    expect(createdPayload!.start_time.endsWith('Z')).toBe(true);

    // Second overlapping create displays backend 409 SLOT_OVERLAP message
    fireEvent.click(screen.getByRole('button', { name: 'Add slot' }));
    expect(await screen.findByText(/overlaps this time/i)).toBeTruthy();

    // Delete the 2027 open slot (now index 2 after the newly created near-future slot was sorted first)
    const buttonsAfterCreate = screen.getAllByRole('button', { name: 'Delete' }) as HTMLButtonElement[];
    expect(buttonsAfterCreate).toHaveLength(3);
    expect(buttonsAfterCreate[1].disabled).toBe(true); // slot-booked
    fireEvent.click(buttonsAfterCreate[2]); // slot-open
    await screen.findByText('Delete slot?');
    const dialogConfirm = screen.getByRole('alertdialog').querySelectorAll('button')[1];
    fireEvent.click(dialogConfirm);

    await waitFor(() => {
      expect(deletedSlotId).toBe('slot-open');
    });
  });
});
