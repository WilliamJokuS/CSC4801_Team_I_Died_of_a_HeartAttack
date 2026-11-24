// @vitest-environment jsdom
/**
 * Regression test suite for bugs found in `frontend/` (Ean Jie) and `backend/` (William).
 *
 * Run with:
 *   npm run test:bugs
 *
 * Every test in this file exercises the real source code in `../frontend/src` or `../backend/src`
 * and asserts the **expected (fixed)** behavior. Tests that fail here correspond to open bugs
 * reported to the respective folder owners; each test will turn green once its owner lands the fix.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setToken } from '../../../frontend/src/api/client';
import { AuthContext } from '../../../frontend/src/context/auth-context';
import { AuthProvider } from '../../../frontend/src/context/AuthContext';
import { ToastProvider } from '../../../frontend/src/context/ToastContext';
import ApplicationStatusBadge from '../../../frontend/src/components/ApplicationStatusBadge';
import EmployerAppLayout from '../../../frontend/src/components/layout/EmployerAppLayout';
import CandidateAppLayout from '../../../frontend/src/components/layout/CandidateAppLayout';
import CandidateBookInterviewPage from '../../../frontend/src/pages/CandidateBookInterviewPage';
import CandidateJobsView from '../../../frontend/src/pages/CandidateJobsView';
import CandidateOverviewPage from '../../../frontend/src/pages/CandidateOverviewPage';
import EmployerApplicantsPage from '../../../frontend/src/pages/EmployerApplicantsPage';
import EmployerAvailabilityPage from '../../../frontend/src/pages/EmployerAvailabilityPage';
import EmployerDashboardPage from '../../../frontend/src/pages/EmployerDashboardPage';
import EmployerJobFormPage from '../../../frontend/src/pages/EmployerJobFormPage';
import CandidateProfilePage from '../../../frontend/src/pages/CandidateProfilePage';
import AuthPage from '../../../frontend/src/pages/AuthPage';
import { compareScoredJobs as frontendCompareJobs } from '../../../frontend/src/lib/matchScore';
import { clampSlotStartInput } from '../../../frontend/src/lib/slotTimeInput';
import { compareScoredJobs as backendCompareJobs } from '../../../backend/src/matching/index.js';
import { skillsSchema, tagsSchema } from '../../../backend/src/lib/skills.js';
import { FakePrisma } from '../support/fakePrisma.js';
import { MISSING_ID, startServer, tokenFor } from '../support/server.js';

const REPO_ROOT = resolve(__dirname, '../../..');

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
});

const staticAuth = <T extends { role: 'Candidate' | 'Employer' }>(user: T & { id: string; email: string; display_name: string; created_at: string }) => ({
  user,
  isLoading: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  previewAs: () => {},
});

const empUser = {
  id: 'emp-1',
  email: 'hr@acme.test',
  role: 'Employer' as const,
  display_name: 'Acme HR',
  created_at: '2026-01-01T00:00:00Z',
};

const candUser = {
  id: 'cand-1',
  email: 'alice@demo.test',
  role: 'Candidate' as const,
  display_name: 'Alice Tan',
  created_at: '2026-01-01T00:00:00Z',
};

describe('Open Bug Regressions — Frontend (Owner: Ean Jie)', () => {
  it('BUG-FE-1 (FP-EMP-3): EmployerApplicantsPage MUST render candidate.skills even when job.required_skills is empty or candidate has extra skills', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/jobs/job-generalist')) {
        return new Response(
          JSON.stringify({
            id: 'job-generalist',
            employer_id: 'emp-1',
            company_name: 'Acme',
            company_description: '',
            title: 'Graduate Generalist',
            description: 'No required skills',
            required_skills: [],
            tags: [],
            created_at: '2026-01-01T00:00:00Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/jobs/job-generalist/applicants')) {
        return new Response(
          JSON.stringify([
            {
              id: 'app-1',
              job_id: 'job-generalist',
              candidate_id: 'cand-1',
              status: 'Pending',
              created_at: '2026-01-02T00:00:00Z',
              interview_slot_id: null,
              match_score: 100,
              job: { id: 'job-generalist', title: 'Graduate Generalist', company_name: 'Acme' },
              candidate: { id: 'cand-1', display_name: 'Alice Tan', skills: ['python', 'sql', 'rust'] },
              interview_slot: null,
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/jobs/job-specific')) {
        return new Response(
          JSON.stringify({
            id: 'job-specific',
            employer_id: 'emp-1',
            company_name: 'Acme',
            company_description: '',
            title: 'Python Role',
            description: 'Needs Python',
            required_skills: ['python'],
            tags: [],
            created_at: '2026-01-01T00:00:00Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/jobs/job-specific/applicants')) {
        return new Response(
          JSON.stringify([
            {
              id: 'app-2',
              job_id: 'job-specific',
              candidate_id: 'cand-1',
              status: 'Pending',
              created_at: '2026-01-02T00:00:00Z',
              interview_slot_id: null,
              match_score: 100,
              job: { id: 'job-specific', title: 'Python Role', company_name: 'Acme' },
              candidate: { id: 'cand-1', display_name: 'Alice Tan', skills: ['python', 'rust'] },
              interview_slot: null,
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const first = render(
        <ToastProvider>
          <AuthContext.Provider value={staticAuth(empUser)}>
            <MemoryRouter initialEntries={['/employer/jobs/job-generalist/applicants']}>
              <Routes>
                <Route path="/employer/jobs/:jobId/applicants" element={<EmployerApplicantsPage />} />
              </Routes>
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>,
      );

      await first.findByText('Alice Tan');
      const generalistText = first.container.textContent ?? '';
      expect(generalistText).toContain('python');
      expect(generalistText).toContain('sql');
      expect(generalistText).toContain('rust');
      cleanup();

      const second = render(
        <ToastProvider>
          <AuthContext.Provider value={staticAuth(empUser)}>
            <MemoryRouter initialEntries={['/employer/jobs/job-specific/applicants']}>
              <Routes>
                <Route path="/employer/jobs/:jobId/applicants" element={<EmployerApplicantsPage />} />
              </Routes>
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>,
      );

      await second.findByText('Alice Tan');
      const specificText = second.container.textContent ?? '';
      expect(specificText).toContain('python');
      expect(specificText).toContain('rust');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-2 (EmployerAppLayout.tsx:36): Visiting /employer/availability highlights ONLY "Interview slots", not "Job postings"', () => {
    const { container } = render(
      <AuthContext.Provider value={staticAuth(empUser)}>
        <MemoryRouter initialEntries={['/employer/availability']}>
          <EmployerAppLayout />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    const activeTabs = Array.from(container.querySelectorAll('nav a'))
      .filter((a) => a.className.includes('bg-[#edf3ff]') || a.getAttribute('aria-current') === 'page')
      .map((a) => a.textContent?.trim());

    expect(activeTabs).toEqual(['Interview slots']);
  });

  // Note: former BUG-FE-3 (AuthPage.tsx:117) was verified against the real AuthProvider and passes
  // because AuthPage's `if (user) return <Navigate ... />` redirects Employers to /employer before
  // line 118 runs; that coverage now lives in `src/frontend/auth-and-routing.test.tsx`. (Line 117
  // still uses stale `role` state as dead code worth cleaning up.)

  it('BUG-FE-4 (CandidateProfilePage.tsx:247-255): CandidateProfilePage renders each skill pill once (not duplicated below SkillsField)', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          user_id: 'cand-1',
          display_name: 'Alice Tan',
          skills: ['python'],
          resume_text: 'My resume',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    try {
      const { container, findByDisplayValue } = render(
        <AuthContext.Provider value={staticAuth(candUser)}>
          <MemoryRouter>
            <CandidateProfilePage />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      await findByDisplayValue('Alice Tan');
      const pythonSpans = Array.from(container.querySelectorAll('span')).filter(
        (el) => el.textContent === 'python' || el.textContent === 'python×',
      );
      expect(pythonSpans.length).toBe(1);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-5 (EmployerJobFormPage.tsx / formChange.ts): Reordering job tags enables "Save changes" so primary card tag (tags[0]) can be updated', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          id: 'job-1',
          employer_id: 'emp-1',
          company_name: 'Acme',
          company_description: '',
          title: 'Senior Backend Engineer',
          description: 'Build services',
          required_skills: ['python', 'sql'],
          tags: ['Remote', 'Full-time'],
          created_at: '2026-01-01T00:00:00Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    try {
      const { findByDisplayValue, getByRole, getByPlaceholderText } = render(
        <AuthContext.Provider value={staticAuth(empUser)}>
          <MemoryRouter initialEntries={['/employer/jobs/job-1/edit']}>
            <Routes>
              <Route path="/employer/jobs/:jobId/edit" element={<EmployerJobFormPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      await findByDisplayValue('Senior Backend Engineer');

      // Reorder ['Remote', 'Full-time'] -> ['Full-time', 'Remote']
      fireEvent.click(getByRole('button', { name: 'Remove Remote' }));
      const tagInput = getByPlaceholderText('e.g. Remote');
      fireEvent.change(tagInput, { target: { value: 'Remote' } });
      fireEvent.keyDown(tagInput, { key: 'Enter' });

      const saveBtn = getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(false);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-6 (matchScore.ts): Frontend compareScoredJobs tie-breaking matches backend code-unit ordering', () => {
    const base = {
      employer_id: 'emp-1',
      company_name: 'Co',
      company_description: '',
      description: 'desc',
      required_skills: [],
      tags: [],
      created_at: '2026-01-01T00:00:00Z',
      match_score: 100,
      has_applied: false,
    };
    const jobs = [
      { ...base, id: '1', title: 'zebra' },
      { ...base, id: '2', title: 'éclair' },
    ];
    const backendSorted = [...jobs].sort(backendCompareJobs).map((j) => j.title);
    const frontendSorted = [...jobs].sort(frontendCompareJobs).map((j) => j.title);
    expect(frontendSorted).toEqual(backendSorted);
  });

  it('BUG-FE-7 (EmployerAvailabilityPage.tsx / slotTimeInput.ts): Typing intermediate minutes or clearing input does not prematurely snap to :00 or min', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;

    try {
      const { findByLabelText } = render(
        <ToastProvider>
          <AuthContext.Provider value={staticAuth(empUser)}>
            <MemoryRouter>
              <EmployerAvailabilityPage />
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>,
      );

      const input = (await findByLabelText(/Slot start time/i)) as HTMLInputElement;

      // Typing "3" intending "30" produces intermediate value "10:03"; onChange should not snap to "10:00"
      fireEvent.change(input, { target: { value: '2027-11-09T10:03' } });
      expect(input.value).toBe('2027-11-09T10:03');

      // Clearing input ("") should remain "" rather than snapping to min
      fireEvent.change(input, { target: { value: '' } });
      expect(input.value).toBe('');
      expect(clampSlotStartInput('', '2027-11-09T09:00')).toBe('');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-8 (EmployerApplicantsPage.tsx:190-193): Applicant summary line includes Rejected count so breakdown sums to total', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/jobs/job-1')) {
        return new Response(
          JSON.stringify({
            id: 'job-1',
            employer_id: 'emp-1',
            company_name: 'Acme',
            company_description: '',
            title: 'Role',
            description: 'Desc',
            required_skills: ['python'],
            tags: [],
            created_at: '2026-01-01T00:00:00Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/jobs/job-1/applicants')) {
        return new Response(
          JSON.stringify([
            {
              id: 'app-1',
              job_id: 'job-1',
              candidate_id: 'cand-1',
              status: 'Rejected',
              created_at: '2026-01-02T00:00:00Z',
              interview_slot_id: null,
              match_score: 100,
              job: { id: 'job-1', title: 'Role', company_name: 'Acme' },
              candidate: { id: 'cand-1', display_name: 'Alice Tan', skills: ['python'] },
              interview_slot: null,
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { container, findByText } = render(
        <ToastProvider>
          <AuthContext.Provider value={staticAuth(empUser)}>
            <MemoryRouter initialEntries={['/employer/jobs/job-1/applicants']}>
              <Routes>
                <Route path="/employer/jobs/:jobId/applicants" element={<EmployerApplicantsPage />} />
              </Routes>
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>,
      );

      await findByText('Alice Tan');
      const summaryLine = Array.from(container.querySelectorAll('p'))
        .map((p) => p.textContent?.trim() ?? '')
        .find((t) => t.includes('applicant'));

      expect(summaryLine?.toLowerCase()).toContain('1 rejected');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-9 (CandidateProfilePage.tsx): Uncommitted skill input text is committed on save instead of silently dropped', async () => {
    let putPayload: { display_name: string; skills: string[]; resume_text: string } | null = null;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/candidates/me/profile') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            user_id: 'cand-1',
            display_name: 'Alice Tan',
            skills: ['python'],
            resume_text: 'My resume',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/candidates/me/profile') && init?.method === 'PUT') {
        putPayload = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({ user_id: 'cand-1', ...putPayload! }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { container, findByDisplayValue, getByPlaceholderText } = render(
        <AuthContext.Provider value={staticAuth(candUser)}>
          <MemoryRouter>
            <CandidateProfilePage />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      const nameInput = await findByDisplayValue('Alice Tan');
      const skillInput = getByPlaceholderText('e.g. Python');
      fireEvent.change(skillInput, { target: { value: 'docker' } });
      fireEvent.change(nameInput, { target: { value: 'Alice Lin' } });

      const saveButtons = Array.from(container.querySelectorAll('button[type="submit"]')) as HTMLButtonElement[];
      fireEvent.click(saveButtons[0]);

      await waitFor(() => {
        expect(putPayload).not.toBeNull();
      });

      expect(putPayload!.skills).toContain('docker');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-10 (CandidateProfilePage.tsx / AuthContext.tsx): Updating display_name refreshes the top navbar avatar initials', async () => {
    setToken('cand-jwt');
    let currentDisplayName = 'Alice Tan';
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/me')) {
        return new Response(
          JSON.stringify({ ...candUser, display_name: currentDisplayName }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/candidates/me/profile') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            user_id: 'cand-1',
            display_name: currentDisplayName,
            skills: ['python'],
            resume_text: 'My resume',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/candidates/me/profile') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as { display_name: string; skills: string[]; resume_text: string };
        currentDisplayName = body.display_name;
        return new Response(
          JSON.stringify({ user_id: 'cand-1', ...body }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { container, findByDisplayValue } = render(
        <MemoryRouter initialEntries={['/candidate/profile']}>
          <AuthProvider>
            <Routes>
              <Route path="/candidate" element={<CandidateAppLayout />}>
                <Route path="profile" element={<CandidateProfilePage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      );

      const nameInput = await findByDisplayValue('Alice Tan');
      fireEvent.change(nameInput, { target: { value: 'Bob Lim' } });

      const saveButtons = Array.from(container.querySelectorAll('button[type="submit"]')) as HTMLButtonElement[];
      fireEvent.click(saveButtons[0]);

      await waitFor(() => {
        const headerAvatar = container.querySelector('header a[title="Profile"]')?.textContent?.trim();
        expect(headerAvatar).toBe('BL');
      });
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-11 (FP-SCHED-3, CandidateBookInterviewPage.tsx:44,104-109): 409 SLOT_TAKEN keeps the error message visible after reloading slots and clears the stale selectedSlotId', async () => {
    let availableSlotsCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/applications/mine')) {
        return new Response(
          JSON.stringify([
            {
              id: 'app-race',
              job_id: 'job-1',
              candidate_id: 'cand-1',
              status: 'Interviewing',
              created_at: '2026-01-02T00:00:00Z',
              interview_slot_id: null,
              match_score: 100,
              job: { id: 'job-1', title: 'Backend Engineer', company_name: 'Acme' },
              candidate: { id: 'cand-1', display_name: 'Alice Tan', skills: ['python'] },
              interview_slot: null,
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/applications/app-race/available-slots')) {
        availableSlotsCalls += 1;
        const slots =
          availableSlotsCalls === 1
            ? [
                { id: 'slot-1', employer_id: 'emp-1', start_time: '2027-06-01T10:00:00Z', end_time: '2027-06-01T10:30:00Z', is_booked: false },
                { id: 'slot-2', employer_id: 'emp-1', start_time: '2027-06-01T11:00:00Z', end_time: '2027-06-01T11:30:00Z', is_booked: false },
              ]
            : [
                { id: 'slot-2', employer_id: 'emp-1', start_time: '2027-06-01T11:00:00Z', end_time: '2027-06-01T11:30:00Z', is_booked: false },
              ];
        return new Response(JSON.stringify(slots), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/api/applications/app-race/book') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ error: { code: 'SLOT_TAKEN', message: 'Slot already booked' } }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { container, findByRole } = render(
        <AuthContext.Provider value={staticAuth(candUser)}>
          <MemoryRouter initialEntries={['/candidate/applications/app-race/book']}>
            <Routes>
              <Route path="/candidate/applications/:applicationId/book" element={<CandidateBookInterviewPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      const confirmBtn = (await findByRole('button', { name: /Confirm booking/i })) as HTMLButtonElement;
      const radios = Array.from(container.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
      fireEvent.click(radios[0]); // slot-1
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(availableSlotsCalls).toBe(2);
      });

      const refreshedConfirmBtn = (await findByRole('button', { name: /Confirm booking/i })) as HTMLButtonElement;
      // Error explaining why booking failed must remain visible after reload (not wiped by loadPage())
      expect(container.textContent).toMatch(/already booked|just booked|pick another/i);
      // Stale selectedSlotId ('slot-1') must be cleared so Confirm stays disabled until slot-2 is picked
      expect(refreshedConfirmBtn.disabled).toBe(true);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-12 (FP-SCHED-1, EmployerAvailabilityPage.tsx:117-127): Submitting an empty/invalid slot time shows a validation message instead of throwing RangeError and sticking on "Creating…"', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;

    try {
      const { container, findByLabelText, getByRole } = render(
        <ToastProvider>
          <AuthContext.Provider value={staticAuth(empUser)}>
            <MemoryRouter>
              <EmployerAvailabilityPage />
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>,
      );

      const input = (await findByLabelText(/Slot start time/i)) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'invalid-date' } });
      const form = container.querySelector('form')!;
      fireEvent.submit(form);

      // Must recover cleanly (not leave submit button permanently disabled on "Creating…")
      const submitBtn = getByRole('button', { name: /Add slot|Creating/i }) as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(false);
      expect(submitBtn.textContent).toBe('Add slot');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-13 (FP-EMP-2, EmployerJobFormPage.tsx:148-153): Uncommitted skill and tag inputs are committed on job submit instead of silently dropped', async () => {
    let createdPayload: { title: string; description: string; required_skills: string[]; tags?: string[] } | null = null;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/jobs') && init?.method === 'POST') {
        createdPayload = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            id: 'job-new',
            employer_id: 'emp-1',
            company_name: 'Acme',
            company_description: '',
            created_at: '2026-01-01T00:00:00Z',
            ...createdPayload!,
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { findByLabelText, getByPlaceholderText, getByRole } = render(
        <AuthContext.Provider value={staticAuth(empUser)}>
          <MemoryRouter initialEntries={['/employer/jobs/new']}>
            <Routes>
              <Route path="/employer/jobs/new" element={<EmployerJobFormPage />} />
              <Route path="/employer" element={<div>Employer home</div>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      fireEvent.change(await findByLabelText(/Job title/i), { target: { value: 'Backend Engineer' } });
      fireEvent.change(await findByLabelText(/Description/i), { target: { value: 'Build APIs' } });
      // Type a skill and a tag without pressing Enter, then submit the form
      fireEvent.change(getByPlaceholderText('e.g. Python'), { target: { value: 'python' } });
      fireEvent.change(getByPlaceholderText('e.g. Remote'), { target: { value: 'Remote' } });
      fireEvent.click(getByRole('button', { name: 'Create job' }));

      await waitFor(() => {
        expect(createdPayload).not.toBeNull();
      });

      expect(createdPayload!.required_skills).toContain('python');
      expect(createdPayload!.tags).toContain('Remote');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-14 (FP-AUTH-1, AuthPage.tsx:32-39,67-75): Clicking "Explore with demo account" from /register keeps alice@demo.test and confirmation message even when another email is remembered', async () => {
    localStorage.setItem('csc4801.rememberEmail', 'hr@acme.demo.test');

    const { findByRole, getByLabelText, container } = render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <Routes>
            <Route path="/register" element={<AuthPage />} />
            <Route path="/login" element={<AuthPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    const demoBtn = await findByRole('button', { name: /Explore with demo account/i });
    fireEvent.click(demoBtn);

    await waitFor(() => {
      const emailInput = getByLabelText(/Email address/i) as HTMLInputElement;
      expect(emailInput.value).toBe('alice@demo.test');
    });
    expect(container.textContent).toMatch(/Demo credentials filled/i);
  });

  it('BUG-FE-15 (SEC-02 / FP-AUTH-1, FP-CAN-1, endpoints.ts:40-46 / AuthContext.tsx:44-47): Logout clears authenticated UI and private resume even if POST /api/auth/logout fails (multi-tab 401 or backend 5xx)', async () => {
    setToken('cand-jwt');
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/me')) {
        return new Response(JSON.stringify(candUser), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/api/candidates/me/profile')) {
        return new Response(
          JSON.stringify({
            user_id: 'cand-1',
            display_name: 'Alice Tan',
            skills: ['python'],
            resume_text: 'CONFIDENTIAL RESUME CONTENT',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/auth/logout') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { findByDisplayValue, getByRole, queryByDisplayValue, findByText } = render(
        <MemoryRouter initialEntries={['/candidate/profile']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>Login page</div>} />
              <Route path="/candidate" element={<CandidateAppLayout />}>
                <Route path="profile" element={<CandidateProfilePage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      );

      await findByDisplayValue('CONFIDENTIAL RESUME CONTENT');

      // Simulate another tab logging out first so localStorage token is already gone
      setToken(null);

      fireEvent.click(getByRole('button', { name: /Log out/i }));

      expect(await findByText('Login page')).toBeTruthy();
      expect(queryByDisplayValue('CONFIDENTIAL RESUME CONTENT')).toBeNull();
      expect(localStorage.getItem('csc4801.token')).toBeNull();
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-16 (FUNC-01 / FP-CAN-3, FP-EMP-3, ApplicationStatusBadge.tsx:10-15 / CandidateBookInterviewPage.tsx:152): Status badge displays canonical "Interviewing" (not "Invited") and booked interview page never shows "Invited"', async () => {
    const unbooked = render(<ApplicationStatusBadge status="Interviewing" interviewBooked={false} />);
    expect(unbooked.container.textContent).toMatch(/Interviewing/i);
    expect(unbooked.container.textContent).not.toMatch(/Invited/i);
    cleanup();

    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/applications/mine')) {
        return new Response(
          JSON.stringify([
            {
              id: 'app-booked',
              job_id: 'job-1',
              candidate_id: 'cand-1',
              status: 'Interviewing',
              created_at: '2026-01-02T00:00:00Z',
              interview_slot_id: 'slot-booked',
              match_score: 100,
              job: { id: 'job-1', title: 'Backend Engineer', company_name: 'Acme' },
              candidate: { id: 'cand-1', display_name: 'Alice Tan', skills: ['python'] },
              interview_slot: {
                id: 'slot-booked',
                employer_id: 'emp-1',
                start_time: '2027-06-01T10:00:00Z',
                end_time: '2027-06-01T10:30:00Z',
                is_booked: true,
              },
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { container, findByText } = render(
        <AuthContext.Provider value={staticAuth(candUser)}>
          <MemoryRouter initialEntries={['/candidate/applications/app-booked/book']}>
            <Routes>
              <Route path="/candidate/applications/:applicationId/book" element={<CandidateBookInterviewPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      await findByText(/You already have an interview booked/i);
      expect(container.textContent).not.toMatch(/\bInvited\b/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-17 (FUNC-02 / FP-CAN-2, CandidateOverviewPage.tsx:74,182 / CandidateJobsView.tsx:40,125-133): Candidate dashboard lists all active jobs with required skills and "View" opens the clicked job', async () => {
    const jobs = [
      {
        id: 'job-1',
        employer_id: 'emp-1',
        company_name: 'Acme',
        company_description: '',
        title: 'Job One',
        description: 'First job full description',
        required_skills: ['python'],
        tags: ['Remote'],
        created_at: '2026-01-04T00:00:00Z',
        match_score: 100,
        has_applied: false,
      },
      {
        id: 'job-2',
        employer_id: 'emp-1',
        company_name: 'Beta',
        company_description: '',
        title: 'Job Two',
        description: 'Second job full description',
        required_skills: ['sql'],
        tags: ['Hybrid'],
        created_at: '2026-01-03T00:00:00Z',
        match_score: 90,
        has_applied: false,
      },
      {
        id: 'job-3',
        employer_id: 'emp-1',
        company_name: 'Gamma',
        company_description: '',
        title: 'Job Three',
        description: 'Third job full description',
        required_skills: ['go'],
        tags: [],
        created_at: '2026-01-02T00:00:00Z',
        match_score: 80,
        has_applied: false,
      },
      {
        id: 'job-4',
        employer_id: 'emp-1',
        company_name: 'Delta',
        company_description: '',
        title: 'Job Four',
        description: 'Fourth job full description',
        required_skills: ['rust'],
        tags: [],
        created_at: '2026-01-01T00:00:00Z',
        match_score: 50,
        has_applied: false,
      },
    ];

    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/jobs')) {
        return new Response(JSON.stringify(jobs), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/api/applications/mine')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/api/candidates/me/profile')) {
        return new Response(
          JSON.stringify({ user_id: 'cand-1', display_name: 'Alice Tan', skills: ['python'], resume_text: '' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { container, findByText, getAllByRole } = render(
        <ToastProvider>
          <AuthContext.Provider value={staticAuth(candUser)}>
            <MemoryRouter initialEntries={['/candidate']}>
              <Routes>
                <Route path="/candidate" element={<CandidateOverviewPage />} />
                <Route path="/candidate/jobs" element={<CandidateJobsView />} />
              </Routes>
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>,
      );

      await findByText('Job One');
      // All active jobs (not sliced to 3) and their required skills must be shown
      expect(container.textContent).toContain('Job Four');
      expect(container.textContent).toContain('sql');

      // Clicking View on the 2nd job must open Job Two's details, not Job One's
      const viewLinks = getAllByRole('link', { name: /^View$/i });
      fireEvent.click(viewLinks[1]);

      expect(await findByText('Second job full description')).toBeTruthy();
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-18a (V-FUNC-5 / FP-SCHED-1, EmployerAvailabilityPage.tsx:168-176): 409 SLOT_BOOKED on delete reloads slots so the booked slot is no longer shown as "Available"', async () => {
    let listCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/employers/me/availability') && (!init?.method || init.method === 'GET')) {
        listCalls += 1;
        const slots =
          listCalls === 1
            ? [
                {
                  id: 'slot-1',
                  employer_id: 'emp-1',
                  start_time: '2027-06-01T10:00:00Z',
                  end_time: '2027-06-01T10:30:00Z',
                  is_booked: false,
                  booking: null,
                },
              ]
            : [
                {
                  id: 'slot-1',
                  employer_id: 'emp-1',
                  start_time: '2027-06-01T10:00:00Z',
                  end_time: '2027-06-01T10:30:00Z',
                  is_booked: true,
                  booking: {
                    application_id: 'app-1',
                    job_id: 'job-1',
                    job_title: 'Data Analyst',
                    candidate_id: 'cand-1',
                    candidate_display_name: 'Alice Tan',
                  },
                },
              ];
        return new Response(JSON.stringify(slots), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/api/employers/me/availability/slot-1') && init?.method === 'DELETE') {
        return new Response(
          JSON.stringify({ error: { code: 'SLOT_BOOKED', message: 'Slot is booked and cannot be deleted' } }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { container, findByText, getAllByRole, getByRole } = render(
        <ToastProvider>
          <AuthContext.Provider value={staticAuth(empUser)}>
            <MemoryRouter>
              <EmployerAvailabilityPage />
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>,
      );

      await findByText('Available');
      fireEvent.click(getByRole('button', { name: 'Delete' }));
      const confirmDeleteBtn = getAllByRole('button', { name: 'Delete' }).at(-1)!;
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(listCalls).toBe(2);
      });

      expect(container.textContent).toContain('Booked by Alice Tan (Data Analyst)');
      expect(container.textContent).not.toContain('Available');
      const refreshedDeleteBtn = getByRole('button', { name: 'Delete' }) as HTMLButtonElement;
      expect(refreshedDeleteBtn.disabled).toBe(true);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-18b (V-FUNC-5 / FP-SCHED-2, CandidateBookInterviewPage.tsx:104-112): 409 SLOT_IN_PAST reloads slots, keeps the error visible, and clears stale selectedSlotId', async () => {
    let availableCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/applications/mine')) {
        return new Response(
          JSON.stringify([
            {
              id: 'app-1',
              job_id: 'job-1',
              candidate_id: 'cand-1',
              status: 'Interviewing',
              created_at: '2026-01-02T00:00:00Z',
              interview_slot_id: null,
              match_score: 100,
              job: { id: 'job-1', title: 'Data Analyst', company_name: 'Acme' },
              candidate: { id: 'cand-1', display_name: 'Alice Tan', skills: ['python'] },
              interview_slot: null,
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/applications/app-1/available-slots')) {
        availableCalls += 1;
        const slots =
          availableCalls === 1
            ? [
                { id: 'slot-past', employer_id: 'emp-1', start_time: '2027-06-01T10:00:00Z', end_time: '2027-06-01T10:30:00Z', is_booked: false },
                { id: 'slot-next', employer_id: 'emp-1', start_time: '2027-06-01T11:00:00Z', end_time: '2027-06-01T11:30:00Z', is_booked: false },
              ]
            : [
                { id: 'slot-next', employer_id: 'emp-1', start_time: '2027-06-01T11:00:00Z', end_time: '2027-06-01T11:30:00Z', is_booked: false },
              ];
        return new Response(JSON.stringify(slots), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/api/applications/app-1/book') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ error: { code: 'SLOT_IN_PAST', message: 'Slot is in the past' } }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { container, findByRole } = render(
        <AuthContext.Provider value={staticAuth(candUser)}>
          <MemoryRouter initialEntries={['/candidate/applications/app-1/book']}>
            <Routes>
              <Route path="/candidate/applications/:applicationId/book" element={<CandidateBookInterviewPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      const confirmBtn = (await findByRole('button', { name: /Confirm booking/i })) as HTMLButtonElement;
      const radios = Array.from(container.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
      fireEvent.click(radios[0]);
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(availableCalls).toBe(2);
      });

      const refreshedConfirmBtn = (await findByRole('button', { name: /Confirm booking/i })) as HTMLButtonElement;
      expect(container.textContent).toMatch(/passed|in the past|pick another/i);
      expect(refreshedConfirmBtn.disabled).toBe(true);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-18c (V-FUNC-5 / FP-EMP-2, EmployerDashboardPage.tsx:76-82): 409 JOB_HAS_DEPENDENTS reloads jobs so applicant_count and Delete button reflect server state', async () => {
    let listCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/jobs/mine') && (!init?.method || init.method === 'GET')) {
        listCalls += 1;
        const jobs = [
          {
            id: 'job-1',
            employer_id: 'emp-1',
            company_name: 'Acme',
            company_description: '',
            title: 'Backend Engineer',
            description: 'Build services',
            required_skills: ['python'],
            tags: [],
            created_at: '2026-01-01T00:00:00Z',
            applicant_count: listCalls === 1 ? 0 : 1,
          },
        ];
        return new Response(JSON.stringify(jobs), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith('/api/jobs/job-1') && init?.method === 'DELETE') {
        return new Response(
          JSON.stringify({ error: { code: 'JOB_HAS_DEPENDENTS', message: 'Cannot delete a job that has applications' } }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { container, findByText, getAllByRole, getByRole } = render(
        <ToastProvider>
          <AuthContext.Provider value={staticAuth(empUser)}>
            <MemoryRouter>
              <EmployerDashboardPage />
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>,
      );

      await findByText('0 applicants');
      fireEvent.click(getByRole('button', { name: 'Delete' }));
      const confirmDeleteBtn = getAllByRole('button', { name: 'Delete' }).at(-1)!;
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(listCalls).toBe(2);
      });

      expect(container.textContent).toContain('1 applicant');
      const refreshedDeleteBtn = getByRole('button', { name: 'Delete' }) as HTMLButtonElement;
      expect(refreshedDeleteBtn.disabled).toBe(true);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('BUG-FE-18d (V-FUNC-5 / FP-CAN-3, CandidateJobsView.tsx:149-160): 409 ALREADY_APPLIED reconciles UI to applied state instead of leaving Apply clickable', async () => {
    let jobsCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/jobs') && (!init?.method || init.method === 'GET')) {
        jobsCalls += 1;
        return new Response(
          JSON.stringify([
            {
              id: 'job-1',
              employer_id: 'emp-1',
              company_name: 'Acme',
              company_description: '',
              title: 'Data Analyst',
              description: 'Analyze data',
              required_skills: ['python'],
              tags: [],
              created_at: '2026-01-01T00:00:00Z',
              match_score: 100,
              has_applied: jobsCalls > 1,
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/candidates/me/profile')) {
        return new Response(
          JSON.stringify({ user_id: 'cand-1', display_name: 'Alice Tan', skills: ['python'], resume_text: '' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/jobs/job-1/applications') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ error: { code: 'ALREADY_APPLIED', message: 'You have already applied to this job' } }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { findByRole, findByText, queryByRole } = render(
        <ToastProvider>
          <AuthContext.Provider value={staticAuth(candUser)}>
            <MemoryRouter initialEntries={['/candidate/jobs']}>
              <CandidateJobsView />
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>,
      );

      const applyBtn = await findByRole('button', { name: /Apply for this role/i });
      fireEvent.click(applyBtn);

      // Wait for the 409 ALREADY_APPLIED response to settle before checking reconciled UI state
      await findByText(/already applied/i);

      await waitFor(() => {
        const stillApply = queryByRole('button', { name: /Apply for this role/i }) as HTMLButtonElement | null;
        expect(stillApply === null || stillApply.disabled).toBe(true);
      });
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

describe('Open Bug Regressions — Backend (Owner: William)', () => {
  it('BUG-BE-1 (scheduling/service.ts): POST /api/employers/me/availability rejects duplicate identical slots for the same employer', async () => {
    const db = new FakePrisma();
    const api = startServer(db);
    const empId = db.addUser({ role: 'Employer', email: 'hr@dup-slot.test' });
    const token = tokenFor(empId, 'Employer');
    const slot = {
      start_time: '2027-05-01T10:00:00Z',
      end_time: '2027-05-01T10:30:00Z',
    };

    const first = await api.request('POST', '/employers/me/availability', {
      token,
      body: slot,
    });
    expect(first.status).toBe(201);

    const duplicate = await api.request('POST', '/employers/me/availability', {
      token,
      body: slot,
    });
    expect(duplicate.status).toBe(409);
  });

  it('BUG-BE-2 (profiles/service.ts): PUT /api/candidates/me/profile with a stale JWT for a deleted/re-seeded user returns 401 UNAUTHORIZED (not 500 INTERNAL)', async () => {
    const db = new FakePrisma();
    const api = startServer(db);
    const ghostToken = tokenFor('00000000-0000-4000-8000-999999999999', 'Candidate');
    const res = await api.request('PUT', '/candidates/me/profile', {
      token: ghostToken,
      body: { display_name: 'Ghost', skills: ['python'], resume_text: '' },
    });
    expect(res.status).toBe(401);
  });

  it('BUG-BE-3 (lib/skills.ts): skillsSchema trims whitespace and deduplicates before checking max length/count, matching tagsSchema and specs/002', () => {
    const padded50Skill = '  ' + 'a'.repeat(50) + '  ';
    const dup51Skills = [...Array.from({ length: 49 }, (_, i) => `skill-${i}`), 'python', 'PYTHON'];

    expect(skillsSchema.safeParse([padded50Skill]).success).toBe(true);
    expect(skillsSchema.safeParse(dup51Skills).success).toBe(true);
    expect(tagsSchema.safeParse(['  ' + 'a'.repeat(30) + '  ']).success).toBe(true);
  });

  it('BUG-BE-4 (SEC-01 / FP-AUTH-1, FP-AUTH-2, auth/service.ts:45-48,108-120): POST /api/auth/login rejects bcryptjs NUL-byte repeated passwords and >72-byte suffix passwords', async () => {
    const db = new FakePrisma();
    const api = startServer(db);

    const shortReg = await api.request('POST', '/auth/register', {
      body: {
        email: 'nul-test@demo.test',
        password: 'password123',
        display_name: 'Nul Test',
        role: 'Candidate',
      },
    });
    expect(shortReg.status).toBe(201);

    const nulBypass = await api.request('POST', '/auth/login', {
      body: {
        email: 'nul-test@demo.test',
        password: 'password123\u0000password123',
      },
    });
    expect([400, 401]).toContain(nulBypass.status);
    expect(nulBypass.body).not.toHaveProperty('token');

    const exact72 = 'a'.repeat(72);
    const longReg = await api.request('POST', '/auth/register', {
      body: {
        email: 'long-test@demo.test',
        password: exact72,
        display_name: 'Long Test',
        role: 'Candidate',
      },
    });
    expect(longReg.status).toBe(201);

    const suffixBypass = await api.request('POST', '/auth/login', {
      body: {
        email: 'long-test@demo.test',
        password: exact72 + 'WRONG_SUFFIX',
      },
    });
    expect([400, 401]).toContain(suffixBypass.status);
    expect(suffixBypass.body).not.toHaveProperty('token');
  });

  it('BUG-BE-5 (SEC-03 / FP-AUTH-3, routes/auth.ts:7): authRouter passes deps.prisma to requireAuth so deleted-user and stale-role JWTs receive 401 on /api/auth/logout and /api/me', async () => {
    const db = new FakePrisma();
    const api = startServer(db);

    const ghostToken = tokenFor('00000000-0000-4000-8000-999999999999', 'Candidate');
    const ghostLogout = await api.request('POST', '/auth/logout', { token: ghostToken });
    expect(ghostLogout.status).toBe(401);

    const candId = db.addUser({ role: 'Candidate', email: 'stale-role@demo.test' });
    const staleRoleToken = tokenFor(candId, 'Employer');
    const staleMe = await api.request('GET', '/me', { token: staleRoleToken });
    const staleLogout = await api.request('POST', '/auth/logout', { token: staleRoleToken });
    expect(staleMe.status).toBe(401);
    expect(staleLogout.status).toBe(401);
  });

  it('BUG-BE-6 (ENV-01 / FP-ARCH-1, FP-SUB-1, backend/prisma.config.ts:11): prisma.config.ts loads cleanly when DATABASE_URL is unset so postinstall (prisma generate) succeeds on clean checkout', async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    vi.resetModules();
    try {
      const mod = await import('../../../backend/prisma.config');
      expect(mod.default).toBeDefined();
    } finally {
      if (saved !== undefined) {
        process.env.DATABASE_URL = saved;
      }
    }
  });

  it('BUG-BE-7 (V-SEC-1 / +2 pt FP-AUTH-3, FP-SEC-1, scheduling/service.ts:219-231): POST /api/applications/:id/book enforces 404/403 ownership before body validation and before taking a FOR UPDATE row lock', async () => {
    const db = new FakePrisma();
    const api = startServer(db);
    const empId = db.addUser({ role: 'Employer', email: 'hr@book-order.test' });
    const aliceId = db.addUser({ role: 'Candidate', email: 'alice@book-order.test' });
    const bobId = db.addUser({ role: 'Candidate', email: 'bob@book-order.test' });
    const jobId = db.addJob(empId, { title: 'Data Analyst', requiredSkills: ['python'] });
    const slotId = db.addSlot(empId, {
      startTime: new Date('2027-06-01T10:00:00Z'),
      endTime: new Date('2027-06-01T10:30:00Z'),
    });
    const aliceAppId = db.addApplication(jobId, aliceId, 'Interviewing');
    const bobToken = tokenFor(bobId, 'Candidate');

    // Invalid body against another candidate's application must return 403, not 400
    const wrongOwnerInvalidBody = await api.request('POST', `/applications/${aliceAppId}/book`, {
      token: bobToken,
      body: {},
    });
    expect(wrongOwnerInvalidBody.status).toBe(403);
    expect(wrongOwnerInvalidBody.body?.error?.code).toBe('FORBIDDEN');

    // Invalid body against a nonexistent application must return 404, not 400
    const missingAppInvalidBody = await api.request('POST', `/applications/${MISSING_ID}/book`, {
      token: bobToken,
      body: {},
    });
    expect(missingAppInvalidBody.status).toBe(404);
    expect(missingAppInvalidBody.body?.error?.code).toBe('NOT_FOUND');

    // Valid body against another candidate's application must return 403 without locking Alice's row
    db.rawQueries.length = 0;
    const wrongOwnerValidBody = await api.request('POST', `/applications/${aliceAppId}/book`, {
      token: bobToken,
      body: { slot_id: slotId },
    });
    expect(wrongOwnerValidBody.status).toBe(403);
    const lockQueries = db.rawQueries.filter((q) => /FOR UPDATE/i.test(q.text));
    expect(lockQueries).toEqual([]);
  });

  it('BUG-BE-8 (V-SEC-2 / +2 pt, server.ts:8-21 & app.ts:44): Static/SPA middleware is mounted BEFORE errorHandler so static errors cannot bypass errorHandler into Express finalhandler', () => {
    const serverSrc = readFileSync(join(REPO_ROOT, 'backend/src/server.ts'), 'utf8');
    const appSrc = readFileSync(join(REPO_ROOT, 'backend/src/app.ts'), 'utf8');

    const serverMountsStatic = /express\.static|sendFile/.test(serverSrc);
    if (serverMountsStatic) {
      // If server.ts mounts static/SPA handlers after createApp(), it must register errorHandler after them
      const lastStaticIdx = Math.max(serverSrc.lastIndexOf('express.static'), serverSrc.lastIndexOf('sendFile'));
      const errorHandlerIdx = serverSrc.lastIndexOf('errorHandler');
      expect(
        errorHandlerIdx,
        'backend/src/server.ts mounts express.static/sendFile after createApp() without registering errorHandler afterward (allows finalhandler stack-trace disclosure)',
      ).toBeGreaterThan(lastStaticIdx);
    } else {
      // Otherwise createApp() itself mounts static/SPA middleware before app.use(errorHandler)
      const staticIdx = appSrc.indexOf('express.static');
      const errorHandlerIdx = appSrc.lastIndexOf('errorHandler');
      expect(staticIdx).toBeGreaterThan(-1);
      expect(errorHandlerIdx).toBeGreaterThan(staticIdx);
    }
  });

  it('BUG-BE-9 (V-FUNC-3 / +1 pt, auth/profiles/jobs/skills): NUL bytes (\\u0000) and lone UTF-16 surrogates (\\uD800) are rejected with 400 VALIDATION_ERROR across all text, skill, and tag inputs', async () => {
    const db = new FakePrisma();
    const api = startServer(db);
    const candId = db.addUser({ role: 'Candidate', email: 'cand@nul.test' });
    const empId = db.addUser({ role: 'Employer', email: 'emp@nul.test' });
    const candToken = tokenFor(candId, 'Candidate');
    const empToken = tokenFor(empId, 'Employer');

    const cases: Array<{ label: string; method: string; path: string; token?: string; body: unknown }> = [
      {
        label: 'register display_name with NUL',
        method: 'POST',
        path: '/auth/register',
        body: { email: 'new@nul.test', password: 'password123', display_name: 'Alice\u0000Tan', role: 'Candidate' },
      },
      {
        label: 'candidate profile display_name with NUL',
        method: 'PUT',
        path: '/candidates/me/profile',
        token: candToken,
        body: { display_name: 'Alice\u0000Tan', skills: ['python'], resume_text: 'ok' },
      },
      {
        label: 'candidate profile resume_text with NUL',
        method: 'PUT',
        path: '/candidates/me/profile',
        token: candToken,
        body: { display_name: 'Alice Tan', skills: ['python'], resume_text: 'Resume\u0000body' },
      },
      {
        label: 'candidate profile resume_text with lone surrogate',
        method: 'PUT',
        path: '/candidates/me/profile',
        token: candToken,
        body: { display_name: 'Alice Tan', skills: ['python'], resume_text: 'Resume\uD800body' },
      },
      {
        label: 'candidate profile skills with NUL',
        method: 'PUT',
        path: '/candidates/me/profile',
        token: candToken,
        body: { display_name: 'Alice Tan', skills: ['py\u0000thon'], resume_text: 'ok' },
      },
      {
        label: 'employer profile company_name with NUL',
        method: 'PUT',
        path: '/employers/me/profile',
        token: empToken,
        body: { company_name: 'Acme\u0000Corp', description: 'ok' },
      },
      {
        label: 'employer profile description with NUL',
        method: 'PUT',
        path: '/employers/me/profile',
        token: empToken,
        body: { company_name: 'Acme Corp', description: 'Desc\u0000text' },
      },
      {
        label: 'create job title with NUL',
        method: 'POST',
        path: '/jobs',
        token: empToken,
        body: { title: 'Eng\u0000Role', description: 'Valid', required_skills: ['python'], tags: [] },
      },
      {
        label: 'create job description with NUL',
        method: 'POST',
        path: '/jobs',
        token: empToken,
        body: { title: 'Valid Role', description: 'Desc\u0000body', required_skills: ['python'], tags: [] },
      },
      {
        label: 'create job required_skills with NUL',
        method: 'POST',
        path: '/jobs',
        token: empToken,
        body: { title: 'Valid Role', description: 'Valid', required_skills: ['sql\u0000'], tags: [] },
      },
      {
        label: 'create job tags with NUL',
        method: 'POST',
        path: '/jobs',
        token: empToken,
        body: { title: 'Valid Role', description: 'Valid', required_skills: [], tags: ['Remote\u0000'] },
      },
    ];

    for (const c of cases) {
      const res = await api.request(c.method, c.path, { token: c.token, body: c.body });
      expect(res.status, `${c.label} should return 400 VALIDATION_ERROR`).toBe(400);
      expect(res.body?.error?.code, `${c.label} error code`).toBe('VALIDATION_ERROR');
    }
  });

  it('BUG-BE-10 (V-FUNC-4 / +1 pt, lib/errors.ts:55-60): Malformed percent-encoding in route parameters returns 400 BAD_REQUEST (or 404), never 500 INTERNAL', async () => {
    const db = new FakePrisma();
    const api = startServer(db);
    const empId = db.addUser({ role: 'Employer', email: 'emp@uri.test' });
    const empToken = tokenFor(empId, 'Employer');

    const badJobRes = await api.request('GET', '/jobs/%FF', { token: empToken });
    expect([400, 404]).toContain(badJobRes.status);
    expect(badJobRes.body?.error?.code).not.toBe('INTERNAL');

    const badSlotRes = await api.request('DELETE', '/employers/me/availability/%E0%A4%A', { token: empToken });
    expect([400, 404]).toContain(badSlotRes.status);
    expect(badSlotRes.body?.error?.code).not.toBe('INTERNAL');
  });

  it('BUG-BE-11 (V-FUNC-6 / +1 pt, auth/service.ts:28-32): Registration rejects emails exceeding RFC 5321 max length (254 chars) with 400 VALIDATION_ERROR', async () => {
    const db = new FakePrisma();
    const api = startServer(db);

    const overRfcEmail = 'a'.repeat(290) + '@demo.test';
    const res = await api.request('POST', '/auth/register', {
      body: {
        email: overRfcEmail,
        password: 'password123',
        display_name: 'Long Email User',
        role: 'Candidate',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe('VALIDATION_ERROR');
  });
});

describe('Open Bug Regressions — Shared / Submission Gates (Owner: Everyone)', () => {
  it('BUG-SH-1 (V-FUNC-1 / FP-SUB-1 Blocker): Root Dockerfile and .dockerignore exist, and .dockerignore excludes local .env files and node_modules', () => {
    const dockerfilePath = join(REPO_ROOT, 'Dockerfile');
    const dockerignorePath = join(REPO_ROOT, '.dockerignore');

    expect(existsSync(dockerfilePath), 'Root Dockerfile is missing (FP-SUB-1 blocker)').toBe(true);
    expect(existsSync(dockerignorePath), 'Root .dockerignore is missing (risks baking local .env secrets into image)').toBe(true);

    const ignoreText = readFileSync(dockerignorePath, 'utf8');
    expect(ignoreText).toMatch(/(^|\n)\s*(\*\*\/)?\.env(\*|\.\*)?\s*($|\n)/);
    expect(ignoreText).toMatch(/node_modules/);
  });

  it('BUG-SH-2 (V-FUNC-2 / FP-SUB-1 & PEER_REVIEW Blocker): .github/ISSUE_TEMPLATE/audit_bug_report.yml and at least one GitHub Actions workflow exist', () => {
    const issueTemplatePath = join(REPO_ROOT, '.github/ISSUE_TEMPLATE/audit_bug_report.yml');
    const workflowsDir = join(REPO_ROOT, '.github/workflows');

    expect(existsSync(issueTemplatePath), '.github/ISSUE_TEMPLATE/audit_bug_report.yml is missing (PEER_REVIEW.md §2)').toBe(true);
    expect(existsSync(workflowsDir), '.github/workflows/ is missing (FP-SUB-1 required CI checks)').toBe(true);

    const workflowFiles = readdirSync(workflowsDir).filter((f) => /\.ya?ml$/i.test(f));
    expect(workflowFiles.length).toBeGreaterThan(0);
  });
});
