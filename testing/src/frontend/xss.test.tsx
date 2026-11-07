// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import JobDetailDialog from '../../../frontend/src/components/JobDetailDialog';
import JobDetailPanel from '../../../frontend/src/components/jobs/JobDetailPanel';
import JobListingCard from '../../../frontend/src/components/jobs/JobListingCard';
import { AuthContext } from '../../../frontend/src/context/auth-context';
import { ToastProvider } from '../../../frontend/src/context/ToastContext';
import EmployerApplicantsPage from '../../../frontend/src/pages/EmployerApplicantsPage';
import type { ScoredJob } from '../../../frontend/src/types';

/**
 * FP-SEC-3. User-controlled text (profile, resume, company, job) must be rendered as text, never
 * as markup. The frontend relies on React's default JSX escaping (SPEC.md §8), so these tests
 * render the team's REAL components with hostile values and inspect the resulting DOM.
 */
const XSS = '<script>alert(1)</script>';
const IMG = '<img src=x onerror=alert(1)>';
const SVG = '<svg onload=alert(1)>';
const ATTR = '"><script>alert(1)</script>';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function expectInert(root: HTMLElement) {
  // no executable element was created from the text
  expect(document.querySelector('script')).toBeNull();
  expect(root.querySelector('script')).toBeNull();
  expect(root.querySelector('img')).toBeNull();
  // and no element carries an inline event handler
  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const name of el.getAttributeNames()) {
      expect(name.startsWith('on'), `<${el.tagName.toLowerCase()} ${name}>`).toBe(false);
    }
  }
}

/** The element tags of a rendered tree, in document order (the DOM "shape"). */
const shapeOf = (root: HTMLElement) => Array.from(root.querySelectorAll('*')).map((el) => el.tagName);

/**
 * Hostile text must never change the DOM structure: rendering the component with the payload
 * has to yield exactly the same elements (same tags, same order) as rendering it with harmless
 * text. If the payload were parsed as HTML, extra elements (<script>, <img>, <svg>, <b> ...)
 * would appear and the shapes would differ. Returns the hostile render for further assertions.
 */
function renderAndCompareShape(ui: (text: string) => React.ReactElement, hostile: string) {
  const benign = render(ui('harmless text'));
  const benignShape = shapeOf(benign.container);
  cleanup();
  const result = render(ui(hostile));
  expect(shapeOf(result.container)).toEqual(benignShape);
  return result;
}

const hostileJob = (hostile: string): ScoredJob =>
  ({
    id: 'job-1',
    employer_id: 'emp-1',
    company_name: `Acme ${hostile}`,
    company_description: `About us ${hostile}`,
    title: `Dev ${hostile}`,
    description: `Role text ${hostile}`,
    required_skills: [`skill${hostile}`],
    tags: [`Remote${hostile}`],
    created_at: '2026-01-01T00:00:00Z',
    match_score: 50,
    has_applied: false,
  }) as ScoredJob;

const noop = () => {};

