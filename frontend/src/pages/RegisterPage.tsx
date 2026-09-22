import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiErrorNotice } from '@/components/ui/ApiErrorNotice';
import type { AuthUser, Role } from '@/types';
import { useAuth } from '@/hooks/useAuth';

export function RegisterPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get('role');
  const [role, setRole] = useState<Role>(requestedRole === 'Employer' ? 'Employer' : 'Candidate');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      // TODO: Replace with real API call
      await new Promise((r) => setTimeout(r, 500));
      const nextUser: AuthUser = {
        id: role === 'Candidate' ? 'cand-001' : 'emp-001',
        email,
        display_name: displayName.trim(),
        role,
      };
      signIn(nextUser);
      navigate(role === 'Candidate' ? '/candidate/dashboard' : '/employer/dashboard', { replace: true });
    } catch {
      setError('Registration failed. Please try again.');
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
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent">Get started</p>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Create your account</h1>
          <p className="mt-2 text-sm text-text-secondary">Set up your workspace in less than a minute.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <ApiErrorNotice message={error} />}
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
          <Input
            label="Confirm Password"
            name="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <Input
            label="Display Name"
            name="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-text-primary">I am a</legend>
            <div className="grid grid-cols-2 rounded-xl bg-surface p-1">
            {(['Candidate', 'Employer'] as Role[]).map((r) => (
              <label key={r} className={`cursor-pointer rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${role === r ? 'bg-background text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}>
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  className="sr-only"
                />
                {r}
              </label>
            ))}
            </div>
          </fieldset>
          <Button type="submit" loading={loading}>
            Create Account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
