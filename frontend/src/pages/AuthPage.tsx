import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthPageShell from '../components/auth/AuthPageShell'
import { IconEye, IconLock, IconMail, IconShield, IconUser } from '../components/auth/AuthFieldIcons'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from '../hooks/useAuth'
import { apiErrorMessage } from '../lib/apiErrorMessage'
import type { Role } from '../types'

const REMEMBER_KEY = 'csc4801.rememberEmail'

type AuthMode = 'login' | 'register'

function AuthPage() {
  const { login, register, user, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mode: AuthMode = location.pathname === '/register' ? 'register' : 'login'

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<Role>('Candidate')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' | 'info' } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setMessage(null)
    const stored = localStorage.getItem(REMEMBER_KEY)
    if (stored && mode === 'login') {
      setEmail(stored)
      setRemember(true)
    }
  }, [mode])

  if (isLoading) {
    return <LoadingScreen />
  }

  if (user) {
    return <Navigate to={user.role === 'Candidate' ? '/candidate' : '/employer'} replace />
  }

  function switchMode(next: AuthMode) {
    setMessage(null)
    navigate(next === 'register' ? '/register' : '/login', { replace: true })
  }

  function handleForgotPassword() {
    const trimmed = email.trim()
    setMessage({
      type: 'info',
      text: trimmed
        ? `Password reset is not available in this demo. Contact your administrator if you need access for ${trimmed}.`
        : 'Enter your email above. Password reset is not available in this demo.',
    })
  }

  function fillDemoCredentials() {
    setEmail('alice@demo.test')
    setPassword('password123')
    switchMode('login')
    setMessage({
      type: 'success',
      text: 'Demo credentials filled. Click “Log in to SkillMatch” to continue.',
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)

    const trimmedEmail = email.trim()

    if (mode === 'register' && !displayName.trim()) {
      setMessage({ type: 'error', text: 'Please enter your full name.' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' })
      return
    }
    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Use a password of at least 8 characters.' })
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        await login(trimmedEmail, password)
        if (remember) {
          localStorage.setItem(REMEMBER_KEY, trimmedEmail)
        } else {
          localStorage.removeItem(REMEMBER_KEY)
        }
      } else {
        await register({
          email: trimmedEmail,
          password,
          display_name: displayName.trim(),
          role,
        })
      }
      navigate('/', { replace: true })
    } catch (err) {
      setMessage({ type: 'error', text: apiErrorMessage(err) })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isRegister = mode === 'register'

  return (
    <AuthPageShell
      headerAction={
        isRegister ? (
          <Link to="/login" className="flex items-center gap-1.5 font-bold text-brand hover:underline">
            Log in <span aria-hidden>↗</span>
          </Link>
        ) : (
          <Link to="/register" className="flex items-center gap-1.5 font-bold text-brand hover:underline">
            Get started <span aria-hidden>↗</span>
          </Link>
        )
      }
    >
      <div
        className="rounded-[22px] border border-[#e6eae5] bg-white p-[29px] shadow-[0_24px_75px_rgba(24,45,34,0.055)] md:p-10"
        aria-label="Account access"
      >
        <h2 className="font-display text-[28px] font-extrabold leading-tight tracking-[-1.05px]">
          {isRegister ? (
            <>
              Your next chapter<span className="text-[#78a27e]">.</span>
            </>
          ) : (
            <>
              Welcome back<span className="text-[#78a27e]">.</span>
            </>
          )}
        </h2>
        <p className="mb-[26px] mt-2 text-[13px] leading-relaxed text-[#86938a]">
          {isRegister
            ? 'Create a profile to discover jobs that fit your potential.'
            : 'Log in to explore opportunities made for you.'}
        </p>

        <div className="mb-[26px] flex gap-1 rounded-[11px] bg-[#f4f6f3] p-1.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isRegister}
            onClick={() => switchMode('login')}
            className={`flex-1 rounded-lg py-[11px] text-[13px] font-bold transition ${
              !isRegister ? 'bg-white text-ink shadow-[0_1px_6px_rgba(23,45,32,0.07)]' : 'text-[#75837a]'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isRegister}
            onClick={() => switchMode('register')}
            className={`flex-1 rounded-lg py-[11px] text-[13px] font-bold transition ${
              isRegister ? 'bg-white text-ink shadow-[0_1px_6px_rgba(23,45,32,0.07)]' : 'text-[#75837a]'
            }`}
          >
            Create account
          </button>
        </div>

        {message && (
          <p
            role="status"
            className={`mb-[17px] rounded-[9px] px-[13px] py-[11px] text-xs leading-snug ${
              message.type === 'error'
                ? 'bg-[#fff0ec] text-[#a14534]'
                : message.type === 'success'
                  ? 'bg-[#eef8ed] text-[#326b48]'
                  : 'bg-[#eef8ed] text-[#326b48]'
            }`}
          >
            {message.text}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {isRegister && (
            <>
              <div className="mb-[18px]">
                <div className="mb-2 flex justify-between">
                  <label htmlFor="name" className="text-xs font-bold">
                    Full name
                  </label>
                </div>
                <div className="flex h-12 items-center overflow-hidden rounded-[10px] border border-[#e2e8e1] bg-white focus-within:border-[#5f9975] focus-within:shadow-[0_0_0_3px_rgba(191,224,200,0.25)]">
                  <IconUser />
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Your full name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent pr-3 text-[13px] text-[#283b32] outline-none placeholder:text-[#afbab2]"
                  />
                </div>
              </div>

              <div className="mb-[18px]">
                <span className="mb-2 block text-xs font-bold">I am a…</span>
                <div className="flex gap-1 rounded-[11px] bg-[#f4f6f3] p-1">
                  {(['Candidate', 'Employer'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={role === option}
                      onClick={() => setRole(option)}
                      className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                        role === option ? 'bg-white text-ink shadow-sm' : 'text-[#75837a]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="mb-[18px]">
            <label htmlFor="email" className="mb-2 block text-xs font-bold">
              Email address
            </label>
            <div className="flex h-12 items-center overflow-hidden rounded-[10px] border border-[#e2e8e1] bg-white focus-within:border-[#5f9975] focus-within:shadow-[0_0_0_3px_rgba(191,224,200,0.25)]">
              <IconMail />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent pr-3 text-[13px] text-[#283b32] outline-none placeholder:text-[#afbab2]"
              />
            </div>
          </div>

          <div className="mb-[18px]">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="password" className="text-xs font-bold">
                Password
              </label>
              {!isRegister && (
                <button type="button" onClick={handleForgotPassword} className="border-0 bg-transparent p-0 text-[11px] font-bold text-[#4a795b]">
                  Forgot password?
                </button>
              )}
            </div>
            <div className="flex h-12 items-center overflow-hidden rounded-[10px] border border-[#e2e8e1] bg-white focus-within:border-[#5f9975] focus-within:shadow-[0_0_0_3px_rgba(191,224,200,0.25)]">
              <IconLock />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder="Enter your password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#283b32] outline-none placeholder:text-[#afbab2]"
              />
              <button
                type="button"
                className="grid place-items-center px-3 text-[#8a9c90]"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <IconEye />
              </button>
            </div>
          </div>

          {isRegister && (
            <div className="mb-[18px]">
              <label htmlFor="confirm_password" className="mb-2 block text-xs font-bold">
                Confirm password
              </label>
              <div className="flex h-12 items-center overflow-hidden rounded-[10px] border border-[#e2e8e1] bg-white focus-within:border-[#5f9975] focus-within:shadow-[0_0_0_3px_rgba(191,224,200,0.25)]">
                <IconLock />
                <input
                  id="confirm_password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent pr-3 text-[13px] text-[#283b32] outline-none placeholder:text-[#afbab2]"
                />
              </div>
            </div>
          )}

          {!isRegister && (
            <label className="mb-[23px] flex items-center gap-2 text-xs text-[#7c8b81]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-[15px] w-[15px] accent-brand"
              />
              Remember me
            </label>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-[10px] border-0 bg-brand py-[15px] text-[13px] font-extrabold text-white transition hover:-translate-y-px hover:bg-[#1d4937] disabled:opacity-50"
          >
            {isSubmitting
              ? isRegister
                ? 'Creating account…'
                : 'Logging in…'
              : isRegister
                ? 'Create your account →'
                : 'Log in to SkillMatch →'}
          </button>
        </form>

        <div className="my-[23px] flex items-center gap-3 text-[11px] text-[#a0ada3]">
          <span className="h-px flex-1 bg-[#e8ece7]" />
          or
          <span className="h-px flex-1 bg-[#e8ece7]" />
        </div>

        <button type="button" onClick={fillDemoCredentials} className="btn-secondary w-full py-[13px] text-xs">
          Explore with demo account →
        </button>

        <p className="mt-[25px] text-center text-xs text-[#87958a]">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('login')} className="border-0 bg-transparent p-0 font-extrabold text-brand">
                Log in
              </button>
            </>
          ) : (
            <>
              New to SkillMatch?{' '}
              <button type="button" onClick={() => switchMode('register')} className="border-0 bg-transparent p-0 font-extrabold text-brand">
                Create an account
              </button>
            </>
          )}
        </p>

        <div className="mt-[22px] flex items-center justify-center gap-2 text-[11px] text-[#9ba99d]">
          <IconShield />
          Demo: alice@demo.test / password123
        </div>
      </div>
    </AuthPageShell>
  )
}

export default AuthPage
