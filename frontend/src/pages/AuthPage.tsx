import { useState, type FormEvent } from 'react';
import { authApi } from '../api/endpoints';
import { Message, useAction } from '../lib';
import type { AuthUser, Role } from '../types';

export function AuthPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('Candidate');
  const { busy, message, run } = useAction();

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const res =
        mode === 'login'
          ? await authApi.login({ email, password })
          : await authApi.register({ email, password, display_name: displayName, role });
      onLogin(res.user);
    });
  }

  return (
    <section className="card narrow">
      <h2>{mode === 'login' ? 'Log in' : 'Register'}</h2>
      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {mode === 'register' && (
          <>
            <label>
              Display name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </label>
            <label>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="Candidate">Candidate</option>
                <option value="Employer">Employer</option>
              </select>
            </label>
          </>
        )}
        <button disabled={busy}>{mode === 'login' ? 'Log in' : 'Create account'}</button>
      </form>
      <Message message={message} />
      <button className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in'}
      </button>
    </section>
  );
}
