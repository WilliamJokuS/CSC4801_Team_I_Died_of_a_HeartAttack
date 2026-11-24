// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { request, setToken } from '../../../frontend/src/api/client';
import CandidateAppLayout from '../../../frontend/src/components/layout/CandidateAppLayout';
import CandidateProfilePage from '../../../frontend/src/pages/CandidateProfilePage';
import ProtectedRoute from '../../../frontend/src/components/ProtectedRoute';
import { AuthProvider } from '../../../frontend/src/context/AuthContext';
import { useAuth } from '../../../frontend/src/hooks/useAuth';
import AuthPage from '../../../frontend/src/pages/AuthPage';

const tokenKey = 'csc4801.token';
const employer = { id: 'hr', role: 'Employer', email: 'hr@demo.test', display_name: 'HR', created_at: '' };
const alice = { id: 'alice', role: 'Candidate', email: 'alice@demo.test', display_name: 'Alice', created_at: '' };
const bob = { id: 'bob', role: 'Candidate', email: 'bob@demo.test', display_name: 'Bob', created_at: '' };

function delayedResponse() {
  let resolve!: (response: Response) => void;
  const response = new Promise<Response>((done) => { resolve = done; });
  return { response, resolve };
}

function SessionPage() {
  const { user, logout } = useAuth();
  return <><p>{user?.display_name}</p><button onClick={() => void logout()}>Sign out</button></>;
}

function renderSession() {
  return render(
    <MemoryRouter initialEntries={['/candidate']}>
      <AuthProvider>
        <Routes>
          <Route path="/candidate" element={<ProtectedRoute role="Candidate"><SessionPage /></ProtectedRoute>} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function changeOtherTab(token: string | null) {
  const oldValue = localStorage.getItem(tokenKey);
  if (token) localStorage.setItem(tokenKey, token);
  else localStorage.removeItem(tokenKey);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: tokenKey, oldValue, newValue: token, storageArea: localStorage })));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setToken(null);
  localStorage.removeItem('csc4801.rememberEmail');
});

it('hides the previous account during cross-tab validation and clears it on cross-tab logout', async () => {
  setToken('alice-test-token');
  const next = delayedResponse();
  const fetchMock = vi.fn(async (_url, init?: RequestInit) => {
    const auth = new Headers(init?.headers).get('Authorization');
    return auth === 'Bearer alice-test-token' ? Response.json(alice) : next.response;
  });
  vi.stubGlobal('fetch', fetchMock);

  const view = renderSession();
  await view.findByText('Alice');

  changeOtherTab('bob-test-token');
  expect(view.queryByText('Alice')).toBeNull();
  expect(view.queryByText('Bob')).toBeNull();
  expect(fetchMock).toHaveBeenLastCalledWith('/api/me', expect.objectContaining({
    headers: { Authorization: 'Bearer bob-test-token' },
  }));
  next.resolve(Response.json(bob));
  await view.findByText('Bob');

  changeOtherTab(null);
  expect(view.queryByText('Bob')).toBeNull();
  await view.findByText('Login page');
});

it('discards a response requested under the previous session', async () => {
  setToken('alice-test-token');
  const oldData = delayedResponse();
  vi.stubGlobal('fetch', vi.fn(async (url, init?: RequestInit) => {
    if (url === '/api/me') {
      return Response.json(new Headers(init?.headers).get('Authorization') === 'Bearer alice-test-token' ? alice : bob);
    }
    return oldData.response;
  }));
  const view = renderSession();
  await view.findByText('Alice');

  const pending = request('GET', '/profile');
  changeOtherTab('bob-test-token');
  oldData.resolve(Response.json({ owner: 'Alice' }));
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  await view.findByText('Bob');
});

it('ends the local session immediately and ignores a failed logout after a new sign-in', async () => {
  setToken('alice-test-token');
  let failLogout!: (error: Error) => void;
  const logout = new Promise<Response>((_resolve, reject) => { failLogout = reject; });
  const fetchMock = vi.fn(async (url, init?: RequestInit) => {
    if (url === '/api/auth/logout') return logout;
    const auth = new Headers(init?.headers).get('Authorization');
    return Response.json(auth === 'Bearer alice-test-token' ? alice : bob);
  });
  vi.stubGlobal('fetch', fetchMock);

  const view = renderSession();
  await view.findByText('Alice');
  fireEvent.click(view.getByRole('button', { name: 'Sign out' }));
  expect(view.queryByText('Alice')).toBeNull();
  expect(localStorage.getItem(tokenKey)).toBeNull();
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
    headers: { Authorization: 'Bearer alice-test-token' },
  }));
  await view.findByText('Login page');

  changeOtherTab('bob-test-token');
  await act(async () => failLogout(new Error('Offline')));
  expect(localStorage.getItem(tokenKey)).toBe('bob-test-token');
  await expect(request('GET', '/me')).resolves.toMatchObject({ id: 'bob' });
});

function submitLogin(view: ReturnType<typeof render>, email: string, password = 'password123') {
  fireEvent.change(view.getByLabelText(/Email address/i), { target: { value: email } });
  fireEvent.change(view.getByLabelText(/^Password/i), { target: { value: password } });
  fireEvent.click(view.getByRole('button', { name: /Log in to SkillMatch/i }));
}

