import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { AuthUser, Role } from '@/types';

interface NavigationItem {
  label: string;
  to: string;
  icon: 'home' | 'profile' | 'applications' | 'calendar' | 'company' | 'jobs';
}

const navigation: Record<Role, NavigationItem[]> = {
  Candidate: [
    { label: 'Discover', to: '/candidate/dashboard', icon: 'home' },
    { label: 'Profile', to: '/candidate/profile', icon: 'profile' },
    { label: 'Applications', to: '/candidate/applications', icon: 'applications' },
    { label: 'Interviews', to: '/candidate/interviews', icon: 'calendar' },
  ],
  Employer: [
    { label: 'Overview', to: '/employer/dashboard', icon: 'home' },
    { label: 'Company', to: '/employer/company', icon: 'company' },
    { label: 'Job postings', to: '/employer/jobs', icon: 'jobs' },
  ],
};

function Mark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-xl bg-accent text-white shadow-lg shadow-accent/20 ${className}`} aria-hidden="true">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M5 7h14M8 4v6m8-6v6M6 20l4.1-7h3.8L18 20M8 17h8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function NavIcon({ name }: { name: NavigationItem['icon'] }) {
  const paths: Record<NavigationItem['icon'], ReactNode> = {
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    applications: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4m8-4v4M3 10h18" /></>,
    company: <><path d="M4 21V5l8-3v19M12 8h8v13M8 7v1m0 3v1m0 3v1m8-4v1m0 3v1M2 21h20" /></>,
    jobs: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2" /></>,
  };
  return <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function AppShell({ children, user }: { children: ReactNode; user: AuthUser | null }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="public-shell min-h-screen text-text-primary">
        <header className="relative z-10 mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3 font-bold tracking-tight text-text-primary">
            <Mark />
            <span className="text-lg">TalentMatch</span>
          </Link>
          <Link to="/login" className="rounded-full border border-border bg-white/70 px-4 py-2 text-sm font-semibold text-text-primary backdrop-blur transition hover:border-accent/30 hover:text-accent">
            Log in
          </Link>
        </header>
        <main className="relative z-0 mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">{children}</main>
      </div>
    );
  }

  const items = navigation[user.role];
  const logout = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-surface text-text-primary lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-border/80 bg-background lg:fixed lg:inset-y-0 lg:flex lg:w-[17rem] lg:flex-col">
        <Link to={items[0].to} className="flex h-20 items-center gap-3 px-7 font-bold tracking-tight">
          <Mark />
          <span className="text-lg">TalentMatch</span>
        </Link>
        <div className="px-4 pt-5">
          <p className="px-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-text-secondary">Workspace</p>
          <nav className="mt-3 flex flex-col gap-1" aria-label={`${user.role} navigation`}>
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-info-bg text-accent' : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}>
                <NavIcon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-border p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-surface p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm font-bold text-accent">{user.display_name.charAt(0).toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.display_name}</p>
              <p className="truncate text-xs text-text-secondary">{user.email}</p>
            </div>
          </div>
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-danger-bg hover:text-danger">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 17l5-5-5-5M15 12H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Log out
          </button>
        </div>
      </aside>

      <div className="lg:col-start-2">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur lg:hidden">
          <Link to={items[0].to} className="flex items-center gap-2.5 font-bold"><Mark className="h-8 w-8" />TalentMatch</Link>
          <button onClick={logout} className="rounded-lg px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-surface">Log out</button>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 pb-28 sm:px-8 sm:py-10 lg:px-10 lg:py-12">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} aria-label={`${user.role} mobile navigation`}>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[0.68rem] font-semibold transition ${isActive ? 'text-accent' : 'text-text-secondary'}`}>
              <NavIcon name={item.icon} />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
