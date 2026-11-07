// @vitest-environment jsdom
/**
 * Frontend component workflow integration tests.
 *
 * Requirement IDs: FP-CAN-2, FP-CAN-3, FP-EMP-2, FP-EMP-3, FP-SCHED-2, FP-SCHED-3
 *
 * Mounts the real React pages in `frontend/src/pages/` and components in `frontend/src/components/`
 * against mocked `/api` responses to verify end-to-end UI interactions, error recovery, and
 * confirmation dialogs.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../../../frontend/src/context/auth-context';
import { ToastProvider } from '../../../frontend/src/context/ToastContext';
import CandidateBookInterviewPage from '../../../frontend/src/pages/CandidateBookInterviewPage';
import CandidateJobsView from '../../../frontend/src/pages/CandidateJobsView';
import EmployerDashboardPage from '../../../frontend/src/pages/EmployerDashboardPage';
import EmployerApplicantsPage from '../../../frontend/src/pages/EmployerApplicantsPage';
import SkillsField from '../../../frontend/src/components/SkillsField';
import TagsField from '../../../frontend/src/components/TagsField';

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

describe('Frontend UI workflows (FP-CAN-2, FP-CAN-3, FP-EMP-2, FP-EMP-3, FP-SCHED-2, FP-SCHED-3)', () => {
  it('FP-SCHED-3 UI: CandidateBookInterviewPage handles a 409 SLOT_TAKEN race by showing the friendly message and reloading remaining slots', async () => {
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
        // First load shows slot-1 and slot-2; after losing the race for slot-1, reload shows only slot-2
        const slots =
          availableSlotsCalls === 1
            ? [
                {
                  id: 'slot-1',
                  employer_id: 'emp-1',
                  start_time: '2027-06-01T10:00:00Z',
                  end_time: '2027-06-01T10:30:00Z',
                  is_booked: false,
                },
                {
                  id: 'slot-2',
                  employer_id: 'emp-1',
                  start_time: '2027-06-01T11:00:00Z',
                  end_time: '2027-06-01T11:30:00Z',
                  is_booked: false,
                },
              ]
            : [
                {
                  id: 'slot-2',
                  employer_id: 'emp-1',
                  start_time: '2027-06-01T11:00:00Z',
                  end_time: '2027-06-01T11:30:00Z',
                  is_booked: false,
                },
              ];
        return new Response(JSON.stringify(slots), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/api/applications/app-race/book') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            error: { code: 'SLOT_TAKEN', message: 'Slot already booked' },
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { container, findByRole } = render(
        <AuthContext.Provider
          value={{
            user: candUser,
            isLoading: false,
            login: async () => {},
            register: async () => {},
            logout: async () => {},
            previewAs: () => {},
          }}
        >
          <MemoryRouter initialEntries={['/candidate/applications/app-race/book']}>
            <Routes>
              <Route path="/candidate/applications/:applicationId/book" element={<CandidateBookInterviewPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      const confirmBtn = await findByRole('button', { name: /Confirm booking/i });
      const radios = Array.from(container.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
      expect(radios.length).toBe(2);

      // Select slot-1 and click Confirm booking
      fireEvent.click(radios[0]);
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(availableSlotsCalls).toBe(2);
      });

      const remainingRadios = Array.from(container.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
      expect(remainingRadios.length).toBe(1);
      expect(remainingRadios[0].value).toBe('slot-2');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('FP-CAN-2 & FP-CAN-3 UI: CandidateJobsView filters jobs by search query and disables Apply button after applying', async () => {
    let applyCalledFor: string | null = null;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/jobs')) {
        return new Response(
          JSON.stringify([
            {
              id: 'job-1',
              employer_id: 'emp-1',
              company_name: 'Acme Corp',
              company_description: 'Desc',
              title: 'Senior Python Developer',
              description: 'Build APIs',
              required_skills: ['python', 'sql'],
              tags: ['Remote', 'Full-time'],
              created_at: '2026-01-01T00:00:00Z',
              match_score: 100,
              has_applied: false,
            },
            {
              id: 'job-2',
              employer_id: 'emp-1',
              company_name: 'Beta Systems',
              company_description: 'Desc',
              title: 'Frontend Designer',
              description: 'Figma & CSS',
              required_skills: ['figma'],
              tags: ['Internship'],
              created_at: '2026-01-02T00:00:00Z',
              match_score: 0,
              has_applied: false,
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/candidates/me/profile')) {
        return new Response(
          JSON.stringify({
            user_id: 'cand-1',
            display_name: 'Alice Tan',
            skills: ['python', 'sql'],
            resume_text: '',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/jobs/job-1/applications') && init?.method === 'POST') {
        applyCalledFor = 'job-1';
        return new Response(
          JSON.stringify({
            id: 'app-new',
            job_id: 'job-1',
            candidate_id: 'cand-1',
            status: 'Pending',
            created_at: '2026-01-03T00:00:00Z',
            interview_slot_id: null,
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { findAllByText, findByText, getByLabelText, getByRole, queryByText } = render(
        <ToastProvider>
          <AuthContext.Provider
            value={{
              user: candUser,
              isLoading: false,
              login: async () => {},
              register: async () => {},
              logout: async () => {},
              previewAs: () => {},
            }}
          >
            <MemoryRouter>
              <CandidateJobsView />
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>,
      );

      await findAllByText('Senior Python Developer');
      expect(queryByText('Frontend Designer')).not.toBeNull();

      // Filter by search query
      fireEvent.change(getByLabelText('Search jobs'), { target: { value: 'Python' } });
      expect(queryByText('Frontend Designer')).toBeNull();

      // Apply to Senior Python Developer
      const applyBtn = getByRole('button', { name: /Apply for this role/i });
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(applyCalledFor).toBe('job-1');
      });

      const appliedBtn = await findByText('Already applied');
      expect((appliedBtn as HTMLButtonElement).disabled).toBe(true);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('FP-EMP-2 UI: EmployerDashboardPage disables Delete button when applicant_count > 0 and requires confirmation when applicant_count === 0', async () => {
    let deletedJobId: string | null = null;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/jobs/mine')) {
        return new Response(
          JSON.stringify([
            {
              id: 'job-with-apps',
              employer_id: 'emp-1',
              company_name: 'Acme',
              company_description: '',
              title: 'Busy Role',
              description: 'Has applicants',
              required_skills: ['python'],
              tags: [],
              created_at: '2026-01-02T00:00:00Z',
              applicant_count: 2,
            },
            {
              id: 'job-empty',
              employer_id: 'emp-1',
              company_name: 'Acme',
              company_description: '',
              title: 'Empty Role',
              description: 'Zero applicants',
              required_skills: [],
              tags: [],
              created_at: '2026-01-01T00:00:00Z',
              applicant_count: 0,
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/jobs/job-empty') && init?.method === 'DELETE') {
        deletedJobId = 'job-empty';
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { container, findByText, getByRole } = render(
        <ToastProvider>
          <AuthContext.Provider
            value={{
              user: empUser,
              isLoading: false,
              login: async () => {},
              register: async () => {},
              logout: async () => {},
              previewAs: () => {},
            }}
          >
            <MemoryRouter>
              <EmployerDashboardPage />
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>,
      );

      await findByText('Busy Role');
      const deleteButtons = Array.from(container.querySelectorAll('button')).filter(
        (b) => b.textContent === 'Delete',
      ) as HTMLButtonElement[];
      expect(deleteButtons.length).toBe(2);
      // First job has applicant_count: 2 -> Delete button disabled
      expect(deleteButtons[0].disabled).toBe(true);
      // Second job has applicant_count: 0 -> Delete button enabled
      expect(deleteButtons[1].disabled).toBe(false);

      fireEvent.click(deleteButtons[1]);
      // Confirmation dialog opens
      await findByText('Delete job posting?');
      const dialogConfirm = getByRole('alertdialog').querySelectorAll('button')[1];
      fireEvent.click(dialogConfirm);

      await waitFor(() => {
        expect(deletedJobId).toBe('job-empty');
      });
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('FP-EMP-3 UI: EmployerApplicantsPage prompts for confirmation before setting Accepted/Rejected status', async () => {
    let statusUpdatePayload: { status: string } | null = null;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/jobs/job-1')) {
        return new Response(
          JSON.stringify({
            id: 'job-1',
            employer_id: 'emp-1',
            company_name: 'Acme',
            company_description: '',
            title: 'Backend Engineer',
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
      if (url.endsWith('/api/applications/app-1/status') && init?.method === 'PUT') {
        statusUpdatePayload = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            id: 'app-1',
            job_id: 'job-1',
            candidate_id: 'cand-1',
            status: statusUpdatePayload!.status,
            created_at: '2026-01-02T00:00:00Z',
            interview_slot_id: null,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const { findByText, getByLabelText, getByRole } = render(
        <ToastProvider>
          <AuthContext.Provider
            value={{
              user: empUser,
              isLoading: false,
              login: async () => {},
              register: async () => {},
              logout: async () => {},
              previewAs: () => {},
            }}
          >
            <MemoryRouter initialEntries={['/employer/jobs/job-1/applicants']}>
              <Routes>
                <Route path="/employer/jobs/:jobId/applicants" element={<EmployerApplicantsPage />} />
              </Routes>
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>,
      );

      await findByText('Alice Tan');
      const select = getByLabelText('Update status') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'Accepted' } });

      // Should open ConfirmDialog before sending PUT
      await findByText('Change applicant status?');
      expect(statusUpdatePayload).toBeNull();

      fireEvent.click(getByRole('button', { name: 'OK' }));
      await waitFor(() => {
        expect(statusUpdatePayload).toEqual({ status: 'Accepted' });
      });
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SkillsField and TagsField deduplicate case-insensitively and trim whitespace on Enter or comma', () => {
    const skills: string[] = [];
    const tags: string[] = [];
    const { getByPlaceholderText } = render(
      <div>
        <SkillsField skills={skills} onChange={(next) => skills.splice(0, skills.length, ...next)} />
        <TagsField tags={tags} onChange={(next) => tags.splice(0, tags.length, ...next)} />
      </div>,
    );

    const skillInput = getByPlaceholderText('e.g. Python');
    fireEvent.change(skillInput, { target: { value: '  Python  ' } });
    fireEvent.keyDown(skillInput, { key: 'Enter' });
    expect(skills).toEqual(['Python']);

    // Duplicate in different case is ignored
    fireEvent.change(skillInput, { target: { value: 'python' } });
    fireEvent.keyDown(skillInput, { key: ',' });
    expect(skills).toEqual(['Python']);

    const tagInput = getByPlaceholderText('e.g. Remote');
    fireEvent.change(tagInput, { target: { value: ' Remote ' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    expect(tags).toEqual(['Remote']);
  });
});