it.each([
  { start: '/login', user: employer, expected: '/employer' },
  { start: '/candidate/profile?view=skills', user: employer, expected: '/employer' },
  { start: '/candidate/profile?view=skills', user: alice, expected: '/candidate/profile?view=skills' },
])('BUG-FE-3 signs $user.role in from $start and lands at $expected', async ({ start, user, expected }) => {
  const visits: string[] = [];
  function PathRecorder() {
    const { pathname, search } = useLocation();
    visits.push(pathname + search);
    return null;
  }
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ user, token: 'login-token' })));
  const view = render(
    <MemoryRouter initialEntries={[start]}>
      <AuthProvider>
        <PathRecorder />
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/candidate" element={<ProtectedRoute role="Candidate"><p>Candidate home</p></ProtectedRoute>} />
          <Route path="/candidate/profile" element={<ProtectedRoute role="Candidate"><p>Candidate profile</p></ProtectedRoute>} />
          <Route path="/employer" element={<ProtectedRoute role="Employer"><p>Employer home</p></ProtectedRoute>} />
          <Route path="/" element={<p>Public home</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  await view.findByRole('button', { name: /Log in to SkillMatch/i });
  const afterLogin = visits.length;
  submitLogin(view, user.email);
  await view.findByText(user.role === 'Employer' ? 'Employer home' : 'Candidate profile');
  expect([...new Set(visits.slice(afterLogin))].filter((path) => path !== '/login')).toEqual([expected]);
});

it('BUG-FE-10 updates the navigation initials from a successfully saved candidate name', async () => {
  setToken('alice-test-token');
  const profile = { user_id: alice.id, display_name: 'Alice', skills: [], resume_text: '' };
  const fetchMock = vi.fn(async (url, init?: RequestInit) => {
    if (url === '/api/me') return Response.json(alice);
    if (init?.method === 'PUT') return Response.json({ ...profile, ...JSON.parse(String(init.body)) });
    return Response.json(profile);
  });
  vi.stubGlobal('fetch', fetchMock);
  const view = render(
    <MemoryRouter initialEntries={['/candidate/profile']}>
      <AuthProvider>
        <Routes>
          <Route path="/candidate" element={<ProtectedRoute role="Candidate"><CandidateAppLayout /></ProtectedRoute>}>
            <Route path="profile" element={<CandidateProfilePage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  const name = await view.findByDisplayValue('Alice');
  const avatar = view.getByTitle('Profile');
  expect(avatar.textContent).toBe('AL');
  fireEvent.change(name, { target: { value: 'Bob Lim' } });
  fireEvent.click(view.getByRole('button', { name: 'Save profile changes' }));
  await view.findByText('Profile saved.');
  expect(avatar.textContent).toBe('BL');
  expect(fetchMock.mock.calls.filter(([url, init]) => url.endsWith('/profile') && init?.method === 'GET')).toHaveLength(1);
});

it('signs in and sends authenticated requests when browser storage is blocked', async () => {
  const blocked = () => { throw new DOMException('Storage is blocked', 'SecurityError'); };
  vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
  const fetchMock = vi.fn(async (url, init?: RequestInit) => {
    if (url === '/api/auth/login') return Response.json({ user: alice, token: 'in-memory-token' });
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer in-memory-token');
    return Response.json(alice);
  });
  vi.stubGlobal('fetch', fetchMock);

  const view = render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/candidate" element={<ProtectedRoute role="Candidate"><SessionPage /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  await view.findByRole('button', { name: /Log in to SkillMatch/i });
  submitLogin(view, alice.email);
  await view.findByText('Alice');
  await expect(request('GET', '/me')).resolves.toMatchObject({ id: 'alice' });
  expect(fetchMock).toHaveBeenLastCalledWith('/api/me', expect.objectContaining({
    headers: { Authorization: 'Bearer in-memory-token' },
  }));
});

it.each(['login', 'register'])('%s submits an 8-byte Unicode password', async (mode) => {
  const fetchMock = vi.fn(async (_url, _init?: RequestInit) => Response.json({ user: alice, token: 'unicode-token' }));
  vi.stubGlobal('fetch', fetchMock);
  const view = render(
    <MemoryRouter initialEntries={[`/${mode}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/candidate" element={<ProtectedRoute role="Candidate"><SessionPage /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  if (mode === 'login') {
    submitLogin(view, alice.email, 'éééé');
  } else {
    fireEvent.change(view.getByLabelText('Full name'), { target: { value: 'Alice' } });
    fireEvent.change(view.getByLabelText(/Email address/i), { target: { value: alice.email } });
    fireEvent.change(view.getByLabelText('Password'), { target: { value: 'éééé' } });
    fireEvent.change(view.getByLabelText('Confirm password'), { target: { value: 'éééé' } });
    fireEvent.click(view.getByRole('button', { name: /Create your account/i }));
  }
  await view.findByText('Alice');
  expect(fetchMock).toHaveBeenCalledWith(`/api/auth/${mode}`, expect.objectContaining({
    body: expect.stringContaining('"password":"éééé"'),
  }));
});