describe('FP-SEC-3 the exact required payload <script>alert(1)</script>', () => {
  it('JobDetailPanel shows the payload as visible text, not as a <script> element', () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    const { container } = renderAndCompareShape(
      (t) => <JobDetailPanel job={hostileJob(t)} candidateSkills={[]} isApplying={false} applyError={t} isSaved={false} onApply={noop} onToggleSave={noop} />,
      XSS,
    );
    expectInert(container);
    expect(container.textContent).toContain(XSS); // displayed literally
    expect(container.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;'); // escaped in the markup
    expect(container.innerHTML).not.toContain('<script>');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('JobListingCard escapes the title, company, description, tags and skills', () => {
    const { container } = renderAndCompareShape(
      (t) => <JobListingCard job={hostileJob(t)} candidateSkills={[]} isApplying={false} isSaved={false} onViewDetails={noop} onApply={noop} onToggleSave={noop} />,
      XSS,
    );
    expectInert(container);
    expect(container.textContent).toContain(`Dev ${XSS}`);
    expect(container.textContent).toContain(`Acme ${XSS}`);
    expect(container.innerHTML).not.toContain('<script>');
  });

  it('JobDetailDialog escapes every user-controlled field', () => {
    const { container } = renderAndCompareShape(
      (t) => <JobDetailDialog job={hostileJob(t)} candidateSkills={[]} isApplying={false} applyError={null} isSaved={false} onClose={noop} onApply={noop} onToggleSave={noop} />,
      XSS,
    );
    expectInert(container);
    expect(container.textContent).toContain(`Role text ${XSS}`);
    expect(container.textContent).toContain(`About us ${XSS}`);
  });
});

describe('FP-SEC-3 other injection shapes stay inert', () => {
  it.each([
    ['an <img onerror> payload', IMG],
    ['an <svg onload> payload', SVG],
    ['an attribute-breaking payload', ATTR],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['an HTML entity payload', '&lt;b&gt;bold&lt;/b&gt; <b>bold</b>'],
  ])('JobDetailPanel renders %s as plain text', (_n, hostile) => {
    const { container } = renderAndCompareShape(
      (t) => <JobDetailPanel job={hostileJob(t)} candidateSkills={[]} isApplying={false} applyError={null} isSaved={false} onApply={noop} onToggleSave={noop} />,
      hostile,
    );
    expectInert(container);
    expect(container.textContent).toContain(`Role text ${hostile}`);
  });

  it('does not double-escape: the user sees exactly the characters they typed', () => {
    const typed = 'Fish & Chips <3 "quoted" \'single\'';
    const { container } = render(
      <JobListingCard job={hostileJob(typed)} candidateSkills={[]} isApplying={false} isSaved={false} onViewDetails={noop} onApply={noop} onToggleSave={noop} />,
    );
    expect(container.textContent).toContain(`Dev ${typed}`);
    expect(container.textContent).not.toContain('&amp;');
    expect(container.textContent).not.toContain('&lt;');
  });
});

describe('FP-SEC-3 the detector itself works (canary)', () => {
  it('flags a component that injects user text as raw HTML, so a regression in the real ones would fail', () => {
    const Unsafe = ({ t }: { t: string }) => <div dangerouslySetInnerHTML={{ __html: t }} />;
    const benign = render(<Unsafe t="harmless text" />);
    const benignShape = shapeOf(benign.container);
    cleanup();
    const { container } = render(<Unsafe t={XSS} />);
    expect(container.querySelector('script')).not.toBeNull(); // markup WAS created
    expect(shapeOf(container)).not.toEqual(benignShape); // and the shape comparison would catch it
  });
});

describe('FP-SEC-3 EmployerApplicantsPage renders candidate-controlled text from the API', () => {
  beforeEach(() => {
    const job = { ...hostileJob(XSS), applicant_count: 1 };
    const applicant = {
      id: 'app-1',
      job_id: 'job-1',
      candidate_id: 'cand-1',
      status: 'Pending',
      created_at: '2026-02-02T10:00:00Z',
      interview_slot_id: null,
      match_score: 50,
      job: { id: 'job-1', title: job.title, company_name: job.company_name },
      candidate: { id: 'cand-1', display_name: `Mallory ${XSS}`, skills: [`python${XSS}`, IMG] },
      interview_slot: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = String(url).endsWith('/applicants') ? [applicant] : job;
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );
  });

  it('shows the hostile display name and job title as text and creates no executable markup', async () => {
    const employer = { id: 'emp-1', email: 'e@example.test', role: 'Employer' as const, display_name: 'E', created_at: '2026-01-01T00:00:00Z' };
    const auth = { user: employer, isLoading: false, login: async () => {}, register: async () => {}, logout: async () => {}, previewAs: () => {} };
    const { container } = render(
      <AuthContext.Provider value={auth}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/employer/jobs/job-1/applicants']}>
            <Routes>
              <Route path="/employer/jobs/:jobId/applicants" element={<EmployerApplicantsPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(screen.getByRole('heading', { name: /Mallory/ })).toBeTruthy());
    expectInert(container);
    expect(screen.getByRole('heading', { name: `Mallory ${XSS}` })).toBeTruthy(); // the literal text
    expect(container.textContent).toContain(`Dev ${XSS}`);
    expect(container.innerHTML).not.toContain('<script>');
  });
});
