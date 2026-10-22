import { useEffect, useState, type ReactNode } from 'react';
import { getToken, setUnauthorizedHandler } from './api/client';
import { authApi } from './api/endpoints';
import { AuthPage } from './pages/AuthPage';
import { CandidateApplicationsPage, CandidateJobsPage, CandidateProfilePage } from './pages/candidate';
import { AvailabilityPage, CompanyProfilePage, EmployerJobsPage } from './pages/employer';
import type { AuthUser, Role } from './types';

const TABS: Record<Role, { key: string; label: string; render: () => ReactNode }[]> = {
  Candidate: [
    { key: 'jobs', label: 'Jobs', render: () => <CandidateJobsPage /> },
    { key: 'applications', label: 'My applications', render: () => <CandidateApplicationsPage /> },
    { key: 'profile', label: 'Profile & resume', render: () => <CandidateProfilePage /> },
  ],
  Employer: [
    { key: 'jobs', label: 'My jobs', render: () => <EmployerJobsPage /> },
    { key: 'availability', label: 'Availability', render: () => <AvailabilityPage /> },
    { key: 'profile', label: 'Company profile', render: () => <CompanyProfilePage /> },
  ],
};

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(() => getToken() !== null);
  const [tab, setTab] = useState('jobs');

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    // Restore a saved session; an expired token comes back 401 and is cleared by the client.
    if (getToken()) {
      authApi
        .me()
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setChecking(false));
    }
    return () => setUnauthorizedHandler(null);
  }, []);

  async function logout() {
    await authApi.logout().catch(() => undefined);
    setUser(null);
    setTab('jobs');
  }

  if (checking) return <p className="muted center">Loading…</p>;

  return (
    <div className="app">
      <header>
        <strong>CSC4801 Recruiting</strong>
        {user && (
          <>
            <nav>
              {TABS[user.role].map((t) => (
                <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </nav>
            <span className="muted">
              {user.display_name} ({user.role})
            </span>
            <button onClick={() => void logout()}>Log out</button>
          </>
        )}
      </header>
      <main>
        {user ? (
          // key remounts the page so it refetches when switching tabs.
          <div key={tab}>{TABS[user.role].find((t) => t.key === tab)?.render()}</div>
        ) : (
          <AuthPage
            onLogin={(u) => {
              setUser(u);
              setTab('jobs');
            }}
          />
        )}
      </main>
    </div>
  );
}
