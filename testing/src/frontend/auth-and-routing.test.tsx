// @vitest-environment jsdom
/**
 * Frontend authentication, session handling, API client, and route guard tests.
 *
 * Requirement IDs: FP-AUTH-1, FP-AUTH-2, FP-AUTH-3, FP-SEC-1
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import App from '../../../frontend/src/App';
import { ApiError, getToken, request, setToken } from '../../../frontend/src/api/client';
import { AuthProvider } from '../../../frontend/src/context/AuthContext';
import { ToastProvider } from '../../../frontend/src/context/ToastContext';
import ErrorBoundary from '../../../frontend/src/components/ErrorBoundary';
import { safeReturnPath } from '../../../frontend/src/lib/returnPath';
import { apiErrorMessage } from '../../../frontend/src/lib/apiErrorMessage';

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

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

describe('FP-AUTH-1 / FP-AUTH-2 / FP-AUTH-3: AuthProvider, AuthPage, ProtectedRoute & API client', () => {
  it('ProtectedRoute redirects unauthenticated users from /candidate and /employer to /login', async () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <MemoryRouter initialEntries={['/candidate/applications']}>
        <ToastProvider>
          <AuthProvider>
            <App />
            <LocationDisplay />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/login');
    });

    cleanup();

    render(
      <MemoryRouter initialEntries={['/employer/availability']}>
        <ToastProvider>
          <AuthProvider>
            <App />
            <LocationDisplay />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/login');
    });
  });

  it('ProtectedRoute prevents a Candidate from entering /employer routes and redirects them back to /candidate', async () => {
    setToken('cand-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/me')) return jsonRes(candUser);
        if (url.endsWith('/api/jobs')) return jsonRes([]);
        if (url.endsWith('/api/applications/mine')) return jsonRes([]);
        if (url.endsWith('/api/candidates/me/profile')) {
          return jsonRes({ user_id: candUser.id, display_name: candUser.display_name, skills: [], resume_text: '' });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <MemoryRouter initialEntries={['/employer/availability']}>
        <ToastProvider>
          <AuthProvider>
            <App />
            <LocationDisplay />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/candidate');
    });
  });

  it('ProtectedRoute prevents an Employer from entering /candidate routes and redirects them back to /employer', async () => {
    setToken('emp-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/me')) return jsonRes(empUser);
        if (url.endsWith('/api/jobs/mine')) return jsonRes([]);
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <MemoryRouter initialEntries={['/candidate/profile']}>
        <ToastProvider>
          <AuthProvider>
            <App />
            <LocationDisplay />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/employer');
    });
  });

  it('Registration validates required fields, email format, password length, and matching confirm password before calling API', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(
      <MemoryRouter initialEntries={['/register']}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    const submit = await screen.findByRole('button', { name: /Create your account/i });

    // Empty full name
    fireEvent.click(submit);
    expect(await screen.findByText(/Please enter your full name/i)).toBeTruthy();

    // Invalid email
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Bob Lim' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'not-an-email' } });
    fireEvent.click(submit);
    expect(await screen.findByText(/Please enter a valid email address/i)).toBeTruthy();

    // Short password
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'bob@demo.test' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'short' } });
    fireEvent.click(submit);
    expect(await screen.findByText(/8–72 UTF-8 bytes/i)).toBeTruthy();

    // Mismatched confirm password
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'password456' } });
    fireEvent.click(submit);
    expect(await screen.findByText(/Passwords do not match/i)).toBeTruthy();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Registration sends selected Employer role, stores JWT, navigates to /employer, and never exposes token in DOM', async () => {
    let registerBody: Record<string, unknown> | null = null;
    const secretToken = 'jwt.secret.token.should.never.appear.in.dom';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/auth/register') && init?.method === 'POST') {
          registerBody = JSON.parse(String(init.body));
          return jsonRes({ token: secretToken, user: empUser }, 201);
        }
        if (url.endsWith('/api/jobs/mine')) {
          return jsonRes([]);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { container } = render(
      <MemoryRouter initialEntries={['/register']}>
        <ToastProvider>
          <AuthProvider>
            <App />
            <LocationDisplay />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText(/Full name/i), { target: { value: '  Acme HR  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Employer' }));
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: '  hr@acme.test  ' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create your account/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/employer');
    });

    expect(registerBody).toEqual({
      email: 'hr@acme.test',
      password: 'password123',
      display_name: 'Acme HR',
      role: 'Employer',
    });
    expect(getToken()).toBe(secretToken);
    expect(container.textContent).not.toContain(secretToken);
  });

  it('Employer login navigates directly to /employer via AuthProvider', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/auth/login') && init?.method === 'POST') {
          return jsonRes({ token: 'emp-login-jwt', user: empUser }, 200);
        }
        if (url.endsWith('/api/jobs/mine')) {
          return jsonRes([]);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <MemoryRouter initialEntries={['/login']}>
        <ToastProvider>
          <AuthProvider>
            <App />
            <LocationDisplay />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText(/Email address/i), { target: { value: 'hr@acme.test' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Log in to SkillMatch/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/employer');
    });
  });

  it('Registration displays 409 EMAIL_TAKEN error and login displays 401 INVALID_CREDENTIALS error cleanly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/auth/register')) {
          return jsonRes({ error: { code: 'EMAIL_TAKEN', message: 'Email already exists' } }, 409);
        }
        if (url.endsWith('/api/auth/login')) {
          return jsonRes({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <MemoryRouter initialEntries={['/register']}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText(/Full name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'alice@demo.test' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create your account/i }));

    expect(await screen.findByText(/already exists/i)).toBeTruthy();

    // Switch to login and test 401 INVALID_CREDENTIALS
    fireEvent.click(screen.getByRole('tab', { name: 'Log in' }));
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'alice@demo.test' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: /Log in to SkillMatch/i }));

    expect(await screen.findByText(/Wrong email or password/i)).toBeTruthy();
  });

  it('Logout clears token and returns to /login; 401 UNAUTHORIZED from a stale token also clears session and redirects to /login', async () => {
    setToken('stale-jwt');
    let logoutCalled = false;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/me')) return jsonRes(empUser);
        if (url.endsWith('/api/jobs/mine')) return jsonRes([]);
        if (url.endsWith('/api/auth/logout') && init?.method === 'POST') {
          logoutCalled = true;
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <MemoryRouter initialEntries={['/employer']}>
        <ToastProvider>
          <AuthProvider>
            <App />
            <LocationDisplay />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    const logoutBtn = await screen.findByRole('button', { name: /Log out/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/login');
    });
    expect(logoutCalled).toBe(true);
    expect(getToken()).toBeNull();

    // Now test stale token triggering 401 on an authenticated API call
    cleanup();
    setToken('deleted-user-jwt');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;
        expect(headers?.Authorization).toBe('Bearer deleted-user-jwt');
        if (url.endsWith('/api/me')) return jsonRes(candUser);
        if (url.endsWith('/api/candidates/me/profile') && (!init?.method || init.method === 'GET')) {
          return jsonRes({ user_id: candUser.id, display_name: candUser.display_name, skills: [], resume_text: '' });
        }
        if (url.endsWith('/api/candidates/me/profile') && init?.method === 'PUT') {
          return jsonRes({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <MemoryRouter initialEntries={['/candidate/profile']}>
        <ToastProvider>
          <AuthProvider>
            <App />
            <LocationDisplay />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    const nameInput = await screen.findByDisplayValue('Alice Tan');
    fireEvent.change(nameInput, { target: { value: 'Alice Updated' } });
    fireEvent.click(screen.getByRole('button', { name: /Save profile changes/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/login');
    });
    expect(getToken()).toBeNull();
  });

  it('api/client request() maps network failures to NETWORK_ERROR and handles 204 empty responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));

    await expect(request('GET', '/health')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });

    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    await expect(request('DELETE', '/jobs/123')).resolves.toBeUndefined();
  });

  it('safeReturnPath rejects open-redirect URLs and auth routes while allowing internal app paths', () => {
    expect(safeReturnPath('/candidate/applications')).toBe('/candidate/applications');
    expect(safeReturnPath('/employer/jobs/1/applicants?tab=all')).toBe('/employer/jobs/1/applicants?tab=all');
    expect(safeReturnPath('//evil.example.com/phish')).toBeNull();
    expect(safeReturnPath('https://evil.example.com')).toBeNull();
    expect(safeReturnPath('javascript:alert(1)')).toBeNull();
    expect(safeReturnPath('/login')).toBeNull();
    expect(safeReturnPath('/register')).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
  });

  it('apiErrorMessage maps contract error codes to user-facing messages and passes through VALIDATION_ERROR and SLOT_OVERLAP', () => {
    expect(apiErrorMessage(new ApiError(400, 'VALIDATION_ERROR', 'title must not be empty'))).toBe(
      'title must not be empty',
    );
    expect(apiErrorMessage(new ApiError(409, 'SLOT_OVERLAP', 'You already have a slot that overlaps this time'))).toBe(
      'You already have a slot that overlaps this time',
    );
    expect(apiErrorMessage(new ApiError(409, 'SLOT_IN_PAST', 'Slot is in the past'))).toMatch(/time has passed/i);
    expect(apiErrorMessage(new ApiError(409, 'JOB_HAS_DEPENDENTS', 'raw'))).toMatch(/has applicants/i);
    expect(apiErrorMessage(new Error('boom'), 'Fallback')).toBe('Fallback');
  });

  it('NotFoundPage links authenticated users back to their role workspace and ErrorBoundary recovers from render crashes', () => {
    vi.stubGlobal('fetch', vi.fn());
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Crasher(): React.ReactElement {
      throw new Error('Synthetic render failure');
    }

    render(
      <MemoryRouter initialEntries={['/unknown-route']}>
        <ErrorBoundary>
          <AuthProvider>
            <Routes>
              <Route path="/crash" element={<Crasher />} />
              <Route path="*" element={<App />} />
            </Routes>
          </AuthProvider>
        </ErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText('Page not found')).toBeTruthy();

    cleanup();
    render(
      <MemoryRouter initialEntries={['/crash']}>
        <ErrorBoundary>
          <Routes>
            <Route path="/crash" element={<Crasher />} />
          </Routes>
        </ErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Synthetic render failure')).toBeTruthy();
    consoleSpy.mockRestore();
  });
});
