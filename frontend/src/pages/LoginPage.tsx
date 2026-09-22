import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiErrorNotice } from '@/components/ui/ApiErrorNotice';
import type { AuthUser } from '@/types';
import type { Role } from '@/types';
import { useAuth } from '@/hooks/useAuth';

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Candidate');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with real API call
      await new Promise((r) => setTimeout(r, 500));
      const nextUser: AuthUser = {
        id: role === 'Candidate' ? 'cand-001' : 'emp-001',
        email,
        display_name: role === 'Candidate' ? 'Jane Doe' : 'Morgan Lee',
        role,
      };
      signIn(nextUser);
      const requestedPath = searchParams.get('next');
      const safeNext = requestedPath?.startsWith('/') ? requestedPath : null;
      navigate(safeNext ?? (role === 'Candidate' ? '/candidate/dashboard' : '/employer/dashboard'), {
        replace: true,
      });
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  if (user) {
    return <Navigate to={user.role === 'Candidate' ? '/candidate/dashboard' : '/employer/dashboard'} replace />;
  }

  return (
    <AppShell user={null}>
      <div className="auth-panel mx-auto max-w-md">
        <div className="mb-7">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent">Welcome back</p>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Log in to TalentMatch</h1>
          <p className="mt-2 text-sm text-text-secondary">Continue to your personalized workspace.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <ApiErrorNotice message={error} />}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-text-primary">I am a</legend>
            <div className="grid grid-cols-2 rounded-xl bg-surface p-1">
              {(['Candidate', 'Employer'] as Role[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={role === option}
                  onClick={() => setRole(option)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    role === option ? 'bg-background text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
          <Input
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={loading}>
            Log In
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-text-secondary">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
